import sql from 'mssql';
import dns from 'dns';

// Force DNS resolution to prefer IPv4 over IPv6
dns.setDefaultResultOrder('ipv4first');

export interface TableInfo {
  schema: string;
  name: string;
  type: string;
  rowCount?: number;
}

export interface ColumnInfo {
  column: string;
  type: string;
  maxLength?: number;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
}

export interface ExecuteResult {
  rowsAffected: number;
  recordset?: any[];
}

export interface MssqlAdapterConfig extends Partial<sql.config> {
  readOnlyMode?: boolean;
}

export class MssqlAdapter {
  private pool: sql.ConnectionPool | null = null;
  private connectingPromise: Promise<sql.ConnectionPool> | null = null;
  private readonly config: sql.config;
  private readonly defaultDatabase: string;
  private readOnlyMode: boolean = true;

  constructor(customConfig?: MssqlAdapterConfig) {
    this.defaultDatabase = (customConfig?.database || process.env.MSSQL_DATABASE || 'TG_2024').trim();

    // Safety guard defaults to TRUE to protect crucial production/live data
    this.readOnlyMode = customConfig?.readOnlyMode ?? (process.env.MSSQL_READ_ONLY !== 'false');

    this.config = {
      server: customConfig?.server || process.env.MSSQL_HOST || 'hcp.developeradda.com',
      port: customConfig?.port ?? (process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT, 10) : 4431),
      user: customConfig?.user || process.env.MSSQL_USER || 'sa',
      password: customConfig?.password || process.env.MSSQL_PASSWORD || 'dev@1979',
      database: this.defaultDatabase,
      options: {
        encrypt: customConfig?.options?.encrypt ?? true,
        trustServerCertificate: customConfig?.options?.trustServerCertificate ?? true,
        requestTimeout: customConfig?.options?.requestTimeout ?? 30000,
        connectTimeout: customConfig?.options?.connectTimeout ?? 15000,
        ...customConfig?.options,
      },
      pool: {
        min: customConfig?.pool?.min ?? 0,
        max: customConfig?.pool?.max ?? 10,
        idleTimeoutMillis: customConfig?.pool?.idleTimeoutMillis ?? 30000,
        ...customConfig?.pool,
      },
      requestTimeout: customConfig?.requestTimeout ?? 30000,
      connectionTimeout: customConfig?.connectionTimeout ?? 15000,
    };
  }

  /**
   * Check if adapter is currently in read-only mode.
   */
  public isReadOnly(): boolean {
    return this.readOnlyMode;
  }

  /**
   * Configure read-only safety lock mode.
   */
  public setReadOnlyMode(enabled: boolean): void {
    this.readOnlyMode = enabled;
    console.log(`[MssqlAdapter] Read-only safety guard is now ${enabled ? 'ENABLED' : 'DISABLED'}.`);
  }

  /**
   * Determine if a SQL query performs any data or schema mutation.
   */
  private isMutationQuery(sqlQuery: string): boolean {
    const cleanSql = sqlQuery
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    const mutationPattern = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|MERGE|CREATE|GRANT|REVOKE)\b/i;
    return mutationPattern.test(cleanSql);
  }

  /**
   * Validate SQL query safety against read-only lock.
   */
  private validateQuerySafety(sqlQuery: string): void {
    if (this.readOnlyMode && this.isMutationQuery(sqlQuery)) {
      throw new Error('[SAFETY_LOCK] Write operations are disabled in read-only mode to protect crucial database data.');
    }
  }

  /**
   * Connect to the MSSQL database or return existing connection pool.
   * Auto-reconnects on failure or when previous connection was closed.
   */
  public async connect(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) {
      return this.pool;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = (async () => {
      try {
        if (this.pool) {
          try {
            await this.pool.close();
          } catch {
            // Ignore close error on stale pool
          }
          this.pool = null;
        }

        const newPool = new sql.ConnectionPool(this.config);

        newPool.on('error', (err: any) => {
          console.error('[MssqlAdapter] Connection pool error event:', err?.message || err);
          if (!newPool.connected && this.pool === newPool) {
            this.pool = null;
          }
        });

        await newPool.connect();
        this.pool = newPool;
        return newPool;
      } catch (err: any) {
        this.pool = null;
        console.error('[MssqlAdapter] Failed to establish MSSQL connection pool:', err?.message || err);
        throw err;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  /**
   * Disconnect and close the connection pool.
   */
  public async disconnect(): Promise<void> {
    if (this.pool) {
      const activePool = this.pool;
      this.pool = null;
      this.connectingPromise = null;
      try {
        if (activePool.connected) {
          await activePool.close();
        }
      } catch (err: any) {
        console.warn('[MssqlAdapter] Warning during disconnect:', err?.message || err);
      }
    }
  }

  /**
   * Returns true if connection pool exists and is connected.
   */
  public isConnected(): boolean {
    return this.pool !== null && this.pool.connected;
  }

  /**
   * Execute an operation with automatic reconnection on connection drops.
   */
  private async executeWithRetry<R>(operation: (pool: sql.ConnectionPool) => Promise<R>): Promise<R> {
    const pool = await this.connect();
    try {
      return await operation(pool);
    } catch (error: any) {
      const isConnectionIssue =
        !this.isConnected() ||
        error?.code === 'ECONNCLOSED' ||
        error?.code === 'ETIMEOUT' ||
        error?.code === 'ESOCKET' ||
        error?.code === 'ENOTOPEN' ||
        error?.code === 'ENOCONN' ||
        (typeof error?.message === 'string' &&
          (error.message.includes('connection is closed') ||
            error.message.includes('Connection lost') ||
            error.message.includes('Failed to connect')));

      if (isConnectionIssue) {
        console.warn('[MssqlAdapter] Connection error detected. Auto-reconnecting and retrying operation...', error?.message);
        this.pool = null;
        const reconnectedPool = await this.connect();
        return await operation(reconnectedPool);
      }
      throw error;
    }
  }

  /**
   * Escape and quote an identifier for SQL Server queries.
   */
  private sanitizeIdentifier(identifier: string): string {
    return identifier.replace(/\]/g, ']]');
  }

  /**
   * Prepare SQL string with database context and handle batch execution restrictions.
   */
  private prepareSqlWithDb(sqlQuery: string, database?: string): string {
    const targetDb = (database || this.defaultDatabase).trim();
    const sanitizedDb = this.sanitizeIdentifier(targetDb);
    const trimmed = sqlQuery.trim();

    // If query already contains explicit USE statement at top, don't prepend
    if (/^USE\s+\[?/i.test(trimmed)) {
      return sqlQuery;
    }

    // CREATE/ALTER PROCEDURE, VIEW, FUNCTION, TRIGGER must be the first statement in a query batch
    const isBatchRestricted = /^(CREATE|ALTER)\s+(VIEW|PROCEDURE|FUNCTION|TRIGGER|SCHEMA)\b/i.test(trimmed);
    if (isBatchRestricted) {
      const escaped = sqlQuery.replace(/'/g, "''");
      return `USE [${sanitizedDb}];\nEXEC(N'${escaped}');`;
    }

    return `USE [${sanitizedDb}];\n${sqlQuery}`;
  }

  /**
   * Bind parameter dictionary into mssql.Request.
   */
  private bindParameters(request: sql.Request, params?: Record<string, any>): void {
    if (!params) return;
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  /**
   * List all available online databases on the server.
   */
  public async listDatabases(): Promise<string[]> {
    return this.executeWithRetry(async (pool) => {
      const req = pool.request();
      const result = await req.query<{ name: string }>(`
        SELECT name 
        FROM sys.databases 
        WHERE state_desc = 'ONLINE' 
        ORDER BY name;
      `);
      return (result.recordset || []).map((row) => row.name);
    });
  }

  /**
   * List all tables and views in the specified database (or default database).
   */
  public async listTables(database?: string): Promise<TableInfo[]> {
    return this.executeWithRetry(async (pool) => {
      const targetDb = database || this.defaultDatabase;
      const sanitizedDb = this.sanitizeIdentifier(targetDb);

      const query = `
        USE [${sanitizedDb}];
        SELECT 
            s.name AS [schema],
            t.name AS [name],
            'BASE TABLE' AS [type],
            COALESCE(SUM(p.rows), 0) AS [rowCount]
        FROM sys.tables t
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
        GROUP BY s.name, t.name
        UNION ALL
        SELECT 
            s.name AS [schema],
            v.name AS [name],
            'VIEW' AS [type],
            NULL AS [rowCount]
        FROM sys.views v
        INNER JOIN sys.schemas s ON v.schema_id = s.schema_id
        ORDER BY [type] DESC, [schema], [name];
      `;

      const req = pool.request();
      const result = await req.query(query);

      return (result.recordset || []).map((row: any) => ({
        schema: String(row.schema),
        name: String(row.name),
        type: String(row.type),
        rowCount: row.rowCount !== null && row.rowCount !== undefined ? Number(row.rowCount) : undefined,
      }));
    });
  }

  /**
   * Describe table columns, data types, primary key flags, nullability, and defaults.
   */
  public async describeTable(table: string, schema?: string, database?: string): Promise<ColumnInfo[]> {
    return this.executeWithRetry(async (pool) => {
      const targetDb = database || this.defaultDatabase;
      const sanitizedDb = this.sanitizeIdentifier(targetDb);

      const query = `
        USE [${sanitizedDb}];
        SELECT 
            c.COLUMN_NAME AS [column],
            c.DATA_TYPE AS [type],
            c.CHARACTER_MAXIMUM_LENGTH AS [maxLength],
            CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS [nullable],
            CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS [isPrimaryKey],
            c.COLUMN_DEFAULT AS [defaultValue]
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
            SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY' 
                AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
                AND tc.TABLE_NAME = ku.TABLE_NAME
        ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
            AND c.TABLE_NAME = pk.TABLE_NAME 
            AND c.COLUMN_NAME = pk.COLUMN_NAME
        WHERE c.TABLE_NAME = @tableName
          AND (@schema IS NULL OR c.TABLE_SCHEMA = @schema)
        ORDER BY c.ORDINAL_POSITION;
      `;

      const req = pool.request();
      req.input('tableName', sql.NVarChar, table);
      req.input('schema', sql.NVarChar, schema || null);

      const result = await req.query(query);

      return (result.recordset || []).map((row: any) => ({
        column: String(row.column),
        type: String(row.type),
        maxLength: row.maxLength !== null && row.maxLength !== undefined ? Number(row.maxLength) : undefined,
        nullable: Boolean(row.nullable),
        isPrimaryKey: Boolean(row.isPrimaryKey),
        defaultValue: row.defaultValue !== null && row.defaultValue !== undefined ? String(row.defaultValue) : undefined,
      }));
    });
  }

  /**
   * Execute a SELECT / read query and return typed recordset rows.
   * Safety guard prevents write operations when read-only mode is active.
   */
  public async query<T = any>(sqlQuery: string, params?: Record<string, any>, database?: string): Promise<T[]> {
    this.validateQuerySafety(sqlQuery);

    return this.executeWithRetry(async (pool) => {
      const fullSql = this.prepareSqlWithDb(sqlQuery, database);
      const req = pool.request();
      this.bindParameters(req, params);

      const result = await req.query<T>(fullSql);
      return (result.recordset as T[]) || [];
    });
  }

  /**
   * Execute an INSERT / UPDATE / DELETE / DDL command and return affected rows and optional recordset.
   * Safety guard prevents execution when read-only mode is active.
   */
  public async execute(
    sqlQuery: string,
    params?: Record<string, any>,
    database?: string
  ): Promise<ExecuteResult> {
    this.validateQuerySafety(sqlQuery);

    return this.executeWithRetry(async (pool) => {
      const fullSql = this.prepareSqlWithDb(sqlQuery, database);
      const req = pool.request();
      this.bindParameters(req, params);

      const result = await req.query(fullSql);

      const rowsAffected = Array.isArray(result.rowsAffected)
        ? result.rowsAffected.reduce((acc, curr) => acc + curr, 0)
        : (result.rowsAffected ?? 0);

      return {
        rowsAffected,
        recordset: result.recordset || undefined,
      };
    });
  }

  /**
   * Run operations within a database transaction.
   * Safety guard prevents opening modifying transactions in read-only mode.
   */
  public async transaction<T>(callback: (tx: sql.Transaction, req: sql.Request) => Promise<T>): Promise<T> {
    if (this.readOnlyMode) {
      throw new Error('[SAFETY_LOCK] Write operations are disabled in read-only mode to protect crucial database data.');
    }

    const pool = await this.connect();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const req = new sql.Request(tx);
      const result = await callback(tx, req);
      await tx.commit();
      return result;
    } catch (err) {
      try {
        await tx.rollback();
      } catch (rollbackErr: any) {
        console.error('[MssqlAdapter] Transaction rollback failed:', rollbackErr?.message || rollbackErr);
      }
      throw err;
    }
  }
}

// Export default singleton instance
export const mssqlAdapter = new MssqlAdapter();
export default mssqlAdapter;

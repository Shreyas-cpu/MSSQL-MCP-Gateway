import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { mssqlAdapter } from './adapters/mssql-adapter.js';
import { AuditLogger } from './middleware/audit-logger.js';
import dns from 'dns';

// Force DNS lookup to prefer IPv4
dns.setDefaultResultOrder('ipv4first');

// ═══════════════════════════════════════════════════════
// MSSQL MCP Gateway — Server Entry Point
// ═══════════════════════════════════════════════════════

const audit = new AuditLogger();

const server = new McpServer({
  name: 'MSSQL-Database-Gateway',
  version: '1.0.0',
});

// ─── Helper: wrap tool execution with audit logging ───
async function withAudit<T>(tool: string, params: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    audit.log({
      timestamp: new Date().toISOString(),
      tool,
      params,
      userId: 'cursor_agent',
      result: 'success',
      durationMs: Date.now() - start,
      adapter: 'mssql',
    });
    return result;
  } catch (err: any) {
    audit.log({
      timestamp: new Date().toISOString(),
      tool,
      params,
      userId: 'cursor_agent',
      result: 'error',
      durationMs: Date.now() - start,
      adapter: 'mssql',
    });
    throw err;
  }
}

// ═══════════════════════════════════════════════════════
// MSSQL TOOLS (READ-ONLY SAFETY PROTOCOL ENFORCED)
// ═══════════════════════════════════════════════════════

// ─── TOOL 1: mssql_list_databases ───
server.tool(
  'mssql_list_databases',
  'Lists all online databases on the MSSQL instance.',
  {},
  async (params) => {
    try {
      const databases = await withAudit('mssql_list_databases', params, () =>
        mssqlAdapter.listDatabases()
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                tool: 'mssql_list_databases',
                count: databases.length,
                databases,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                tool: 'mssql_list_databases',
                error: err?.message || String(err),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }
);

// ─── TOOL 2: mssql_list_tables ───
server.tool(
  'mssql_list_tables',
  'Lists all tables and views (schema, name, type, rowCount) in the active database (or specified database param).',
  {
    database: z.string().optional().describe('Target database name (defaults to active database TG_2024)'),
  },
  async (params) => {
    try {
      const tables = await withAudit('mssql_list_tables', params, () =>
        mssqlAdapter.listTables(params.database)
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                tool: 'mssql_list_tables',
                database: params.database || 'TG_2024',
                count: tables.length,
                tables,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                tool: 'mssql_list_tables',
                error: err?.message || String(err),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }
);

// ─── TOOL 3: mssql_describe_table ───
server.tool(
  'mssql_describe_table',
  'Returns detailed column definitions (name, type, max length, nullable, isPrimaryKey, defaultValue) for a given table.',
  {
    table: z.string().describe('Table or view name to inspect'),
    schema: z.string().optional().describe('Schema name (e.g. dbo)'),
    database: z.string().optional().describe('Target database name (defaults to active database TG_2024)'),
  },
  async (params) => {
    try {
      const columns = await withAudit('mssql_describe_table', params, () =>
        mssqlAdapter.describeTable(params.table, params.schema, params.database)
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                tool: 'mssql_describe_table',
                table: params.table,
                schema: params.schema || null,
                columnCount: columns.length,
                columns,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                tool: 'mssql_describe_table',
                error: err?.message || String(err),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }
);

// ─── TOOL 4: mssql_read_query ───
server.tool(
  'mssql_read_query',
  'Runs read-only queries with optional parameter bindings and row limit.',
  {
    query: z.string().describe('T-SQL SELECT or read-only query to execute'),
    params: z.record(z.any()).optional().describe('Optional key-value parameters to safely bind to the query (e.g. { "id": 100 })'),
    database: z.string().optional().describe('Target database name (defaults to active database TG_2024)'),
    limit: z.number().int().positive().optional().describe('Optional maximum number of rows to return from the resultset'),
  },
  async (params) => {
    try {
      const data = await withAudit('mssql_read_query', params, async () => {
        let rows = await mssqlAdapter.query(params.query, params.params, params.database);
        if (params.limit !== undefined && rows.length > params.limit) {
          rows = rows.slice(0, params.limit);
        }
        return rows;
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                tool: 'mssql_read_query',
                count: data.length,
                data,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                tool: 'mssql_read_query',
                error: err?.message || String(err),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }
);

// ─── TOOL 5: mssql_execute_statement ───
server.tool(
  'mssql_execute_statement',
  'Execute a SQL statement (INSERT, UPDATE, DELETE, DDL). Strictly guarded by readOnlyMode in mssqlAdapter.',
  {
    query: z.string().describe('SQL statement to execute (INSERT, UPDATE, DELETE, DDL)'),
    params: z.record(z.any()).optional().describe('Optional key-value parameters to bind to the statement'),
    database: z.string().optional().describe('Target database name (defaults to active database TG_2024)'),
  },
  async (params) => {
    try {
      const result = await withAudit('mssql_execute_statement', params, () =>
        mssqlAdapter.execute(params.query, params.params, params.database)
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                tool: 'mssql_execute_statement',
                status: 'success',
                rowsAffected: result.rowsAffected,
                recordset: result.recordset,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                tool: 'mssql_execute_statement',
                status: 'blocked',
                error: err?.message || String(err),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }
);

// ═══════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  console.error('MSSQL Database Gateway v1.0.0');
  console.error(`MSSQL Target: hcp.developeradda.com:4431 (TG_2024)`);
  console.error(`Safety Guard: readOnlyMode=${mssqlAdapter.isReadOnly()}`);
  console.error('5 MSSQL tools registered · stdio transport');
  console.error('Waiting for MCP client connection...');
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});

import express from 'express';
import cors from 'cors';
import path from 'path';
import dns from 'dns';
import { AuditLogger, onAudit, AuditEntry } from './middleware/audit-logger.js';
import { mssqlAdapter } from './adapters/mssql-adapter.js';

// Force DNS resolution to prefer IPv4 over IPv6
dns.setDefaultResultOrder('ipv4first');

const app = express();
const audit = new AuditLogger();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Enforce strict read-only safety protocol on MSSQL adapter
mssqlAdapter.setReadOnlyMode(true);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

// ─── Real-Time Server-Sent Events (SSE) Stream ───
const sseClients = new Set<express.Response>();

// Broadcast every new audit entry to all connected SSE clients
onAudit((entry: AuditEntry) => {
  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      // Failed client will be cleaned up on close
    }
  }
});

app.get('/api/live-stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Initial connection handshake
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    message: 'Connected to MSSQL MCP Live Stream',
    timestamp: new Date().toISOString(),
    readOnly: mssqlAdapter.isReadOnly(),
  })}\n\n`);

  sseClients.add(res);

  // Send heartbeat comment every 15s to keep connection alive
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(res);
  });
});

// ─── MSSQL Database Helper Endpoints ───

// Connection status & safety lock
app.get('/api/mssql/status', async (_req, res) => {
  try {
    const isConn = mssqlAdapter.isConnected();
    res.json({
      connected: isConn,
      readOnly: mssqlAdapter.isReadOnly(),
      database: 'TG_2024',
      server: 'hcp.developeradda.com:4431',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// List all 187 tables in TG_2024
app.get('/api/mssql/tables', async (req, res) => {
  try {
    const db = req.query.database as string | undefined;
    const tables = await mssqlAdapter.listTables(db);
    res.json({ success: true, database: db || 'TG_2024', count: tables.length, tables });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// Inspect table schema
app.get('/api/mssql/table-schema', async (req, res) => {
  try {
    const table = req.query.table as string;
    const schema = req.query.schema as string | undefined;
    const db = req.query.database as string | undefined;
    if (!table) {
      return res.status(400).json({ success: false, error: 'Table parameter required' });
    }
    const columns = await mssqlAdapter.describeTable(table, schema, db);
    res.json({ success: true, table, schema: schema || 'dbo', count: columns.length, columns });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// Preview top rows from a table safely
app.get('/api/mssql/table-data', async (req, res) => {
  const start = Date.now();
  try {
    const table = req.query.table as string;
    const schema = (req.query.schema as string) || 'dbo';
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const db = (req.query.database as string) || 'TG_2024';

    if (!table) {
      return res.status(400).json({ success: false, error: 'Table parameter required' });
    }

    // Sanitize identifier to prevent injection
    const cleanSchema = schema.replace(/[^a-zA-Z0-9_]/g, '');
    const cleanTable = table.replace(/[^a-zA-Z0-9_]/g, '');
    const safeSql = `SELECT TOP (${limit}) * FROM [${cleanSchema}].[${cleanTable}]`;

    const rows = await mssqlAdapter.query(safeSql, undefined, db);

    audit.log({
      timestamp: new Date().toISOString(),
      tool: 'mssql_read_query',
      params: { table: `${cleanSchema}.${cleanTable}`, limit, query: safeSql, database: db },
      userId: 'dashboard_viewer',
      result: 'success',
      durationMs: Date.now() - start,
      adapter: 'mssql',
    });

    res.json({
      success: true,
      table: `${cleanSchema}.${cleanTable}`,
      database: db,
      limit,
      count: rows.length,
      rows,
    });
  } catch (err: any) {
    audit.log({
      timestamp: new Date().toISOString(),
      tool: 'mssql_read_query',
      params: { table: req.query.table, error: err?.message },
      userId: 'dashboard_viewer',
      result: 'error',
      durationMs: Date.now() - start,
      adapter: 'mssql',
    });
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// Ad-hoc read-only query runner with safety lock check
app.post('/api/mssql/query', async (req, res) => {
  const start = Date.now();
  const { query, database } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ success: false, error: 'SQL query string required' });
  }

  try {
    const rows = await mssqlAdapter.query(query, undefined, database);
    audit.log({
      timestamp: new Date().toISOString(),
      tool: 'mssql_read_query',
      params: { query, database: database || 'TG_2024' },
      userId: 'dashboard_viewer',
      result: 'success',
      durationMs: Date.now() - start,
      adapter: 'mssql',
    });
    res.json({ success: true, count: rows.length, rows });
  } catch (err: any) {
    const isSafetyLock = err?.message?.includes('SAFETY_LOCK');
    audit.log({
      timestamp: new Date().toISOString(),
      tool: 'mssql_execute_statement',
      params: { query, database: database || 'TG_2024' },
      userId: 'dashboard_viewer',
      result: 'error',
      durationMs: Date.now() - start,
      adapter: 'mssql',
    });
    res.status(isSafetyLock ? 403 : 500).json({
      success: false,
      error: err?.message || String(err),
      safetyLocked: isSafetyLock,
    });
  }
});

// ─── Audit Log Endpoint ───
app.get('/api/audit-log', (_req, res) => {
  res.json(audit.getRecentEntries());
});

app.listen(PORT, () => {
  console.log(`\n  MSSQL MCP Gateway & Live Dashboard Server`);
  console.log(`  ──────────────────────────────────────────`);
  console.log(`  Local URL:  http://localhost:${PORT}`);
  console.log(`  Database:   TG_2024 @ hcp.developeradda.com:4431`);
  console.log(`  Safety:     READ-ONLY LOCK ACTIVE`);
  console.log(`  Live Stream: http://localhost:${PORT}/api/live-stream (SSE ready)\n`);
});

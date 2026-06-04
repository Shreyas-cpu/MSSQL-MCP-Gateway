import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════
// SAP BTP Mock OData V4 Service
// Pure Express server — no native dependencies
// Simulates SAP BTP Cockpit data backend
// ═══════════════════════════════════════════════════════

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4004;
const DATA_DIR = path.join(__dirname, '..', 'db', 'data');

// ─── In-Memory Data Store ───
interface DataStore {
  [entityName: string]: Record<string, unknown>[];
}

const store: DataStore = {};

// ─── CSV Parser (semicolon-delimited, CAP-style) ───
function parseCSV(content: string): Record<string, unknown>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(';').map(h => h.trim());
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const val = (values[j] ?? '').trim();
      if (val === 'true') row[headers[j]] = true;
      else if (val === 'false') row[headers[j]] = false;
      else if (val !== '' && !isNaN(Number(val)) && !headers[j].toLowerCase().includes('date') && !headers[j].toLowerCase().includes('year') && !headers[j].toLowerCase().includes('code') && !headers[j].toLowerCase().includes('number') && !headers[j].toLowerCase().includes('id') && !headers[j].toLowerCase().includes('element') && !headers[j].toLowerCase().includes('period')) {
        row[headers[j]] = Number(val);
      } else {
        row[headers[j]] = val === '' ? null : val;
      }
    }
    rows.push(row);
  }
  return rows;
}

// ─── Load all CSV data on startup ───
function loadAllData(): void {
  const csvFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
  for (const file of csvFiles) {
    const match = file.match(/sap\.mcp-(\w+)\.csv/);
    if (!match) continue;
    const entityName = match[1];
    const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    store[entityName] = parseCSV(content);
    console.log(`  ✓ Loaded ${store[entityName].length} records → ${entityName}`);
  }
}

// ─── Persistence ───
const STATE_FILE = path.join(DATA_DIR, '..', 'state.json');

function saveState(): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function loadPersistedState(): boolean {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      Object.assign(store, data);
      console.log('  ✓ Loaded persisted state from state.json');
      return true;
    }
  } catch {
    console.error('  ⚠ Failed to load persisted state, falling back to CSV');
  }
  return false;
}

// ─── OData V4 response wrappers ───
function odataCollection(entitySet: string, data: Record<string, unknown>[]) {
  return {
    '@odata.context': `$metadata#${entitySet}`,
    '@odata.count': data.length,
    value: data,
  };
}

function odataSingle(entitySet: string, data: Record<string, unknown>) {
  return {
    '@odata.context': `$metadata#${entitySet}/$entity`,
    ...data,
  };
}

function odataError(code: string, message: string) {
  return { error: { code, message, '@odata.type': '#error' } };
}

// ─── Entity key field mappings ───
const KEY_MAP: Record<string, string[]> = {
  PurchaseOrders: ['poNumber'],
  Vendors: ['vendorId'],
  Materials: ['materialId'],
  GoodsReceipts: ['grNumber'],
  SalesOrders: ['orderNumber'],
  DeliveryStatuses: ['deliveryNumber'],
  OpenItems: ['documentNumber'],
  BudgetVariances: ['costCenter', 'period', 'fiscalYear'],
  BudgetLineItems: ['costCenter', 'period', 'fiscalYear', 'costElement'],
  WorkOrders: ['orderNumber'],
  WarehouseStocks: ['materialId', 'plant', 'storageLocation'],
  WorkflowItems: ['itemId'],
};

// ─── Parse OData key from URL path ───
// Supports: Materials('MAT-10001') and Materials(costCenter='CC-1010',period='05')
function parseODataPath(rawPath: string): { entitySet: string; keys?: string } | null {
  // Match: /odata/v4/catalog/EntitySet('key') or /odata/v4/catalog/EntitySet(key1='v1',key2='v2')
  const keyMatch = rawPath.match(/\/odata\/v4\/catalog\/(\w+)\((.+)\)$/);
  if (keyMatch) {
    return { entitySet: keyMatch[1], keys: keyMatch[2] };
  }
  // Match: /odata/v4/catalog/EntitySet
  const collMatch = rawPath.match(/\/odata\/v4\/catalog\/(\w+)$/);
  if (collMatch) {
    return { entitySet: collMatch[1] };
  }
  return null;
}

function parseKeyValues(entitySet: string, rawKeys: string): Record<string, string> | null {
  const keyFields = KEY_MAP[entitySet];
  if (!keyFields) return null;

  const keyValues: Record<string, string> = {};
  if (keyFields.length === 1) {
    // Single key: 'MAT-10001' or MAT-10001
    keyValues[keyFields[0]] = rawKeys.replace(/'/g, '');
  } else {
    // Composite key: costCenter='CC-1010',period='05',fiscalYear='2026'
    const pairs = rawKeys.split(',');
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const k = pair.substring(0, eqIdx).trim();
      const v = pair.substring(eqIdx + 1).replace(/'/g, '').trim();
      keyValues[k] = v;
    }
  }
  return keyValues;
}

function findEntity(entitySet: string, keyValues: Record<string, string>): Record<string, unknown> | undefined {
  const keyFields = KEY_MAP[entitySet];
  if (!keyFields) return undefined;
  return store[entitySet].find(row =>
    keyFields.every(k => String(row[k]) === keyValues[k])
  );
}

// ═══════════════════════════════════════════════════════
// CATALOG OData ROUTER
// ═══════════════════════════════════════════════════════

const catalogRouter = express.Router();

// Service document
catalogRouter.get('/', (_req: Request, res: Response) => {
  const entities = Object.keys(store).map(name => ({
    name,
    kind: 'EntitySet',
    url: name,
    recordCount: store[name].length,
  }));
  res.json({ '@odata.context': '$metadata', value: entities });
});

// Catch-all for OData entity operations
// We use a wildcard route and parse the path ourselves to handle parentheses
catalogRouter.all('/*', (req: Request, res: Response) => {
  const parsed = parseODataPath(req.path.startsWith('/odata') ? req.path : `/odata/v4/catalog${req.path}`);

  if (!parsed) {
    return res.status(400).json(odataError('400', 'Invalid OData path'));
  }

  const { entitySet, keys } = parsed;

  if (!store[entitySet]) {
    return res.status(404).json(odataError('404', `Entity set '${entitySet}' not found`));
  }

  // ── COLLECTION operations (no key) ──
  if (!keys) {
    if (req.method === 'GET') {
      return handleGetCollection(entitySet, req, res);
    }
    if (req.method === 'POST') {
      return handlePost(entitySet, req, res);
    }
    return res.status(405).json(odataError('405', 'Method not allowed on collection'));
  }

  // ── SINGLE ENTITY operations (with key) ──
  const keyValues = parseKeyValues(entitySet, keys);
  if (!keyValues) {
    return res.status(400).json(odataError('400', `No key mapping for '${entitySet}'`));
  }

  if (req.method === 'GET') {
    return handleGetSingle(entitySet, keyValues, res);
  }
  if (req.method === 'PATCH' || req.method === 'PUT') {
    return handlePatch(entitySet, keyValues, req, res);
  }
  if (req.method === 'DELETE') {
    return handleDelete(entitySet, keyValues, res);
  }

  return res.status(405).json(odataError('405', 'Method not allowed'));
});

// ─── Handler implementations ───

function handleGetCollection(entitySet: string, req: Request, res: Response) {
  let results = [...store[entitySet]];

  // $filter: $filter=status eq 'pending' and plant eq '1010'
  const filter = req.query.$filter as string | undefined;
  if (filter) {
    const filterParts = filter.split(' and ');
    for (const part of filterParts) {
      const match = part.trim().match(/(\w+)\s+(eq|ne|gt|lt|ge|le)\s+'?([^']*)'?/);
      if (match) {
        const [, field, op, value] = match;
        results = results.filter(row => {
          const rowVal = String(row[field] ?? '');
          switch (op) {
            case 'eq': return rowVal === value;
            case 'ne': return rowVal !== value;
            case 'gt': return Number(rowVal) > Number(value);
            case 'lt': return Number(rowVal) < Number(value);
            case 'ge': return Number(rowVal) >= Number(value);
            case 'le': return Number(rowVal) <= Number(value);
            default: return true;
          }
        });
      }
    }
  }

  // $orderby
  const orderby = req.query.$orderby as string | undefined;
  if (orderby) {
    const [field, dir] = orderby.split(' ');
    results.sort((a, b) => {
      const va = String(a[field] ?? '');
      const vb = String(b[field] ?? '');
      return dir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
    });
  }

  // $top and $skip
  const totalCount = results.length;
  const skip = parseInt(req.query.$skip as string) || 0;
  const top = parseInt(req.query.$top as string) || results.length;
  results = results.slice(skip, skip + top);

  // $select
  const select = req.query.$select as string | undefined;
  if (select) {
    const fields = select.split(',').map(f => f.trim());
    results = results.map(row => {
      const filtered: Record<string, unknown> = {};
      for (const f of fields) filtered[f] = row[f];
      return filtered;
    });
  }

  res.json(odataCollection(entitySet, results));
}

function handleGetSingle(entitySet: string, keyValues: Record<string, string>, res: Response) {
  const entity = findEntity(entitySet, keyValues);
  if (!entity) return res.status(404).json(odataError('404', 'Entity not found'));
  res.json(odataSingle(entitySet, entity));
}

function handlePost(entitySet: string, req: Request, res: Response) {
  const newEntity = req.body;
  store[entitySet].push(newEntity);
  saveState();
  res.status(201).json(odataSingle(entitySet, newEntity));
}

function handlePatch(entitySet: string, keyValues: Record<string, string>, req: Request, res: Response) {
  const entity = findEntity(entitySet, keyValues);
  if (!entity) return res.status(404).json(odataError('404', 'Entity not found'));
  Object.assign(entity, req.body);
  saveState();
  res.json(odataSingle(entitySet, entity));
}

function handleDelete(entitySet: string, keyValues: Record<string, string>, res: Response) {
  const keyFields = KEY_MAP[entitySet]!;
  const idx = store[entitySet].findIndex(row =>
    keyFields.every(k => String(row[k]) === keyValues[k])
  );
  if (idx === -1) return res.status(404).json(odataError('404', 'Entity not found'));
  store[entitySet].splice(idx, 1);
  saveState();
  res.status(204).send();
}

// ─── Mount the catalog router ───
app.use('/odata/v4/catalog', catalogRouter);

// ─── Health & Admin ───
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'SAP BTP Mock OData V4',
    port: PORT,
    entities: Object.keys(store).map(k => ({ name: k, count: store[k].length })),
    uptime: process.uptime(),
  });
});

app.post('/admin/reset', (_req: Request, res: Response) => {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  Object.keys(store).forEach(k => delete store[k]);
  loadAllData();
  res.json({ message: 'Data reset to CSV defaults', entities: Object.keys(store).length });
});

// ═══════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════
console.log('');
console.log('  ╔══════════════════════════════════════════════╗');
console.log('  ║   SAP BTP Mock OData V4 Service             ║');
console.log('  ║   Pure Express — Zero Native Dependencies   ║');
console.log('  ╚══════════════════════════════════════════════╝');
console.log('');

if (!loadPersistedState()) {
  loadAllData();
}

console.log('');
app.listen(PORT, () => {
  console.log(`  🚀 Server running at http://localhost:${PORT}`);
  console.log(`  📡 OData endpoint: http://localhost:${PORT}/odata/v4/catalog`);
  console.log(`  ❤️  Health check:   http://localhost:${PORT}/health`);
  console.log('');
  console.log('  Example queries:');
  console.log(`    GET  /odata/v4/catalog/Materials`);
  console.log(`    GET  /odata/v4/catalog/Materials('MAT-10001')`);
  console.log(`    GET  /odata/v4/catalog/PurchaseOrders?$filter=status eq 'pending'`);
  console.log(`    PATCH /odata/v4/catalog/Materials('MAT-10001')  { "currentStock": 500 }`);
  console.log(`    POST  /odata/v4/catalog/Materials  { ... }`);
  console.log('');
});

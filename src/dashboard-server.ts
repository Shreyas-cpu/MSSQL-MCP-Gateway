import express from 'express';
import cors from 'cors';
import path from 'path';
import { MockERPAdapter } from './adapters/mock-adapter.js';
import { FakeStoreAdapter } from './adapters/fakestore-adapter.js';
import { AuditLogger } from './middleware/audit-logger.js';

const app = express();
const adapter = new MockERPAdapter();
const fakeAdapter = new FakeStoreAdapter();
const audit = new AuditLogger();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

function getAdapter(req: express.Request) {
  return req.headers['x-adapter'] === 'FakeStoreAdapter' ? fakeAdapter : adapter;
}

// ─── API Routes (mirror MCP tools as REST) ───
app.get('/api/purchase-orders', async (req, res) => {
  const data = await getAdapter(req).getPurchaseOrders({
    status: req.query.status as string, vendor: req.query.vendor as string,
    plant: req.query.plant as string, days: req.query.days ? parseInt(req.query.days as string) : undefined,
  });
  res.json({ tool: 'get_purchase_orders', count: data.length, data });
});

app.get('/api/inventory', async (req, res) => {
  const data = await getAdapter(req).queryInventory({
    materialId: req.query.material_id as string, plant: req.query.plant as string,
    belowReorder: req.query.below_reorder === 'true',
  });
  res.json({ tool: 'query_inventory', count: data.length, data });
});

app.get('/api/vendors', async (req, res) => {
  const data = await getAdapter(req).getVendorDetails(req.query.vendor_id as string, req.query.vendor_name as string);
  res.json({ tool: 'get_vendor_details', count: data.length, data });
});

app.get('/api/sales-orders', async (req, res) => {
  const data = await getAdapter(req).getSalesOrders({
    customer: req.query.customer as string, status: req.query.status as string,
  });
  res.json({ tool: 'get_sales_orders', count: data.length, data });
});

app.get('/api/delivery-status', async (req, res) => {
  const data = await getAdapter(req).checkDeliveryStatus(req.query.delivery_id as string, req.query.sales_order_id as string);
  res.json({ tool: 'check_delivery_status', count: data.length, data });
});

app.get('/api/open-items', async (req, res) => {
  const data = await getAdapter(req).getOpenItems({
    companyCode: req.query.company_code as string, type: req.query.type as 'AP' | 'AR',
    overdue: req.query.overdue === 'true',
  });
  res.json({ tool: 'get_open_items', count: data.length, data });
});

app.get('/api/budget-variance', async (req, res) => {
  const data = await getAdapter(req).queryBudgetVariance({
    costCenter: req.query.cost_center as string, period: req.query.period as string,
  });
  res.json({ tool: 'query_budget_variance', count: data.length, data });
});

app.get('/api/work-orders', async (req, res) => {
  const data = await getAdapter(req).getWorkOrders({
    status: req.query.status as string, plant: req.query.plant as string,
    priority: req.query.priority as string,
  });
  res.json({ tool: 'get_work_orders', count: data.length, data });
});

app.get('/api/pending-approvals', async (req, res) => {
  const data = await getAdapter(req).getPendingApprovals({
    module: req.query.module as string, priority: req.query.priority as string,
  });
  res.json({ tool: 'get_pending_approvals', count: data.length, data });
});

app.post('/api/approve', async (req, res) => {
  const { item_id, action, reason } = req.body;
  const activeAdapter = getAdapter(req);
  const result = await activeAdapter.approveWorkflowItem(item_id, action, reason);
  audit.log({ timestamp: new Date().toISOString(), tool: 'approve_workflow_item', params: req.body, userId: 'dashboard_user', result: result.success ? 'success' : 'error', durationMs: 0, adapter: activeAdapter.name });
  res.json(result);
});

app.get('/api/report', async (req, res) => {
  const data = await getAdapter(req).generateBusinessReport(
    req.query.type as string || 'procurement_spend',
    req.query.period as string || 'May 2026',
    req.query.entity as string,
  );
  res.json(data);
});

app.get('/api/audit-log', (_req, res) => {
  res.json(audit.getRecentEntries());
});

app.listen(PORT, () => {
  console.log(`\n  SAP·MCP Dashboard Server`);
  console.log(`  ─────────────────────────`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Adapter: ${adapter.name}`);
  console.log(`  API:     12 endpoints ready\n`);
});

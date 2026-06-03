import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { FakeStoreAdapter } from './adapters/fakestore-adapter.js';
import { AuditLogger } from './middleware/audit-logger.js';

// ═══════════════════════════════════════════════════════
// SAP·MCP Intelligence Gateway — Server Entry Point
// ═══════════════════════════════════════════════════════

const adapter = new FakeStoreAdapter();
const audit = new AuditLogger();

const server = new McpServer({
  name: 'SAP-MCP-Gateway',
  version: '1.0.0',
});

// ─── Helper: wrap tool execution with audit logging ───
async function withAudit<T>(tool: string, params: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    audit.log({ timestamp: new Date().toISOString(), tool, params, userId: 'mcp_agent', result: 'success', durationMs: Date.now() - start, adapter: adapter.name });
    return result;
  } catch (err) {
    audit.log({ timestamp: new Date().toISOString(), tool, params, userId: 'mcp_agent', result: 'error', durationMs: Date.now() - start, adapter: adapter.name });
    throw err;
  }
}

// ═══════════════════════════════════════════════════════
// TOOL 1: get_purchase_orders (MM)
// ═══════════════════════════════════════════════════════
server.tool(
  'get_purchase_orders',
  'Retrieve purchase orders filtered by status, date range, vendor, or material. Returns structured list with amounts and approval state.',
  {
    status: z.enum(['open', 'pending', 'approved', 'rejected', 'completed']).optional().describe('Filter by PO status'),
    vendor_id: z.string().optional().describe('Filter by vendor ID (e.g. V-1001)'),
    material_id: z.string().optional().describe('Filter by material ID'),
    plant: z.string().optional().describe('Filter by plant code'),
    date_from: z.string().optional().describe('Filter POs created on or after this date (YYYY-MM-DD)'),
    days: z.number().optional().describe('Show POs from the last N days'),
  },
  async (params) => {
    const data = await withAudit('get_purchase_orders', params, () =>
      adapter.getPurchaseOrders({
        status: params.status, vendor: params.vendor_id, material: params.material_id,
        plant: params.plant, dateFrom: params.date_from, days: params.days,
      })
    );
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'get_purchase_orders', count: data.length, data }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// TOOL 2: query_inventory (MM/WM)
// ═══════════════════════════════════════════════════════
server.tool(
  'query_inventory',
  'Check stock levels for materials across plants. Returns quantity, unit, reorder point, and shortage status.',
  {
    material_id: z.string().optional().describe('Material ID to look up'),
    plant: z.string().optional().describe('Plant code to filter by'),
    below_reorder: z.boolean().optional().describe('Only show items below reorder point'),
  },
  async (params) => {
    const data = await withAudit('query_inventory', params, () =>
      adapter.queryInventory({ materialId: params.material_id, plant: params.plant, belowReorder: params.below_reorder })
    );
    const shortages = data.filter(m => m.currentStock < m.reorderPoint);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'query_inventory', count: data.length, shortageCount: shortages.length, data }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// TOOL 3: get_vendor_details (MM)
// ═══════════════════════════════════════════════════════
server.tool(
  'get_vendor_details',
  'Vendor master record including payment terms, open orders, contact, and compliance status.',
  {
    vendor_id: z.string().optional().describe('Vendor ID (e.g. V-1001)'),
    vendor_name: z.string().optional().describe('Search vendor by name (partial match)'),
  },
  async (params) => {
    const data = await withAudit('get_vendor_details', params, () =>
      adapter.getVendorDetails(params.vendor_id, params.vendor_name)
    );
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'get_vendor_details', count: data.length, data }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// TOOL 4: get_goods_receipts (MM)
// ═══════════════════════════════════════════════════════
server.tool(
  'get_goods_receipts',
  'Goods receipts posted against POs in a date range. Used to reconcile deliveries vs orders.',
  {
    po_id: z.string().optional().describe('Purchase order number'),
    plant: z.string().optional().describe('Plant code'),
    date_from: z.string().optional().describe('Posting date from (YYYY-MM-DD)'),
  },
  async (params) => {
    const data = await withAudit('get_goods_receipts', params, () =>
      adapter.getGoodsReceipts(params.po_id, params.plant, params.date_from)
    );
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'get_goods_receipts', count: data.length, data }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// TOOL 5: get_sales_orders (SD)
// ═══════════════════════════════════════════════════════
server.tool(
  'get_sales_orders',
  'Customer sales orders with status, delivery date, and billing state. Filter by customer or date.',
  {
    customer_id: z.string().optional().describe('Customer ID or name'),
    status: z.enum(['open', 'in-process', 'delivered', 'billed', 'cancelled']).optional().describe('Order status'),
    date_from: z.string().optional().describe('Orders from date (YYYY-MM-DD)'),
  },
  async (params) => {
    const data = await withAudit('get_sales_orders', params, () =>
      adapter.getSalesOrders({ customer: params.customer_id, status: params.status, dateFrom: params.date_from })
    );
    const totalValue = data.reduce((s, o) => s + o.netValue, 0);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'get_sales_orders', count: data.length, totalValue, data }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// TOOL 6: check_delivery_status (SD)
// ═══════════════════════════════════════════════════════
server.tool(
  'check_delivery_status',
  'Current delivery status and tracking for open sales order deliveries.',
  {
    delivery_id: z.string().optional().describe('Delivery number'),
    sales_order_id: z.string().optional().describe('Sales order number'),
  },
  async (params) => {
    const data = await withAudit('check_delivery_status', params, () =>
      adapter.checkDeliveryStatus(params.delivery_id, params.sales_order_id)
    );
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'check_delivery_status', count: data.length, data }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// TOOL 7: get_open_items (FI)
// ═══════════════════════════════════════════════════════
server.tool(
  'get_open_items',
  'Open AP/AR line items with aging analysis. Filter by overdue status or business partner.',
  {
    company_code: z.string().optional().describe('Company code'),
    type: z.enum(['AP', 'AR']).optional().describe('AP (payables) or AR (receivables)'),
    overdue: z.boolean().optional().describe('Show only overdue items'),
    vendor_id: z.string().optional().describe('Filter by vendor'),
    customer_id: z.string().optional().describe('Filter by customer'),
  },
  async (params) => {
    const data = await withAudit('get_open_items', params, () =>
      adapter.getOpenItems({ companyCode: params.company_code, type: params.type, overdue: params.overdue, vendor: params.vendor_id, customer: params.customer_id })
    );
    const total = data.reduce((s, i) => s + i.amount, 0);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'get_open_items', count: data.length, totalAmount: total, data }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// TOOL 8: query_budget_variance (CO)
// ═══════════════════════════════════════════════════════
server.tool(
  'query_budget_variance',
  'Budget vs actual variance by cost center with drill-down into cost elements.',
  {
    cost_center: z.string().optional().describe('Cost center ID (e.g. CC-1010)'),
    period: z.string().optional().describe('Fiscal period (e.g. 05)'),
    fiscal_year: z.string().optional().describe('Fiscal year (e.g. 2026)'),
  },
  async (params) => {
    const data = await withAudit('query_budget_variance', params, () =>
      adapter.queryBudgetVariance({ costCenter: params.cost_center, period: params.period, fiscalYear: params.fiscal_year })
    );
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'query_budget_variance', count: data.length, data }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// TOOL 9: get_pending_approvals (WF)
// ═══════════════════════════════════════════════════════
server.tool(
  'get_pending_approvals',
  'All workflow items pending action — sorted by urgency, value, and overdue status.',
  {
    user_id: z.string().optional().describe('Filter by requestor user ID'),
    module: z.string().optional().describe('Filter by SAP module (MM, FI, CO, HR)'),
    priority: z.enum(['high', 'medium', 'low']).optional().describe('Filter by priority'),
  },
  async (params) => {
    const data = await withAudit('get_pending_approvals', params, () =>
      adapter.getPendingApprovals({ userId: params.user_id, module: params.module, priority: params.priority })
    );
    const overdue = data.filter(w => w.overdue);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'get_pending_approvals', count: data.length, overdueCount: overdue.length, data }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// TOOL 10: approve_workflow_item (WF)
// ═══════════════════════════════════════════════════════
server.tool(
  'approve_workflow_item',
  'Approve or reject a workflow item. Reason required for reject. Full audit log entry created.',
  {
    item_id: z.string().describe('Workflow item ID (e.g. WF-0001)'),
    action: z.enum(['approve', 'reject']).describe('Action to take'),
    reason: z.string().optional().describe('Reason (required for rejection)'),
  },
  async (params) => {
    if (params.action === 'reject' && !params.reason) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Reason is required when rejecting a workflow item' }) }] };
    }
    const result = await withAudit('approve_workflow_item', params, () =>
      adapter.approveWorkflowItem(params.item_id, params.action, params.reason)
    );
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'approve_workflow_item', ...result }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// TOOL 11: generate_business_report (FI/CO)
// ═══════════════════════════════════════════════════════
server.tool(
  'generate_business_report',
  'Structured business summary — procurement spend, cost center P&L, or open items report for a given period.',
  {
    report_type: z.enum(['procurement_spend', 'cost_center_pl', 'open_items']).describe('Type of report'),
    period: z.string().describe('Report period (e.g. "May 2026", "Q2 2026")'),
    entity: z.string().optional().describe('Entity to filter by (cost center ID, vendor ID, etc.)'),
  },
  async (params) => {
    const data = await withAudit('generate_business_report', params, () =>
      adapter.generateBusinessReport(params.report_type, params.period, params.entity)
    );
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'generate_business_report', ...data }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// TOOL 12: get_work_orders (PM)
// ═══════════════════════════════════════════════════════
server.tool(
  'get_work_orders',
  'Plant maintenance work orders — open, overdue, or scheduled. Filter by equipment or work center.',
  {
    equipment_id: z.string().optional().describe('Equipment ID'),
    status: z.enum(['open', 'in-progress', 'completed', 'cancelled']).optional().describe('Work order status'),
    plant: z.string().optional().describe('Plant code'),
    priority: z.enum(['high', 'medium', 'low']).optional().describe('Priority level'),
  },
  async (params) => {
    const data = await withAudit('get_work_orders', params, () =>
      adapter.getWorkOrders({ equipmentId: params.equipment_id, status: params.status, plant: params.plant, priority: params.priority })
    );
    return { content: [{ type: 'text' as const, text: JSON.stringify({ tool: 'get_work_orders', count: data.length, data }, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════
async function main() {
  const transport = new StdioServerTransport();
  console.error('SAP·MCP Intelligence Gateway v1.0.0');
  console.error(`Adapter: ${adapter.name}`);
  console.error('12 tools registered · stdio transport');
  console.error('Waiting for MCP client connection...');
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

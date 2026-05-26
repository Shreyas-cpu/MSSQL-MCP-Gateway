import { ERPAdapterInterface } from './erp-adapter.js';
import {
  PurchaseOrder, Vendor, Material, GoodsReceipt,
  SalesOrder, DeliveryStatus, OpenItem,
  BudgetVariance, WorkOrder, WarehouseStock,
  WorkflowItem, BusinessReport,
  POFilter, InventoryFilter, SOFilter,
  OpenItemFilter, BudgetFilter, WorkOrderFilter, WorkflowFilter
} from '../types/sap.js';
import { PURCHASE_ORDERS, VENDORS, MATERIALS, GOODS_RECEIPTS } from '../mock-data/mm-data.js';
import { SALES_ORDERS, DELIVERY_STATUS, OPEN_ITEMS, BUDGET_DATA, WORK_ORDERS, WAREHOUSE_STOCK, WORKFLOW_ITEMS } from '../mock-data/other-data.js';

/**
 * Mock ERP Adapter — returns realistic in-memory SAP data.
 * Drop-in replacement for LiveRFCAdapter / LiveODataAdapter.
 */
export class MockERPAdapter extends ERPAdapterInterface {
  readonly name = 'MockERPAdapter';

  // Mutable copy so approvals persist during session
  private workflowItems = [...WORKFLOW_ITEMS];

  // ─── MM ───
  async getPurchaseOrders(filter: POFilter): Promise<PurchaseOrder[]> {
    let results = [...PURCHASE_ORDERS];
    if (filter.status) results = results.filter(po => po.status === filter.status);
    if (filter.vendor) results = results.filter(po => po.vendor === filter.vendor);
    if (filter.material) results = results.filter(po => po.material === filter.material);
    if (filter.plant) results = results.filter(po => po.plant === filter.plant);
    if (filter.dateFrom) results = results.filter(po => po.createdDate >= filter.dateFrom!);
    if (filter.dateTo) results = results.filter(po => po.createdDate <= filter.dateTo!);
    if (filter.days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - filter.days);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      results = results.filter(po => po.createdDate >= cutoffStr);
    }
    return results;
  }

  async getVendorDetails(vendorId?: string, vendorName?: string): Promise<Vendor[]> {
    if (vendorId) return VENDORS.filter(v => v.vendorId === vendorId);
    if (vendorName) return VENDORS.filter(v => v.name.toLowerCase().includes(vendorName.toLowerCase()));
    return VENDORS;
  }

  async queryInventory(filter: InventoryFilter): Promise<Material[]> {
    let results = [...MATERIALS];
    if (filter.materialId) results = results.filter(m => m.materialId === filter.materialId);
    if (filter.plant) results = results.filter(m => m.plant === filter.plant);
    if (filter.storageLocation) results = results.filter(m => m.storageLocation === filter.storageLocation);
    if (filter.belowReorder) results = results.filter(m => m.currentStock < m.reorderPoint);
    return results;
  }

  async getGoodsReceipts(poId?: string, plant?: string, dateFrom?: string): Promise<GoodsReceipt[]> {
    let results = [...GOODS_RECEIPTS];
    if (poId) results = results.filter(gr => gr.poNumber === poId);
    if (plant) results = results.filter(gr => gr.plant === plant);
    if (dateFrom) results = results.filter(gr => gr.postingDate >= dateFrom);
    return results;
  }

  // ─── SD ───
  async getSalesOrders(filter: SOFilter): Promise<SalesOrder[]> {
    let results = [...SALES_ORDERS];
    if (filter.customer) results = results.filter(so => so.customer === filter.customer || so.customerName.toLowerCase().includes(filter.customer!.toLowerCase()));
    if (filter.status) results = results.filter(so => so.status === filter.status);
    if (filter.dateFrom) results = results.filter(so => so.orderDate >= filter.dateFrom!);
    if (filter.plant) results = results.filter(so => so.plant === filter.plant);
    return results;
  }

  async checkDeliveryStatus(deliveryId?: string, salesOrderId?: string): Promise<DeliveryStatus[]> {
    if (deliveryId) return DELIVERY_STATUS.filter(d => d.deliveryNumber === deliveryId);
    if (salesOrderId) return DELIVERY_STATUS.filter(d => d.salesOrder === salesOrderId);
    return DELIVERY_STATUS;
  }

  // ─── FI ───
  async getOpenItems(filter: OpenItemFilter): Promise<OpenItem[]> {
    let results = [...OPEN_ITEMS];
    if (filter.companyCode) results = results.filter(i => i.companyCode === filter.companyCode);
    if (filter.type) results = results.filter(i => i.type === filter.type);
    if (filter.overdue) results = results.filter(i => i.overdueDays > 0);
    if (filter.vendor) results = results.filter(i => i.vendor === filter.vendor);
    if (filter.customer) results = results.filter(i => i.customer === filter.customer);
    return results;
  }

  // ─── CO ───
  async queryBudgetVariance(filter: BudgetFilter): Promise<BudgetVariance[]> {
    let results = [...BUDGET_DATA];
    if (filter.costCenter) results = results.filter(b => b.costCenter === filter.costCenter);
    if (filter.period) results = results.filter(b => b.period === filter.period);
    if (filter.fiscalYear) results = results.filter(b => b.fiscalYear === filter.fiscalYear);
    return results;
  }

  // ─── PM ───
  async getWorkOrders(filter: WorkOrderFilter): Promise<WorkOrder[]> {
    let results = [...WORK_ORDERS];
    if (filter.equipmentId) results = results.filter(wo => wo.equipmentId === filter.equipmentId);
    if (filter.status) results = results.filter(wo => wo.status === filter.status);
    if (filter.plant) results = results.filter(wo => wo.plant === filter.plant);
    if (filter.priority) results = results.filter(wo => wo.priority === filter.priority);
    return results;
  }

  // ─── WM ───
  async getWarehouseStock(materialId?: string, plant?: string): Promise<WarehouseStock[]> {
    let results = [...WAREHOUSE_STOCK];
    if (materialId) results = results.filter(s => s.materialId === materialId);
    if (plant) results = results.filter(s => s.plant === plant);
    return results;
  }

  // ─── WF ───
  async getPendingApprovals(filter: WorkflowFilter): Promise<WorkflowItem[]> {
    let results = this.workflowItems.filter(w => w.status === 'pending');
    if (filter.userId) results = results.filter(w => w.requestor === filter.userId);
    if (filter.module) results = results.filter(w => w.module === filter.module);
    if (filter.priority) results = results.filter(w => w.priority === filter.priority);
    return results;
  }

  async approveWorkflowItem(itemId: string, action: 'approve' | 'reject', reason?: string) {
    const item = this.workflowItems.find(w => w.itemId === itemId);
    if (!item) return { success: false, message: `Workflow item ${itemId} not found`, itemId };
    if (item.status !== 'pending') return { success: false, message: `Item ${itemId} is already ${item.status}`, itemId };

    item.status = action === 'approve' ? 'approved' : 'rejected';
    if (reason) item.notes = reason;

    return {
      success: true,
      message: `Workflow item ${itemId} has been ${item.status}. ${reason ? `Reason: ${reason}` : ''}`,
      itemId
    };
  }

  // ─── Reports ───
  async generateBusinessReport(reportType: string, period: string, entity?: string): Promise<BusinessReport> {
    const now = new Date().toISOString();

    if (reportType === 'procurement_spend') {
      const pos = PURCHASE_ORDERS.filter(po => po.status !== 'rejected');
      const totalSpend = pos.reduce((sum, po) => sum + po.netPrice, 0);
      return {
        reportType, title: 'Procurement Spend Summary', period, generatedAt: now,
        summary: `Total procurement spend: ₹${(totalSpend/100000).toFixed(2)}L across ${pos.length} purchase orders`,
        data: pos.map(po => ({ vendor: po.vendorName, amount: po.netPrice, material: po.materialDescription, status: po.status })),
        totals: { totalSpend, orderCount: pos.length, avgOrderValue: Math.round(totalSpend / pos.length) }
      };
    }

    if (reportType === 'open_items') {
      const items = OPEN_ITEMS;
      const totalAP = items.filter(i => i.type === 'AP').reduce((s, i) => s + i.amount, 0);
      const totalAR = items.filter(i => i.type === 'AR').reduce((s, i) => s + i.amount, 0);
      const overdue = items.filter(i => i.overdueDays > 0);
      return {
        reportType, title: 'Open Items Report', period, generatedAt: now,
        summary: `AP: ₹${(totalAP/100000).toFixed(2)}L | AR: ₹${(totalAR/100000).toFixed(2)}L | ${overdue.length} overdue items`,
        data: items.map(i => ({ name: i.name, type: i.type, amount: i.amount, dueDate: i.dueDate, overdueDays: i.overdueDays })),
        totals: { totalAP, totalAR, overdueCount: overdue.length, netPosition: totalAR - totalAP }
      };
    }

    // Default: cost center P&L
    const budget = entity ? BUDGET_DATA.filter(b => b.costCenter === entity) : BUDGET_DATA;
    const totalPlanned = budget.reduce((s, b) => s + b.plannedAmount, 0);
    const totalActual = budget.reduce((s, b) => s + b.actualAmount, 0);
    return {
      reportType: 'cost_center_pl', title: 'Cost Center P&L Report', period, generatedAt: now,
      summary: `Planned: ₹${(totalPlanned/100000).toFixed(2)}L | Actual: ₹${(totalActual/100000).toFixed(2)}L | Variance: ₹${((totalPlanned-totalActual)/100000).toFixed(2)}L`,
      data: budget.map(b => ({ costCenter: b.costCenter, name: b.costCenterName, planned: b.plannedAmount, actual: b.actualAmount, variance: b.variance })),
      totals: { totalPlanned, totalActual, totalVariance: totalPlanned - totalActual }
    };
  }
}

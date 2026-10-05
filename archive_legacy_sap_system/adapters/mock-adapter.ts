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
import * as fs from 'fs';
import * as path from 'path';

const STATE_FILE = path.join(__dirname, '..', '..', 'audit-logs', 'workflow-state.json');

/**
 * Mock ERP Adapter — returns realistic in-memory SAP data.
 * Drop-in replacement for LiveRFCAdapter / LiveODataAdapter.
 */
export class MockERPAdapter extends ERPAdapterInterface {
  readonly name = 'MockERPAdapter';

  private loadWorkflowItems(): WorkflowItem[] {
    try {
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('Error loading workflow items from state file:', err);
    }
    // Fallback/initialization
    this.saveWorkflowItems(WORKFLOW_ITEMS);
    return [...WORKFLOW_ITEMS];
  }

  private saveWorkflowItems(items: WorkflowItem[]): void {
    try {
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(items, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving workflow items to state file:', err);
    }
  }

  // ─── MM ───
  async getPurchaseOrders(filter: POFilter): Promise<PurchaseOrder[]> {
    let results = [...PURCHASE_ORDERS];
    if (filter.status) results = results.filter(po => po.status === filter.status);
    if (filter.vendor) results = results.filter(po => po.vendor === filter.vendor);
    if (filter.material) results = results.filter(po => po.material === filter.material);
    if (filter.plant) results = results.filter(po => po.plant.toString() === filter.plant);
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

  async createPurchaseOrder(po: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    const poNumber = po.poNumber || `4500${Math.floor(100000 + Math.random() * 900000)}`;
    const newPo = { ...po, poNumber, status: 'pending', createdDate: new Date().toISOString().split('T')[0] } as PurchaseOrder;
    PURCHASE_ORDERS.push(newPo);
    return newPo;
  }

  async getVendorDetails(vendorId?: string, vendorName?: string): Promise<Vendor[]> {
    if (vendorId) return VENDORS.filter(v => v.vendorId === vendorId);
    if (vendorName) return VENDORS.filter(v => v.name.toLowerCase().includes(vendorName.toLowerCase()));
    return VENDORS;
  }

  async queryInventory(filter: InventoryFilter): Promise<Material[]> {
    let result = MATERIALS;
    if (filter.materialId) result = result.filter(m => m.materialId === filter.materialId);
    if (filter.plant) result = result.filter(m => m.plant.toString() === filter.plant);
    if (filter.belowReorder) result = result.filter(m => m.currentStock < m.reorderPoint);
    return result;
  }

  async updateStock(materialId: string, quantity: number): Promise<boolean> {
    const mat = MATERIALS.find(m => m.materialId === materialId);
    if (!mat) return false;
    mat.currentStock = quantity;
    return true;
  }

  async getGoodsReceipts(poId?: string, plant?: string, dateFrom?: string): Promise<GoodsReceipt[]> {
    let results = [...GOODS_RECEIPTS];
    if (poId) results = results.filter(g => g.poNumber === poId);
    if (plant) results = results.filter(g => g.plant.toString() === plant);
    if (dateFrom) results = results.filter(g => g.postingDate >= dateFrom);
    return results;
  }

  async postGoodsReceipt(receipt: Partial<GoodsReceipt>): Promise<GoodsReceipt> {
    const grNumber = receipt.grNumber || `5000${Math.floor(100000 + Math.random() * 900000)}`;
    const newGr = { ...receipt, grNumber, postingDate: new Date().toISOString().split('T')[0] } as GoodsReceipt;
    GOODS_RECEIPTS.push(newGr);
    return newGr;
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
    let results = [...DELIVERY_STATUS];
    if (deliveryId) results = results.filter(d => d.deliveryNumber === deliveryId);
    if (salesOrderId) results = results.filter(d => d.salesOrder === salesOrderId);
    return results;
  }

  async updateDeliveryStatus(deliveryId: string, status: string): Promise<boolean> {
    const d = DELIVERY_STATUS.find(x => x.deliveryNumber === deliveryId);
    if (!d) return false;
    d.status = status as any;
    return true;
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
    let results = this.loadWorkflowItems().filter(w => w.status === 'pending');
    if (filter.userId) results = results.filter(w => w.requestor === filter.userId);
    if (filter.module) results = results.filter(w => w.module === filter.module);
    if (filter.priority) results = results.filter(w => w.priority === filter.priority);
    return results;
  }

  async approveWorkflowItem(itemId: string, action: 'approve' | 'reject', reason?: string) {
    const items = this.loadWorkflowItems();
    const item = items.find(w => w.itemId === itemId);
    if (!item) return { success: false, message: `Workflow item ${itemId} not found`, itemId };
    if (item.status !== 'pending') return { success: false, message: `Item ${itemId} is already ${item.status}`, itemId };

    item.status = action === 'approve' ? 'approved' : 'rejected';
    if (reason) item.notes = reason;

    this.saveWorkflowItems(items);

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

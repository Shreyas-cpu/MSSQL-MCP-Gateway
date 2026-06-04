import { ERPAdapterInterface } from './erp-adapter.js';
import {
  PurchaseOrder, Vendor, Material, GoodsReceipt,
  SalesOrder, DeliveryStatus, OpenItem,
  BudgetVariance, WorkOrder, WarehouseStock,
  WorkflowItem, BusinessReport,
  POFilter, InventoryFilter, SOFilter,
  OpenItemFilter, BudgetFilter, WorkOrderFilter, WorkflowFilter
} from '../types/sap.js';

export class BtpAdapter extends ERPAdapterInterface {
  readonly name = 'BtpAdapter (SAP BTP OData Mock)';
  
  // Pointing to our newly deployed live BTP mock server in the cloud!
  private baseUrl = 'https://btp-mock-service-appreciative-meerkat-eb.cfapps.ap21.hana.ondemand.com/odata/v4/catalog';

  private async fetchOData<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options?.headers
        }
      });
      if (!response.ok) {
        throw new Error(`BTP OData request failed: ${response.status} ${response.statusText}`);
      }
      // DELETE requests return 204 No Content
      if (response.status === 204) return {} as T;
      return await response.json();
    } catch (error: any) {
      console.error(`Error communicating with BTP Mock Service at ${url}:`, error);
      const causeStr = error.cause ? ` (Cause: ${error.cause.message || error.cause.code || error.cause})` : '';
      throw new Error(`BTP Mock Service communication failed: ${error.message}${causeStr}`);
    }
  }

  // ─── MM ───
  async getPurchaseOrders(filter: POFilter): Promise<PurchaseOrder[]> {
    let query = 'PurchaseOrders';
    const conditions: string[] = [];
    if (filter.status) conditions.push(`status eq '${filter.status}'`);
    if (filter.vendor) conditions.push(`vendor eq '${filter.vendor}'`);
    if (filter.material) conditions.push(`material eq '${filter.material}'`);
    if (filter.plant) conditions.push(`plant eq '${filter.plant}'`);
    
    if (conditions.length > 0) {
      query += `?$filter=${conditions.join(' and ')}`;
    }
    const data = await this.fetchOData<{ value: PurchaseOrder[] }>(query);
    return data.value;
  }

  async createPurchaseOrder(po: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    // Auto-generate PO number if not provided
    const poNumber = po.poNumber || `4500${Math.floor(100000 + Math.random() * 900000)}`;
    const newPo = { ...po, poNumber, status: 'pending', createdDate: new Date().toISOString().split('T')[0] };
    const data = await this.fetchOData<PurchaseOrder>('PurchaseOrders', {
      method: 'POST',
      body: JSON.stringify(newPo)
    });
    return data;
  }

  async getVendorDetails(vendorId?: string, vendorName?: string): Promise<Vendor[]> {
    let query = 'Vendors';
    const conditions: string[] = [];
    if (vendorId) conditions.push(`vendorId eq '${vendorId}'`);
    // Note: OData $filter substringof/contains is not fully mocked, 
    // so we'll fetch all and filter in memory for name searches if needed.
    const data = await this.fetchOData<{ value: Vendor[] }>(query);
    let results = data.value;
    
    if (vendorName) {
      const search = vendorName.toLowerCase();
      results = results.filter(v => v.name.toLowerCase().includes(search));
    }
    return results;
  }

  async queryInventory(filter: InventoryFilter): Promise<Material[]> {
    let query = 'Materials';
    const conditions: string[] = [];
    if (filter.materialId) conditions.push(`materialId eq '${filter.materialId}'`);
    if (filter.plant) conditions.push(`plant eq '${filter.plant}'`);
    if (filter.storageLocation) conditions.push(`storageLocation eq '${filter.storageLocation}'`);
    
    if (conditions.length > 0) {
      query += `?$filter=${conditions.join(' and ')}`;
    }
    const data = await this.fetchOData<{ value: Material[] }>(query);
    let results = data.value;
    
    if (filter.belowReorder) {
      results = results.filter(m => m.currentStock < m.reorderPoint);
    }
    return results;
  }

  // 🔥 DIRECT DATA MANIPULATION (PATCH) 🔥
  async updateStock(materialId: string, quantity: number): Promise<boolean> {
    await this.fetchOData(`Materials('${materialId}')`, {
      method: 'PATCH',
      body: JSON.stringify({ currentStock: quantity })
    });
    return true;
  }

  async getGoodsReceipts(poId?: string, plant?: string, dateFrom?: string): Promise<GoodsReceipt[]> {
    let query = 'GoodsReceipts';
    const conditions: string[] = [];
    if (poId) conditions.push(`poNumber eq '${poId}'`);
    if (plant) conditions.push(`plant eq '${plant}'`);
    if (dateFrom) conditions.push(`postingDate ge '${dateFrom}'`);
    
    if (conditions.length > 0) query += `?$filter=${conditions.join(' and ')}`;
    const data = await this.fetchOData<{ value: GoodsReceipt[] }>(query);
    return data.value;
  }

  async postGoodsReceipt(receipt: Partial<GoodsReceipt>): Promise<GoodsReceipt> {
    const grNumber = receipt.grNumber || `5000${Math.floor(100000 + Math.random() * 900000)}`;
    const newGr = { ...receipt, grNumber, postingDate: new Date().toISOString().split('T')[0] };
    const data = await this.fetchOData<GoodsReceipt>('GoodsReceipts', {
      method: 'POST',
      body: JSON.stringify(newGr)
    });
    return data;
  }

  // ─── SD ───
  async getSalesOrders(filter: SOFilter): Promise<SalesOrder[]> {
    let query = 'SalesOrders';
    const conditions: string[] = [];
    if (filter.status) conditions.push(`status eq '${filter.status}'`);
    if (filter.plant) conditions.push(`plant eq '${filter.plant}'`);
    if (filter.dateFrom) conditions.push(`orderDate ge '${filter.dateFrom}'`);
    
    if (conditions.length > 0) query += `?$filter=${conditions.join(' and ')}`;
    const data = await this.fetchOData<{ value: SalesOrder[] }>(query);
    let results = data.value;
    
    if (filter.customer) {
      const search = filter.customer.toLowerCase();
      results = results.filter(so => so.customer === filter.customer || so.customerName.toLowerCase().includes(search));
    }
    return results;
  }

  async checkDeliveryStatus(deliveryId?: string, salesOrderId?: string): Promise<DeliveryStatus[]> {
    let query = 'DeliveryStatuses';
    const conditions: string[] = [];
    if (deliveryId) conditions.push(`deliveryNumber eq '${deliveryId}'`);
    if (salesOrderId) conditions.push(`salesOrder eq '${salesOrderId}'`);
    
    if (conditions.length > 0) query += `?$filter=${conditions.join(' and ')}`;
    const data = await this.fetchOData<{ value: DeliveryStatus[] }>(query);
    return data.value;
  }

  async updateDeliveryStatus(deliveryId: string, status: string): Promise<boolean> {
    await this.fetchOData(`DeliveryStatuses('${deliveryId}')`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return true;
  }

  // ─── FI ───
  async getOpenItems(filter: OpenItemFilter): Promise<OpenItem[]> {
    let query = 'OpenItems';
    const conditions: string[] = [];
    if (filter.companyCode) conditions.push(`companyCode eq '${filter.companyCode}'`);
    if (filter.type) conditions.push(`type eq '${filter.type}'`);
    if (filter.vendor) conditions.push(`vendor eq '${filter.vendor}'`);
    if (filter.customer) conditions.push(`customer eq '${filter.customer}'`);
    
    if (conditions.length > 0) query += `?$filter=${conditions.join(' and ')}`;
    const data = await this.fetchOData<{ value: OpenItem[] }>(query);
    let results = data.value;
    
    if (filter.overdue) {
      results = results.filter(i => i.overdueDays > 0);
    }
    return results;
  }

  // ─── CO ───
  async queryBudgetVariance(filter: BudgetFilter): Promise<BudgetVariance[]> {
    let query = 'BudgetVariances';
    const conditions: string[] = [];
    if (filter.costCenter) conditions.push(`costCenter eq '${filter.costCenter}'`);
    if (filter.period) conditions.push(`period eq '${filter.period}'`);
    if (filter.fiscalYear) conditions.push(`fiscalYear eq '${filter.fiscalYear}'`);
    
    if (conditions.length > 0) query += `?$filter=${conditions.join(' and ')}`;
    const data = await this.fetchOData<{ value: BudgetVariance[] }>(query);
    
    // We also fetch line items to attach to variances (simulating OData $expand)
    const lineItemsData = await this.fetchOData<{ value: any[] }>('BudgetLineItems');
    const allLines = lineItemsData.value;
    
    return data.value.map(variance => {
      variance.lineItems = allLines.filter(l => 
        l.costCenter === variance.costCenter && 
        l.period === variance.period && 
        l.fiscalYear === variance.fiscalYear
      );
      return variance;
    });
  }

  // ─── PM ───
  async getWorkOrders(filter: WorkOrderFilter): Promise<WorkOrder[]> {
    let query = 'WorkOrders';
    const conditions: string[] = [];
    if (filter.equipmentId) conditions.push(`equipmentId eq '${filter.equipmentId}'`);
    if (filter.status) conditions.push(`status eq '${filter.status}'`);
    if (filter.plant) conditions.push(`plant eq '${filter.plant}'`);
    if (filter.priority) conditions.push(`priority eq '${filter.priority}'`);
    
    if (conditions.length > 0) query += `?$filter=${conditions.join(' and ')}`;
    const data = await this.fetchOData<{ value: WorkOrder[] }>(query);
    return data.value;
  }

  // ─── WM ───
  async getWarehouseStock(materialId?: string, plant?: string): Promise<WarehouseStock[]> {
    let query = 'WarehouseStocks';
    const conditions: string[] = [];
    if (materialId) conditions.push(`materialId eq '${materialId}'`);
    if (plant) conditions.push(`plant eq '${plant}'`);
    
    if (conditions.length > 0) query += `?$filter=${conditions.join(' and ')}`;
    const data = await this.fetchOData<{ value: WarehouseStock[] }>(query);
    return data.value;
  }

  // ─── WF ───
  async getPendingApprovals(filter: WorkflowFilter): Promise<WorkflowItem[]> {
    let query = `WorkflowItems?$filter=status eq 'pending'`;
    if (filter.userId) query += ` and requestor eq '${filter.userId}'`;
    if (filter.module) query += ` and module eq '${filter.module}'`;
    if (filter.priority) query += ` and priority eq '${filter.priority}'`;
    
    const data = await this.fetchOData<{ value: WorkflowItem[] }>(query);
    return data.value;
  }

  async approveWorkflowItem(itemId: string, action: 'approve' | 'reject', reason?: string) {
    const status = action === 'approve' ? 'approved' : 'rejected';
    try {
      await this.fetchOData(`WorkflowItems('${itemId}')`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes: reason || '' })
      });
      return {
        success: true,
        message: `Workflow item ${itemId} has been ${status}. ${reason ? `Reason: ${reason}` : ''}`,
        itemId
      };
    } catch (err) {
      return { success: false, message: `Failed to update item ${itemId}`, itemId };
    }
  }

  // ─── Reports ───
  async generateBusinessReport(reportType: string, period: string, entity?: string): Promise<BusinessReport> {
    const now = new Date().toISOString();

    if (reportType === 'procurement_spend') {
      const pos = await this.getPurchaseOrders({});
      const activePOs = pos.filter(po => po.status !== 'rejected');
      const totalSpend = activePOs.reduce((sum, po) => sum + po.netPrice, 0);
      return {
        reportType, title: 'Procurement Spend Summary (from BTP)', period, generatedAt: now,
        summary: `Total procurement spend: ₹${(totalSpend/100000).toFixed(2)}L across ${activePOs.length} purchase orders`,
        data: activePOs.map(po => ({ vendor: po.vendorName, amount: po.netPrice, material: po.materialDescription, status: po.status })),
        totals: { totalSpend, orderCount: activePOs.length, avgOrderValue: activePOs.length ? Math.round(totalSpend / activePOs.length) : 0 }
      };
    }

    if (reportType === 'open_items') {
      const items = await this.getOpenItems({});
      const totalAP = items.filter(i => i.type === 'AP').reduce((s, i) => s + i.amount, 0);
      const totalAR = items.filter(i => i.type === 'AR').reduce((s, i) => s + i.amount, 0);
      const overdue = items.filter(i => i.overdueDays > 0);
      return {
        reportType, title: 'Open Items Report (from BTP)', period, generatedAt: now,
        summary: `AP: ₹${(totalAP/100000).toFixed(2)}L | AR: ₹${(totalAR/100000).toFixed(2)}L | ${overdue.length} overdue items`,
        data: items.map(i => ({ name: i.name, type: i.type, amount: i.amount, dueDate: i.dueDate, overdueDays: i.overdueDays })),
        totals: { totalAP, totalAR, overdueCount: overdue.length, netPosition: totalAR - totalAP }
      };
    }

    // Default: cost center P&L
    const allBudgets = await this.queryBudgetVariance({});
    const budget = entity ? allBudgets.filter(b => b.costCenter === entity) : allBudgets;
    const totalPlanned = budget.reduce((s, b) => s + b.plannedAmount, 0);
    const totalActual = budget.reduce((s, b) => s + b.actualAmount, 0);
    return {
      reportType: 'cost_center_pl', title: 'Cost Center P&L Report (from BTP)', period, generatedAt: now,
      summary: `Planned: ₹${(totalPlanned/100000).toFixed(2)}L | Actual: ₹${(totalActual/100000).toFixed(2)}L | Variance: ₹${((totalPlanned-totalActual)/100000).toFixed(2)}L`,
      data: budget.map(b => ({ costCenter: b.costCenter, name: b.costCenterName, planned: b.plannedAmount, actual: b.actualAmount, variance: b.variance })),
      totals: { totalPlanned, totalActual, totalVariance: totalPlanned - totalActual }
    };
  }
}

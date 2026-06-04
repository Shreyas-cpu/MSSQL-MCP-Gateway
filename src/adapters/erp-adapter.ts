import {
  PurchaseOrder, Vendor, Material, GoodsReceipt,
  SalesOrder, DeliveryStatus, OpenItem,
  BudgetVariance, WorkOrder, WarehouseStock,
  WorkflowItem, BusinessReport,
  POFilter, InventoryFilter, SOFilter,
  OpenItemFilter, BudgetFilter, WorkOrderFilter, WorkflowFilter
} from '../types/sap.js';

/**
 * Abstract ERP Adapter Interface
 * Both MockERPAdapter and LiveRFCAdapter implement this.
 * Tool handlers call these methods — they never know which adapter is active.
 */
export abstract class ERPAdapterInterface {
  abstract readonly name: string;

  // ─── Materials Management (MM) ───
  abstract getPurchaseOrders(filter: POFilter): Promise<PurchaseOrder[]>;
  abstract createPurchaseOrder(po: Partial<PurchaseOrder>): Promise<PurchaseOrder>;
  
  abstract getVendorDetails(vendorId?: string, vendorName?: string): Promise<Vendor[]>;
  
  abstract queryInventory(filter: InventoryFilter): Promise<Material[]>;
  abstract updateStock(materialId: string, quantity: number): Promise<boolean>;
  
  abstract getGoodsReceipts(poId?: string, plant?: string, dateFrom?: string): Promise<GoodsReceipt[]>;
  abstract postGoodsReceipt(receipt: Partial<GoodsReceipt>): Promise<GoodsReceipt>;

  // ─── Sales & Distribution (SD) ───
  abstract getSalesOrders(filter: SOFilter): Promise<SalesOrder[]>;
  
  abstract checkDeliveryStatus(deliveryId?: string, salesOrderId?: string): Promise<DeliveryStatus[]>;
  abstract updateDeliveryStatus(deliveryId: string, status: string): Promise<boolean>;

  // ─── Financial Accounting (FI) ───
  abstract getOpenItems(filter: OpenItemFilter): Promise<OpenItem[]>;

  // ─── Controlling (CO) ───
  abstract queryBudgetVariance(filter: BudgetFilter): Promise<BudgetVariance[]>;

  // ─── Plant Maintenance (PM) ───
  abstract getWorkOrders(filter: WorkOrderFilter): Promise<WorkOrder[]>;

  // ─── Warehouse Management (WM) ───
  abstract getWarehouseStock(materialId?: string, plant?: string): Promise<WarehouseStock[]>;

  // ─── Workflow (WF) ───
  abstract getPendingApprovals(filter: WorkflowFilter): Promise<WorkflowItem[]>;
  abstract approveWorkflowItem(itemId: string, action: 'approve' | 'reject', reason?: string): Promise<{ success: boolean; message: string; itemId: string }>;

  // ─── Reports ───
  abstract generateBusinessReport(reportType: string, period: string, entity?: string): Promise<BusinessReport>;
}

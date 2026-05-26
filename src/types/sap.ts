// ═══════════════════════════════════════════════════════
// SAP Data Type Interfaces
// All SAP entities used across modules
// ═══════════════════════════════════════════════════════

// ─── Materials Management (MM) ───
export interface PurchaseOrder {
  poNumber: string;
  vendor: string;
  vendorName: string;
  material: string;
  materialDescription: string;
  plant: string;
  quantity: number;
  unit: string;
  netPrice: number;
  currency: string;
  status: 'open' | 'pending' | 'approved' | 'rejected' | 'completed';
  createdDate: string;
  deliveryDate: string;
  createdBy: string;
  companyCode: string;
}

export interface Vendor {
  vendorId: string;
  name: string;
  country: string;
  city: string;
  paymentTerms: string;
  currency: string;
  contactPerson: string;
  email: string;
  phone: string;
  bankAccount: string;
  taxId: string;
  status: 'active' | 'blocked' | 'pending';
  totalOpenOrders: number;
  ytdSpend: number;
  rating: 'A' | 'B' | 'C' | 'D';
}

export interface Material {
  materialId: string;
  description: string;
  type: 'raw' | 'finished' | 'semi-finished' | 'spare' | 'consumable';
  unit: string;
  plant: string;
  storageLocation: string;
  currentStock: number;
  reorderPoint: number;
  safetyStock: number;
  standardPrice: number;
  currency: string;
  lastGoodsReceipt: string;
  materialGroup: string;
}

export interface GoodsReceipt {
  grNumber: string;
  poNumber: string;
  material: string;
  materialDescription: string;
  plant: string;
  quantity: number;
  unit: string;
  postingDate: string;
  vendor: string;
  vendorName: string;
  movementType: string;
  documentDate: string;
}

// ─── Sales & Distribution (SD) ───
export interface SalesOrder {
  orderNumber: string;
  customer: string;
  customerName: string;
  material: string;
  materialDescription: string;
  quantity: number;
  unit: string;
  netValue: number;
  currency: string;
  status: 'open' | 'in-process' | 'delivered' | 'billed' | 'cancelled';
  orderDate: string;
  requestedDeliveryDate: string;
  plant: string;
  salesOrg: string;
  distributionChannel: string;
}

export interface DeliveryStatus {
  deliveryNumber: string;
  salesOrder: string;
  customer: string;
  customerName: string;
  status: 'planned' | 'picked' | 'packed' | 'shipped' | 'delivered';
  shippingDate: string;
  estimatedArrival: string;
  carrier: string;
  trackingNumber: string;
  items: number;
  weight: number;
  weightUnit: string;
}

// ─── Financial Accounting (FI) ───
export interface OpenItem {
  documentNumber: string;
  companyCode: string;
  fiscalYear: string;
  type: 'AP' | 'AR';
  vendor?: string;
  customer?: string;
  name: string;
  amount: number;
  currency: string;
  postingDate: string;
  dueDate: string;
  overdueDays: number;
  paymentTerms: string;
  status: 'open' | 'partially-cleared' | 'cleared';
}

// ─── Controlling (CO) ───
export interface CostCenter {
  costCenterId: string;
  description: string;
  responsiblePerson: string;
  companyCode: string;
  department: string;
}

export interface BudgetVariance {
  costCenter: string;
  costCenterName: string;
  period: string;
  fiscalYear: string;
  plannedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
  currency: string;
  lineItems: BudgetLineItem[];
}

export interface BudgetLineItem {
  costElement: string;
  description: string;
  planned: number;
  actual: number;
  variance: number;
  overBudget: boolean;
}

// ─── Plant Maintenance (PM) ───
export interface WorkOrder {
  orderNumber: string;
  description: string;
  equipmentId: string;
  equipmentName: string;
  plant: string;
  workCenter: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'completed' | 'cancelled';
  type: 'corrective' | 'preventive' | 'inspection';
  createdDate: string;
  scheduledDate: string;
  completedDate?: string;
  estimatedHours: number;
  actualHours?: number;
  spareParts: string[];
  assignedTo: string;
}

// ─── Warehouse Management (WM) ───
export interface WarehouseStock {
  materialId: string;
  materialDescription: string;
  plant: string;
  storageLocation: string;
  binLocation: string;
  quantity: number;
  unit: string;
  lastCountDate: string;
  status: 'available' | 'reserved' | 'blocked' | 'in-quality';
}

// ─── Workflow (WF) ───
export interface WorkflowItem {
  itemId: string;
  type: 'PO_APPROVAL' | 'INVOICE_APPROVAL' | 'LEAVE_REQUEST' | 'BUDGET_RELEASE' | 'MATERIAL_RELEASE';
  description: string;
  documentNumber: string;
  module: string;
  requestor: string;
  amount: number;
  currency: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'rejected' | 'delegated';
  createdDate: string;
  dueDate: string;
  overdue: boolean;
  notes?: string;
}

// ─── Business Reports ───
export interface BusinessReport {
  reportType: string;
  title: string;
  period: string;
  generatedAt: string;
  summary: string;
  data: Record<string, unknown>[];
  totals: Record<string, number>;
}

// ─── Adapter Filter Types ───
export interface POFilter {
  status?: string;
  vendor?: string;
  material?: string;
  plant?: string;
  dateFrom?: string;
  dateTo?: string;
  days?: number;
}

export interface InventoryFilter {
  materialId?: string;
  plant?: string;
  belowReorder?: boolean;
  storageLocation?: string;
}

export interface SOFilter {
  customer?: string;
  status?: string;
  dateFrom?: string;
  plant?: string;
}

export interface OpenItemFilter {
  companyCode?: string;
  type?: 'AP' | 'AR';
  overdue?: boolean;
  vendor?: string;
  customer?: string;
}

export interface BudgetFilter {
  costCenter?: string;
  period?: string;
  fiscalYear?: string;
}

export interface WorkOrderFilter {
  equipmentId?: string;
  status?: string;
  plant?: string;
  priority?: string;
}

export interface WorkflowFilter {
  userId?: string;
  module?: string;
  priority?: string;
  status?: string;
}

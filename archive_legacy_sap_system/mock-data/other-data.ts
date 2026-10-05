import { SalesOrder, DeliveryStatus, OpenItem, BudgetVariance, WorkOrder, WarehouseStock, WorkflowItem } from '../types/sap.js';

export const SALES_ORDERS: SalesOrder[] = [
  { orderNumber: 'SO-8001001', customer: 'C-2001', customerName: 'Tata Motors Ltd', material: 'FG-5001', materialDescription: 'Precision Gearbox Assembly PGA-200', quantity: 50, unit: 'EA', netValue: 2500000, currency: 'INR', status: 'open', orderDate: '2026-05-20', requestedDeliveryDate: '2026-06-15', plant: '1010', salesOrg: 'SO10', distributionChannel: '10' },
  { orderNumber: 'SO-8001005', customer: 'C-2002', customerName: 'Mahindra & Mahindra', material: 'FG-5002', materialDescription: 'Hydraulic Pump Unit HPU-150', quantity: 30, unit: 'EA', netValue: 1800000, currency: 'INR', status: 'in-process', orderDate: '2026-05-18', requestedDeliveryDate: '2026-06-05', plant: '1010', salesOrg: 'SO10', distributionChannel: '10' },
  { orderNumber: 'SO-8001008', customer: 'C-2003', customerName: 'Bajaj Auto Ltd', material: 'FG-5003', materialDescription: 'Drive Shaft Assembly DS-300', quantity: 200, unit: 'EA', netValue: 3600000, currency: 'INR', status: 'delivered', orderDate: '2026-05-10', requestedDeliveryDate: '2026-05-25', plant: '1020', salesOrg: 'SO10', distributionChannel: '20' },
  { orderNumber: 'SO-8001012', customer: 'C-2004', customerName: 'Bosch India', material: 'FG-5001', materialDescription: 'Precision Gearbox Assembly PGA-200', quantity: 100, unit: 'EA', netValue: 5000000, currency: 'INR', status: 'open', orderDate: '2026-05-22', requestedDeliveryDate: '2026-06-20', plant: '1010', salesOrg: 'SO10', distributionChannel: '10' },
  { orderNumber: 'SO-8001015', customer: 'C-2005', customerName: 'Siemens India', material: 'FG-5004', materialDescription: 'Control Panel Assembly CPA-500', quantity: 15, unit: 'EA', netValue: 1200000, currency: 'INR', status: 'billed', orderDate: '2026-05-05', requestedDeliveryDate: '2026-05-20', plant: '1010', salesOrg: 'SO10', distributionChannel: '10' },
];

export const DELIVERY_STATUS: DeliveryStatus[] = [
  { deliveryNumber: 'DL-9001001', salesOrder: 'SO-8001005', customer: 'C-2002', customerName: 'Mahindra & Mahindra', status: 'picked', shippingDate: '2026-05-28', estimatedArrival: '2026-06-02', carrier: 'Blue Dart Express', trackingNumber: 'BD-2026-78901', items: 30, weight: 450, weightUnit: 'KG' },
  { deliveryNumber: 'DL-9001003', salesOrder: 'SO-8001008', customer: 'C-2003', customerName: 'Bajaj Auto Ltd', status: 'delivered', shippingDate: '2026-05-22', estimatedArrival: '2026-05-25', carrier: 'DTDC Logistics', trackingNumber: 'DTDC-2026-45678', items: 200, weight: 1200, weightUnit: 'KG' },
  { deliveryNumber: 'DL-9001005', salesOrder: 'SO-8001015', customer: 'C-2005', customerName: 'Siemens India', status: 'delivered', shippingDate: '2026-05-18', estimatedArrival: '2026-05-20', carrier: 'FedEx India', trackingNumber: 'FDX-2026-12345', items: 15, weight: 600, weightUnit: 'KG' },
];

export const OPEN_ITEMS: OpenItem[] = [
  { documentNumber: 'FI-100001', companyCode: '1000', fiscalYear: '2026', type: 'AP', vendor: 'V-1001', name: 'TechSupply AG', amount: 450000, currency: 'INR', postingDate: '2026-05-20', dueDate: '2026-06-19', overdueDays: 0, paymentTerms: 'Net 30', status: 'open' },
  { documentNumber: 'FI-100002', companyCode: '1000', fiscalYear: '2026', type: 'AP', vendor: 'V-1004', name: 'ElectroParts GmbH', amount: 650000, currency: 'INR', postingDate: '2026-05-18', dueDate: '2026-07-17', overdueDays: 0, paymentTerms: 'Net 60', status: 'open' },
  { documentNumber: 'FI-100003', companyCode: '1000', fiscalYear: '2026', type: 'AP', vendor: 'V-1002', name: 'MetalWorks Ltd', amount: 180000, currency: 'INR', postingDate: '2026-04-15', dueDate: '2026-05-15', overdueDays: 11, paymentTerms: 'Net 30', status: 'open' },
  { documentNumber: 'FI-100004', companyCode: '1000', fiscalYear: '2026', type: 'AR', customer: 'C-2003', name: 'Bajaj Auto Ltd', amount: 3600000, currency: 'INR', postingDate: '2026-05-25', dueDate: '2026-06-24', overdueDays: 0, paymentTerms: 'Net 30', status: 'open' },
  { documentNumber: 'FI-100005', companyCode: '1000', fiscalYear: '2026', type: 'AR', customer: 'C-2005', name: 'Siemens India', amount: 1200000, currency: 'INR', postingDate: '2026-05-20', dueDate: '2026-06-04', overdueDays: 0, paymentTerms: 'Net 15', status: 'partially-cleared' },
  { documentNumber: 'FI-100006', companyCode: '2000', fiscalYear: '2026', type: 'AP', vendor: 'V-1005', name: 'PackagePro Solutions', amount: 75000, currency: 'INR', postingDate: '2026-05-23', dueDate: '2026-06-07', overdueDays: 0, paymentTerms: 'Net 15', status: 'open' },
  { documentNumber: 'FI-100007', companyCode: '1000', fiscalYear: '2026', type: 'AR', customer: 'C-2001', name: 'Tata Motors Ltd', amount: 1800000, currency: 'INR', postingDate: '2026-04-20', dueDate: '2026-05-20', overdueDays: 6, paymentTerms: 'Net 30', status: 'open' },
];

export const BUDGET_DATA: BudgetVariance[] = [
  {
    costCenter: 'CC-1010', costCenterName: 'Manufacturing - Plant 1010', period: '05', fiscalYear: '2026',
    plannedAmount: 5000000, actualAmount: 4750000, variance: 250000, variancePercent: 5.0, currency: 'INR',
    lineItems: [
      { costElement: 'CE-410', description: 'Raw Materials', planned: 2000000, actual: 2150000, variance: -150000, overBudget: true },
      { costElement: 'CE-420', description: 'Direct Labour', planned: 1500000, actual: 1380000, variance: 120000, overBudget: false },
      { costElement: 'CE-430', description: 'Machine Maintenance', planned: 800000, actual: 720000, variance: 80000, overBudget: false },
      { costElement: 'CE-440', description: 'Utilities & Energy', planned: 400000, actual: 350000, variance: 50000, overBudget: false },
      { costElement: 'CE-450', description: 'Consumables', planned: 300000, actual: 150000, variance: 150000, overBudget: false },
    ]
  },
  {
    costCenter: 'CC-1020', costCenterName: 'Quality Control Lab', period: '05', fiscalYear: '2026',
    plannedAmount: 1200000, actualAmount: 1350000, variance: -150000, variancePercent: -12.5, currency: 'INR',
    lineItems: [
      { costElement: 'CE-510', description: 'Testing Equipment', planned: 400000, actual: 520000, variance: -120000, overBudget: true },
      { costElement: 'CE-520', description: 'Lab Supplies', planned: 200000, actual: 230000, variance: -30000, overBudget: true },
      { costElement: 'CE-530', description: 'Personnel', planned: 600000, actual: 600000, variance: 0, overBudget: false },
    ]
  },
];

export const WORK_ORDERS: WorkOrder[] = [
  { orderNumber: 'WO-7001', description: 'Annual PM - CNC Machine VMC-850', equipmentId: 'EQ-2001', equipmentName: 'CNC VMC-850 Vertical Machining Center', plant: '1010', workCenter: 'WC-MAINT', priority: 'high', status: 'open', type: 'preventive', createdDate: '2026-05-20', scheduledDate: '2026-05-28', estimatedHours: 16, spareParts: ['MAT-10001', 'MAT-10010'], assignedTo: 'RPATIL' },
  { orderNumber: 'WO-7002', description: 'Breakdown - Hydraulic Press HP-200 Oil Leak', equipmentId: 'EQ-2002', equipmentName: 'Hydraulic Press HP-200', plant: '1010', workCenter: 'WC-MAINT', priority: 'high', status: 'in-progress', type: 'corrective', createdDate: '2026-05-24', scheduledDate: '2026-05-25', estimatedHours: 8, actualHours: 4, spareParts: ['MAT-10055', 'MAT-10010'], assignedTo: 'AKULKARNI' },
  { orderNumber: 'WO-7003', description: 'Quarterly Inspection - Conveyor Belt System', equipmentId: 'EQ-2003', equipmentName: 'Conveyor Belt Line CB-100', plant: '1020', workCenter: 'WC-MAINT', priority: 'medium', status: 'open', type: 'inspection', createdDate: '2026-05-22', scheduledDate: '2026-06-01', estimatedHours: 4, spareParts: [], assignedTo: 'VJOSHI' },
  { orderNumber: 'WO-7004', description: 'Replace HEPA Filters - Clean Room AHU', equipmentId: 'EQ-2004', equipmentName: 'Air Handling Unit AHU-CR01', plant: '1020', workCenter: 'WC-HVAC', priority: 'medium', status: 'open', type: 'preventive', createdDate: '2026-05-23', scheduledDate: '2026-06-05', estimatedHours: 6, spareParts: ['MAT-10035'], assignedTo: 'RPATIL' },
  { orderNumber: 'WO-7005', description: 'Motor Replacement - Compressor Unit', equipmentId: 'EQ-2005', equipmentName: 'Screw Compressor SC-500', plant: '1010', workCenter: 'WC-MAINT', priority: 'low', status: 'completed', type: 'corrective', createdDate: '2026-05-10', scheduledDate: '2026-05-15', completedDate: '2026-05-14', estimatedHours: 12, actualHours: 10, spareParts: ['MAT-10001'], assignedTo: 'AKULKARNI' },
];

export const WAREHOUSE_STOCK: WarehouseStock[] = [
  { materialId: 'MAT-10001', materialDescription: 'Industrial Ball Bearings SKF-6205', plant: '1010', storageLocation: 'SL01', binLocation: 'A-01-03', quantity: 120, unit: 'EA', lastCountDate: '2026-05-15', status: 'available' },
  { materialId: 'MAT-10005', materialDescription: 'Stainless Steel Sheets 304 (2mm)', plant: '1010', storageLocation: 'SL02', binLocation: 'B-02-01', quantity: 800, unit: 'KG', lastCountDate: '2026-05-18', status: 'available' },
  { materialId: 'MAT-10010', materialDescription: 'Hydraulic Oil ISO VG 46', plant: '1020', storageLocation: 'SL03', binLocation: 'C-01-05', quantity: 150, unit: 'L', lastCountDate: '2026-05-10', status: 'available' },
  { materialId: 'MAT-10015', materialDescription: 'PLC Module Siemens S7-1200', plant: '1010', storageLocation: 'SL04', binLocation: 'D-03-02', quantity: 3, unit: 'EA', lastCountDate: '2026-04-28', status: 'reserved' },
  { materialId: 'MAT-10025', materialDescription: 'Pneumatic Cylinders FESTO DSBC-50', plant: '1010', storageLocation: 'SL01', binLocation: 'A-02-01', quantity: 3, unit: 'EA', lastCountDate: '2026-04-15', status: 'available' },
  { materialId: 'MAT-10035', materialDescription: 'HEPA Air Filters Grade H13', plant: '1020', storageLocation: 'SL03', binLocation: 'C-02-03', quantity: 8, unit: 'EA', lastCountDate: '2026-05-05', status: 'available' },
  { materialId: 'MAT-10040', materialDescription: 'Aluminium Extrusions 6063-T5', plant: '1010', storageLocation: 'SL02', binLocation: 'B-01-04', quantity: 100, unit: 'KG', lastCountDate: '2026-05-12', status: 'in-quality' },
];

export const WORKFLOW_ITEMS: WorkflowItem[] = [
  { itemId: 'WF-0001', type: 'PO_APPROVAL', description: 'Purchase Order 4500001210 — TechSupply AG', documentNumber: '4500001210', module: 'MM', requestor: 'SMUDHOLKAR', amount: 450000, currency: 'INR', priority: 'high', status: 'pending', createdDate: '2026-05-20', dueDate: '2026-05-25', overdue: true },
  { itemId: 'WF-0002', type: 'PO_APPROVAL', description: 'Purchase Order 4500001215 — MetalWorks Ltd', documentNumber: '4500001215', module: 'MM', requestor: 'RPATIL', amount: 280000, currency: 'INR', priority: 'medium', status: 'pending', createdDate: '2026-05-21', dueDate: '2026-05-26', overdue: false },
  { itemId: 'WF-0003', type: 'PO_APPROVAL', description: 'Purchase Order 4500001218 — ChemCorp India', documentNumber: '4500001218', module: 'MM', requestor: 'AKULKARNI', amount: 120000, currency: 'INR', priority: 'low', status: 'pending', createdDate: '2026-05-22', dueDate: '2026-05-27', overdue: false },
  { itemId: 'WF-0004', type: 'BUDGET_RELEASE', description: 'Q2 Budget Release — Quality Control Lab CC-1020', documentNumber: 'BR-2026-Q2-1020', module: 'CO', requestor: 'VJOSHI', amount: 1350000, currency: 'INR', priority: 'high', status: 'pending', createdDate: '2026-05-23', dueDate: '2026-05-28', overdue: false },
  { itemId: 'WF-0005', type: 'INVOICE_APPROVAL', description: 'Invoice Approval — ElectroParts GmbH EUR 7,800', documentNumber: 'INV-2026-EP-001', module: 'FI', requestor: 'RPATIL', amount: 650000, currency: 'INR', priority: 'medium', status: 'pending', createdDate: '2026-05-22', dueDate: '2026-05-29', overdue: false },
  { itemId: 'WF-0006', type: 'MATERIAL_RELEASE', description: 'Material Release — CNC Tool Holders for Plant 1010', documentNumber: 'MR-2026-1010-045', module: 'MM', requestor: 'SMUDHOLKAR', amount: 540000, currency: 'INR', priority: 'medium', status: 'pending', createdDate: '2026-05-25', dueDate: '2026-05-30', overdue: false },
  { itemId: 'WF-0007', type: 'PO_APPROVAL', description: 'Purchase Order 4500001238 — ChemCorp India (Cutting Fluid)', documentNumber: '4500001238', module: 'MM', requestor: 'RPATIL', amount: 85000, currency: 'INR', priority: 'low', status: 'pending', createdDate: '2026-05-24', dueDate: '2026-05-29', overdue: false },
  { itemId: 'WF-0008', type: 'LEAVE_REQUEST', description: 'Leave Request — AKULKARNI (3 days casual leave)', documentNumber: 'LR-2026-AK-005', module: 'HR', requestor: 'AKULKARNI', amount: 0, currency: 'INR', priority: 'low', status: 'pending', createdDate: '2026-05-25', dueDate: '2026-05-28', overdue: false },
];

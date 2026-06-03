import { MockERPAdapter } from './mock-adapter.js';
import { Vendor, Material, SalesOrder, SOFilter, InventoryFilter } from '../types/sap.js';

export class ODataAdapter extends MockERPAdapter {
  readonly name: any = 'ODataAdapter (Northwind)';
  private baseUrl = 'https://services.odata.org/V4/Northwind/Northwind.svc';

  private async fetchOData<T>(endpoint: string): Promise<T[]> {
    const url = `${this.baseUrl}/${endpoint}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`OData request failed: ${response.statusText}`);
      }
      const data = await response.json();
      return data.value;
    } catch (error) {
      console.error(`Error fetching OData from ${url}:`, error);
      return [];
    }
  }

  // Override getVendorDetails to map Northwind Suppliers -> SAP Vendor
  async getVendorDetails(vendorId?: string, vendorName?: string): Promise<Vendor[]> {
    const suppliers = await this.fetchOData<any>('Suppliers');
    let results: Vendor[] = suppliers.map((s: any) => ({
      vendorId: `V-${s.SupplierID}`,
      name: s.CompanyName,
      country: s.Country || 'Unknown',
      city: s.City || 'Unknown',
      paymentTerms: 'NET30',
      currency: 'USD',
      contactPerson: s.ContactName || 'N/A',
      email: `${s.ContactName?.replace(' ', '.').toLowerCase() || 'contact'}@${s.CompanyName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.com`,
      phone: s.Phone || 'N/A',
      bankAccount: 'N/A',
      taxId: 'N/A',
      status: 'active',
      totalOpenOrders: 0,
      ytdSpend: 0,
      rating: 'A'
    }));

    if (vendorId) {
      results = results.filter(v => v.vendorId === vendorId);
    }
    if (vendorName) {
      const lowerSearch = vendorName.toLowerCase();
      results = results.filter(v => v.name.toLowerCase().includes(lowerSearch));
    }
    return results;
  }

  // Override queryInventory to map Northwind Products -> SAP Material
  async queryInventory(filter: InventoryFilter): Promise<Material[]> {
    const products = await this.fetchOData<any>('Products');
    let results: Material[] = products.map((p: any) => ({
      materialId: `MAT-${p.ProductID}`,
      description: p.ProductName,
      type: 'finished',
      unit: p.QuantityPerUnit || 'EA',
      plant: '1000',
      storageLocation: '0001',
      currentStock: p.UnitsInStock || 0,
      reorderPoint: p.ReorderLevel || 0,
      safetyStock: Math.floor((p.ReorderLevel || 0) * 0.5),
      standardPrice: p.UnitPrice || 0,
      currency: 'USD',
      lastGoodsReceipt: new Date().toISOString(),
      materialGroup: p.CategoryID ? `CAT-${p.CategoryID}` : 'GEN'
    }));

    if (filter.materialId) results = results.filter(m => m.materialId === filter.materialId);
    if (filter.plant) results = results.filter(m => m.plant === filter.plant);
    if (filter.storageLocation) results = results.filter(m => m.storageLocation === filter.storageLocation);
    if (filter.belowReorder) results = results.filter(m => m.currentStock < m.reorderPoint);

    return results;
  }

  // Override getSalesOrders to map Northwind Orders -> SAP SalesOrder
  async getSalesOrders(filter: SOFilter): Promise<SalesOrder[]> {
    const orders = await this.fetchOData<any>('Orders');
    let results: SalesOrder[] = orders.map((o: any) => ({
      orderNumber: `SO-${o.OrderID}`,
      customer: o.CustomerID,
      customerName: o.ShipName || o.CustomerID,
      material: 'VARIOUS',
      materialDescription: 'Multiple Items',
      quantity: 1,
      unit: 'EA',
      netValue: o.Freight || 100,
      currency: 'USD',
      status: o.ShippedDate ? 'delivered' : 'open',
      orderDate: o.OrderDate || new Date().toISOString(),
      requestedDeliveryDate: o.RequiredDate || new Date().toISOString(),
      plant: '1000',
      salesOrg: '1000',
      distributionChannel: '10'
    }));

    if (filter.customer) {
      const lowerSearch = filter.customer.toLowerCase();
      results = results.filter(so => so.customer === filter.customer || so.customerName.toLowerCase().includes(lowerSearch));
    }
    if (filter.status) results = results.filter(so => so.status === filter.status);
    if (filter.dateFrom) results = results.filter(so => so.orderDate >= filter.dateFrom!);
    if (filter.plant) results = results.filter(so => so.plant === filter.plant);

    return results;
  }
}

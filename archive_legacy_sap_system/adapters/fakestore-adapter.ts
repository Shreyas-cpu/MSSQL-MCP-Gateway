import { MockERPAdapter } from './mock-adapter.js';
import { 
  Vendor, Material, SalesOrder, SOFilter, InventoryFilter,
  PurchaseOrder, POFilter, DeliveryStatus
} from '../types/sap.js';

export class FakeStoreAdapter extends MockERPAdapter {
  readonly name: any = 'FakeStoreAdapter';
  private baseUrl = 'https://fakestoreapi.com';

  private async fetchApi<T>(endpoint: string): Promise<T[]> {
    const url = `${this.baseUrl}/${endpoint}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`FakeStore API request failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching from ${url}:`, error);
      return [];
    }
  }

  async updateStock(materialId: string, quantity: number): Promise<boolean> {
    return true;
  }

  async getPurchaseOrders(filter: POFilter): Promise<PurchaseOrder[]> {
    return [];
  }

  async createPurchaseOrder(po: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    return { ...po, poNumber: '4500123123', status: 'pending' } as PurchaseOrder;
  }

  async checkDeliveryStatus(deliveryId?: string, salesOrderId?: string): Promise<DeliveryStatus[]> {
    return [];
  }

  async updateDeliveryStatus(deliveryId: string, status: string): Promise<boolean> {
    return true;
  }

  // Map FakeStore Users -> SAP Vendor
  async getVendorDetails(vendorId?: string, vendorName?: string): Promise<Vendor[]> {
    const users = await this.fetchApi<any>('users');
    let results: Vendor[] = users.map((u: any) => ({
      vendorId: `V-${u.id}`,
      name: `${u.name.firstname} ${u.name.lastname}`,
      country: 'USA', // Fake Store addresses don't have country
      city: u.address?.city || 'Unknown',
      paymentTerms: 'NET30',
      currency: 'USD',
      contactPerson: `${u.name.firstname} ${u.name.lastname}`,
      email: u.email,
      phone: u.phone,
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

  // Map FakeStore Products -> SAP Material
  async queryInventory(filter: InventoryFilter): Promise<Material[]> {
    const products = await this.fetchApi<any>('products');
    let results: Material[] = products.map((p: any) => ({
      materialId: `MAT-${p.id}`,
      description: p.title,
      type: 'finished',
      unit: 'EA',
      plant: '1000',
      storageLocation: '0001',
      currentStock: Math.floor(Math.random() * 100), // Fake Store doesn't provide stock levels
      reorderPoint: 20,
      safetyStock: 10,
      standardPrice: p.price,
      currency: 'USD',
      lastGoodsReceipt: new Date().toISOString(),
      materialGroup: p.category.toUpperCase()
    }));

    if (filter.materialId) results = results.filter(m => m.materialId === filter.materialId);
    if (filter.plant) results = results.filter(m => m.plant === filter.plant);
    if (filter.storageLocation) results = results.filter(m => m.storageLocation === filter.storageLocation);
    if (filter.belowReorder) results = results.filter(m => m.currentStock < m.reorderPoint);

    return results;
  }

  // Map FakeStore Carts -> SAP SalesOrder
  async getSalesOrders(filter: SOFilter): Promise<SalesOrder[]> {
    const carts = await this.fetchApi<any>('carts');
    let results: SalesOrder[] = carts.map((c: any) => ({
      orderNumber: `SO-${c.id}`,
      customer: `V-${c.userId}`, // Mapping to User ID
      customerName: `Customer ${c.userId}`,
      material: 'MIXED',
      materialDescription: `${c.products.length} Items in Cart`,
      quantity: c.products.length,
      unit: 'EA',
      netValue: 100 * c.products.length, // Dummy value since carts just have product IDs
      currency: 'USD',
      status: 'open',
      orderDate: c.date,
      requestedDeliveryDate: new Date(new Date(c.date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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

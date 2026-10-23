import type { InventoryItem, MaterialCategory, StockItem } from './types.ts';
import { department } from './stockMath.ts';

export type MaterialResaleProduct = InventoryItem & { materialSkuId: string };
/** A read-only catalog projection, never a second inventory record. */
export function materialResaleCatalog(stock: StockItem[], categories: MaterialCategory[]): MaterialResaleProduct[] {
  return stock.filter(item => item.isActive !== false && categories.find(c => c.id === item.categoryId)?.isActive !== false &&
    item.inventoryVersion === 1 && Number.isFinite(item.unitsOnHand) && Number.isFinite(item.avgCostPerUnit)).map(item => {
    const category = categories.find(c => c.id === item.categoryId);
    const id = item.id || item.skuId;
    const module = department(item.module || category?.module);
    const departmentName = ({ 'large-format': 'Large Format', dtf: 'DTF', embroidery: 'Embroidery', bizhub: 'Digital / Bizhub', products: 'Other Products', supplies: 'Legacy Supplies', Unassigned: 'Unassigned' })[module];
    return { id: `material:${id}`, materialSkuId: id, name: `${category?.name || item.itemName} · ${item.variantLabel || item.itemName}`,
      category: `${departmentName} · ${category?.name || item.itemName}`, module, quantity: item.unitsOnHand!,
      price: item.resalePrice ?? 0, minPrice: 0, minStockLevel: 0, sku: item.skuId, isActive: true };
  });
}

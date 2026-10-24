import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import type { Firestore, Transaction } from 'firebase/firestore';
import type { Department, InventoryItem, ProductCategory, StockUnit } from './types.ts';
import type { StockActor } from './stockService.ts';
import { department, nonNegative, wholeUnits } from './stockMath.ts';
import { stockUnits, variantDefinitions } from './inventorySetup.ts';

export interface ProductDetails {
  name: string; category: string; module: Department; sku: string;
  price: number; minPrice: number; minStockLevel: number;
  attr1: string; attr2: string; attr3: string; attr4: string; attr5: string;
}
export function createInventorySetupService(db: Firestore, actor: StockActor) {
  async function admin(tx: Transaction) {
    const [user, migration] = await Promise.all([tx.get(doc(db, 'users', actor.id)), tx.get(doc(db, 'inventoryMigrations', 'unopened-v1'))]);
    if (user.data()?.role !== 'admin') throw new Error('Admin access required.');
    if (migration.data()?.running) throw new Error('Finish inventory migration first.');
    return { userId: actor.id, userName: String(user.data()?.username || actor.username) };
  }
  function validModule(value: string) { if (department(value) === 'Unassigned') throw new Error('Choose a department.'); }
  async function saveMaterial(id: string | null, name: string, module: Department, unitType: StockUnit) {
    if (!name.trim()) throw new Error('Material name is required.');
    validModule(module);
    if (!stockUnits.includes(unitType)) throw new Error('Invalid unit.');
    const ref = id ? doc(db, 'materialCategories', id) : doc(collection(db, 'materialCategories'));
    await runTransaction(db, async tx => {
      await admin(tx);
      const old = await tx.get(ref);
      if (id && !old.exists()) throw new Error('Material no longer exists.');
      if (id && (old.data()?.unitType || 'roll') !== unitType) throw new Error('Create a new material to change its unit type.');
      if (id && old.data()?.module !== module) throw new Error('Existing material departments cannot change in this form.');
      tx.set(ref, { name: name.trim(), module, unitType, ...(id ? {} : { isActive: true }) }, { merge: true });
    });
  }
  async function addVariants(categoryId: string, text: string, reorderLevel: number, rollLengthMeters?: number) {
    wholeUnits(reorderLevel);
    if (rollLengthMeters !== undefined) { nonNegative(rollLengthMeters, 'Roll length'); if (!rollLengthMeters) throw new Error('Roll length must be positive.'); }
    // Keep a stable registry on the material so simultaneous bulk creates cannot duplicate labels.
    const categoryRef = doc(db, 'materialCategories', categoryId);
    const existingVariants = await getDocs(query(collection(db, 'stockItems'), where('categoryId', '==', categoryId)));
    // Refs are allocated before the retriable callback.
    const refs = Array.from({ length: 40 }, () => doc(collection(db, 'stockItems')));
    await runTransaction(db, async tx => {
      const user = await admin(tx);
      const category = await tx.get(categoryRef);
      const existing = await Promise.all(existingVariants.docs.map(s => tx.get(s.ref)));
      if (!category.exists() || category.data().isActive === false) throw new Error('Choose an active material.');
      const data = category.data(), unit = (data.unitType || 'roll') as StockUnit;
      validModule(data.module);
      const variants = variantDefinitions(text, unit);
      const registry = [...new Set<string>([...(data.variantLabels || []), ...existing.filter(s => s.exists()).map(s => {
        const d = s.data()!;
        return String(d.variantLabel || (d.width ? `${d.width} m` : d.itemName)).toLocaleLowerCase();
      })])];
      if (variants.some(v => registry.includes(v.variantLabel.toLocaleLowerCase()))) throw new Error('A variant with that label already exists.');
      variants.forEach((variant, index) => {
        const ref = refs[index], entryRef = doc(db, 'stockTransactions', `opening-${ref.id}`);
        tx.set(ref, { skuId: ref.id, categoryId, module: data.module, itemName: `${data.name} ${variant.variantLabel}`, ...variant, unit,
          reorderLevel, reorderLevelNeedsReview: false, unitsOnHand: 0, avgCostPerUnit: 0, inventoryVersion: 1, isActive: true,
          totalStockMeters: 0, lastPurchasePricePerRoll_UGX: 0,
          ...(unit === 'roll' && rollLengthMeters !== undefined ? { rollLengthMeters } : {}) });
        tx.set(entryRef, { transactionId: entryRef.id, skuId: ref.id, entity: 'material', type: 'Opening', units: 0, unitCost: 0, totalValue: 0,
          module: data.module, date: new Date().toISOString(), notes: 'New variant; receive stock to add units.', ...user });
      });
      tx.update(categoryRef, { unitType: unit, variantLabels: [...registry, ...variants.map(v => v.variantLabel.toLocaleLowerCase())] });
    });
  }
  async function editVariant(id: string, details: { itemName: string; reorderLevel: number; rollLengthMeters?: number }) {
    wholeUnits(details.reorderLevel);
    if (!details.itemName.trim()) throw new Error('Variant name is required.');
    if (details.rollLengthMeters !== undefined && !(details.rollLengthMeters > 0 && Number.isFinite(details.rollLengthMeters))) throw new Error('Invalid roll length.');
    await runTransaction(db, async tx => {
      await admin(tx);
      const ref = doc(db, 'stockItems', id), stock = await tx.get(ref);
      if (!stock.exists()) throw new Error('Variant not found.');
      tx.update(ref, { itemName: details.itemName.trim(), reorderLevel: details.reorderLevel, reorderLevelNeedsReview: false,
        ...(details.rollLengthMeters !== undefined ? { rollLengthMeters: details.rollLengthMeters } : {}) });
    });
  }
  async function setActive(collectionName: 'stockItems' | 'materialCategories' | 'inventory' | 'productCategories', id: string, active: boolean) {
    // Deactivate rather than delete, including records without history. No race with a new movement.
    await runTransaction(db, async tx => {
      await admin(tx);
      const ref = doc(db, collectionName, id), existing = await tx.get(ref);
      if (!existing.exists()) throw new Error('Record not found.');
      tx.update(ref, { isActive: active });
    });
  }
  async function saveProduct(id: string | null, details: ProductDetails, openingUnits = 0, purchasePrice?: number) {
    if (!details.name.trim() || !details.category.trim()) throw new Error('Name and category are required.');
    validModule(details.module);
    nonNegative(details.price, 'Selling price'); nonNegative(details.minPrice, 'Minimum price'); wholeUnits(details.minStockLevel);
    if (details.minPrice > details.price) throw new Error('Minimum price cannot exceed selling price.');
    if (!id) { wholeUnits(openingUnits); nonNegative(purchasePrice ?? NaN, 'Purchase price'); }
    const ref = id ? doc(db, 'inventory', id) : doc(collection(db, 'inventory'));
    const openingRef = doc(db, 'stockTransactions', `opening-product-${ref.id}`);
    await runTransaction(db, async tx => {
      const user = await admin(tx), existing = await tx.get(ref);
      if (id && !existing.exists()) throw new Error('Product not found.');
      if (id) {
        const old = existing.data() as InventoryItem;
        const missing = old.costMissing || (old.avgCost === undefined && old.purchasePrice === undefined);
        if (purchasePrice !== undefined && missing) {
          nonNegative(purchasePrice, 'Purchase price');
          const opening = await tx.get(openingRef);
          if (opening.exists()) throw new Error('Opening already exists; review cost history.');
          wholeUnits(old.quantity);
          tx.set(openingRef, { transactionId: openingRef.id, skuId: ref.id, entity: 'product', type: 'Opening', units: old.quantity,
            unitCost: purchasePrice, totalValue: old.quantity * purchasePrice, module: details.module, date: new Date().toISOString(), notes: 'Reviewed missing legacy product cost.', ...user });
          tx.update(ref, { ...details, purchasePrice, avgCost: purchasePrice, costMissing: false });
        } else tx.update(ref, { ...details }); // No editable balance or carrying cost.
      } else {
        tx.set(ref, { ...details, quantity: openingUnits, purchasePrice, avgCost: purchasePrice, costMissing: false, isActive: true });
        tx.set(openingRef, { transactionId: openingRef.id, skuId: ref.id, entity: 'product', type: 'Opening', units: openingUnits,
          unitCost: purchasePrice, totalValue: openingUnits * purchasePrice!, module: details.module, date: new Date().toISOString(), notes: 'Product opening balance.', ...user });
      }
    });
  }
  async function saveProductCategory(id: string | null, data: Pick<ProductCategory, 'name' | 'module' | 'field1' | 'field2' | 'field3' | 'field4' | 'field5'>) {
    if (!data.name.trim()) throw new Error('Category name is required.');
    validModule(data.module);
    const ref = id ? doc(db, 'productCategories', id) : doc(collection(db, 'productCategories'));
    await runTransaction(db, async tx => {
      await admin(tx);
      const old = await tx.get(ref);
      if (id && !old.exists()) throw new Error('Category not found.');
      // Products link by category name: keep established names stable.
      if (id && old.data()?.name !== data.name.trim()) throw new Error('Existing category names are fixed; create a new category to rename.');
      tx.set(ref, { ...data, name: data.name.trim(), ...(id ? {} : { isActive: true }) }, { merge: true });
    });
  }
  async function saveTier(id: string | null, categoryId: string, name: string, value: number, preset: 'A4' | 'A3' | null = null) {
    if (!name.trim()) throw new Error('Tier name required.'); nonNegative(value, 'Tier price');
    const ref = id ? doc(db, 'pricingTiers', id) : doc(collection(db, 'pricingTiers'));
    await runTransaction(db, async tx => {
      await admin(tx);
      const category = await tx.get(doc(db, 'materialCategories', categoryId));
      if (!category.exists()) throw new Error('Choose a material.');
      if(preset && (category.data()?.module !== 'dtf' || !['A4','A3'].includes(preset)))throw new Error('Sheet presets require a DTF material.');
      tx.set(ref, { categoryId, name: name.trim(), value, preset });
    });
  }
  async function setMaterialResalePrice(id: string, sellingPrice: number) {
    nonNegative(sellingPrice, 'Selling price');
    await runTransaction(db, async tx => {
      await admin(tx);
      const ref = doc(db, 'stockItems', id), item = await tx.get(ref);
      if (!item.exists() || item.data()?.isActive === false) throw new Error('Choose an active material.');
      tx.update(ref, { resalePrice: sellingPrice });
    });
  }
  return { saveMaterial, addVariants, editVariant, setActive, saveProduct, saveProductCategory, saveTier, setMaterialResalePrice };
}

import { collection, doc, runTransaction } from 'firebase/firestore';
import type { DocumentData, Firestore, Transaction } from 'firebase/firestore';
import type { AssignedDepartment, CostedSaleItem, Department, Sale, SaleItem, UnitStockTransaction } from './types.ts';
import { department, nonNegative, positive, receiveBalance, restoreBalance, sellBalance, startBalance, wholeUnits } from './stockMath.ts';
import { directOrderCogs } from './kuyiriba.ts';

export interface StockActor { id: string; username: string; role: 'admin' | 'user' }
interface ReceiveInput { units: number; unitCost: number; supplier: string; paymentStatus: 'Paid' | 'Credit'; freightTotal?: number; reference?: string }
interface ActionOptions { adminOverride?: boolean; notes?: string }

/** All methods reread the authenticated user's role inside the same transaction.
 * UI cost hiding is not confidentiality; security rules must also be deployed. */
export function createStockService(db: Firestore, actor: StockActor) {
  async function authorize(tx: Transaction, admin = false) {
    const user = await tx.get(doc(db, 'users', actor.id));
    const migration = await tx.get(doc(db, 'inventoryMigrations', 'unopened-v1'));
    if (migration.data()?.running) throw new Error('Inventory migration is in progress. Stock writes are paused.');
    if (!user.exists() || !['admin', 'user'].includes(user.data().role)) throw new Error('Unknown stock user.');
    if (admin && user.data().role !== 'admin') throw new Error('Admin access required.');
    return { userId: actor.id, userName: String(user.data().username || actor.username) };
  }
  function movement(id: string, skuId: string, entity: 'material' | 'product', type: UnitStockTransaction['type'], units: number, unitCost: number, module: AssignedDepartment, user: { userId: string; userName: string }, extra: Partial<UnitStockTransaction> = {}): UnitStockTransaction {
    return { transactionId: id, skuId, entity, type, units, unitCost, totalValue: Math.abs(units) * unitCost, module, date: new Date().toISOString(), ...user, ...extra };
  }
  function readyMaterial(data: DocumentData) {
    if (data.inventoryVersion !== 1 || !Number.isFinite(data.unitsOnHand) || !Number.isFinite(data.avgCostPerUnit)) throw new Error('Count and migrate this variant first.');
    if (data.isActive === false) throw new Error('Variant is inactive.');
  }
  function productCost(data: DocumentData) {
    const cost: unknown = data.avgCost ?? data.purchasePrice;
    if (data.costMissing || typeof cost !== 'number') throw new Error('Product purchase cost is missing.');
    return nonNegative(cost, 'Product cost');
  }
  async function receive(skuId: string, entity: 'material' | 'product', input: ReceiveInput) {
    if (!input.supplier.trim()) throw new Error('Supplier is required.');
    if (!['Paid', 'Credit'].includes(input.paymentStatus)) throw new Error('Invalid payment status.');
    const stockRef = doc(db, entity === 'material' ? 'stockItems' : 'inventory', skuId);
    const entryRef = doc(collection(db, 'stockTransactions'));
    const payableRef = doc(db, 'supplierPayables', entryRef.id);
    return runTransaction(db, async tx => {
      const user = await authorize(tx);
      const snap = await tx.get(stockRef);
      if (!snap.exists()) throw new Error('Stock item not found.');
      const data = snap.data();
      if (entity === 'material') readyMaterial(data);
      if (data.isActive === false) throw new Error('Stock item is inactive.');
      const oldUnits = entity === 'material' ? data.unitsOnHand : data.quantity;
      const oldCost = entity === 'material' ? data.avgCostPerUnit : oldUnits === 0 ? 0 : productCost(data);
      const next = receiveBalance(oldUnits, oldCost, input.units, input.unitCost, input.freightTotal);
      const entry = movement(entryRef.id, skuId, entity, 'Purchase', input.units, next.landedUnitCost, department(data.module), user, {
        supplier: input.supplier.trim(), paymentStatus: input.paymentStatus, reference: input.reference || '', beforeUnits: oldUnits, afterUnits: next.unitsOnHand,
      });
      tx.update(stockRef, entity === 'material' ? { unitsOnHand: next.unitsOnHand, avgCostPerUnit: next.avgCostPerUnit, lastMovementId: entryRef.id } : {
        quantity: next.unitsOnHand, avgCost: next.avgCostPerUnit, purchasePrice: next.avgCostPerUnit, costMissing: false, lastMovementId: entryRef.id,
      });
      tx.set(entryRef, entry);
      if (input.paymentStatus === 'Credit') tx.set(payableRef, { purchaseId: entryRef.id, supplier: input.supplier.trim(), amount: entry.totalValue, amountPaid: 0, date: entry.date, module: entry.module });
      return entry;
    });
  }
  async function startUnit(skuId: string, chargedDepartment?: Department, options: ActionOptions = {}) {
    const ref = doc(db, 'stockItems', skuId), entryRef = doc(collection(db, 'stockTransactions'));
    return runTransaction(db, async tx => {
      const user = await authorize(tx, options.adminOverride === true);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Variant not found.');
      const data = snap.data(); readyMaterial(data);
      const module = department(chargedDepartment || data.module);
      if (module === 'Unassigned') throw new Error('Choose the department charged.');
      const next = startBalance(data.unitsOnHand, data.avgCostPerUnit, options.adminOverride);
      const entry = movement(entryRef.id, skuId, 'material', 'Start', -1, next.unitCost, module, user, { notes: options.notes || '', adminOverride: options.adminOverride === true, beforeUnits: data.unitsOnHand, afterUnits: next.unitsOnHand });
      tx.update(ref, { unitsOnHand: next.unitsOnHand, lastStartedAt: entry.date, lastMovementId: entryRef.id });
      tx.set(entryRef, entry);
      return entry;
    });
  }
  async function adjustStock(skuId: string, countedUnits: number, reason: string, entity: 'material' | 'product' = 'material') {
    wholeUnits(countedUnits);
    if (!reason.trim()) throw new Error('A count adjustment reason is required.');
    const ref = doc(db, entity === 'material' ? 'stockItems' : 'inventory', skuId), entryRef = doc(collection(db, 'stockTransactions'));
    return runTransaction(db, async tx => {
      const user = await authorize(tx, true);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Stock item not found.');
      const data = snap.data();
      if (entity === 'material') readyMaterial(data);
      const oldUnits = entity === 'material' ? data.unitsOnHand : data.quantity;
      const cost = entity === 'material' ? data.avgCostPerUnit : productCost(data);
      const entry = movement(entryRef.id, skuId, entity, 'Adjustment', countedUnits - oldUnits, cost, department(data.module), user, { notes: reason.trim(), beforeUnits: oldUnits, afterUnits: countedUnits });
      tx.update(ref, entity === 'material' ? { unitsOnHand: countedUnits, lastMovementId: entryRef.id } : { quantity: countedUnits, lastMovementId: entryRef.id });
      tx.set(entryRef, entry);
      return entry;
    });
  }

  // Whole-sale operations keep the sale and ALL product movements atomic.
  // No item-name matching and no UUID splitting: use metadata.selectedProductId/productId.
  async function saveSale(saleId: string, input: Omit<Sale, 'id'> | null, options: ActionOptions = {}) {
    const saleRef = doc(db, 'sales', saleId);
    return runTransaction(db, async tx => {
      const user = await authorize(tx, options.adminOverride === true);
      const oldSnap = await tx.get(saleRef);
      const old = oldSnap.exists() ? oldSnap.data() as Sale : undefined;
      if(old?.internalComplementary||input?.internalComplementary)throw new Error('Edit the parent customer order to change complementary work.');
      const hasComplement=[...(old?.items||[]),...(input?.items||[])].some(i=>i.complementaryFor);
      const linkedRef=doc(db,'sales',saleId+'--complementary');
      const linked=hasComplement ? await tx.get(linkedRef) : undefined;
      const internalCustomerRef=doc(db,'customers','eko-prints-complementary');
      const internalCustomer=hasComplement ? await tx.get(internalCustomerRef) : undefined;
      if (old?.voidedAt) throw new Error('Sale has already been reversed.');
      if (old && input && JSON.stringify(input.items) === JSON.stringify(old.items)) {
        // Payments/notes do not reverse stock or revalue original COGS.
        const { items: _items, inventoryVersion: _version, inventoryMovementIds: _movements, ...details } = input;
        tx.update(saleRef, details);
        return old.items;
      }
      if (old && old.inventoryVersion !== 1) throw new Error('Legacy sale requires reviewed stock reconciliation before changing its items or voiding it.');
      if (!input && !old) throw new Error('Sale not found.');
      const ids = new Set<string>();
      const target = (item: SaleItem) => item.materialSkuId ? { entity: 'material' as const, id: item.materialSkuId } :
        (item.productId || item.metadata?.selectedProductId) ? { entity: 'product' as const, id: (item.productId || item.metadata?.selectedProductId)! } : null;
      const keyFor = (item: SaleItem) => { const t = target(item); return t ? `${t.entity}:${t.id}` : null; };
      for (const item of [...(old?.items || []), ...(input?.items || [])]) {
        const key = keyFor(item); if (key) ids.add(key);
      }
      const balances = new Map<string, { id: string; entity: 'material' | 'product'; data: DocumentData; quantity: number; avg: number }>();
      // All reads precede all writes, including multi-product sales.
      for (const key of ids) {
        const separator = key.indexOf(':'), entity = key.slice(0, separator) as 'material' | 'product', id = key.slice(separator + 1);
        const snap = await tx.get(doc(db, entity === 'material' ? 'stockItems' : 'inventory', id));
        if (!snap.exists()) throw new Error(`Stock ${id} is missing; cannot reverse or sell.`);
        const data = snap.data();
        const quantity = entity === 'material' ? data.unitsOnHand : data.quantity;
        if (!Number.isFinite(quantity)) throw new Error('Invalid stock balance.');
        if (entity === 'material' && data.inventoryVersion !== 1) throw new Error('Count and migrate this material first.');
        balances.set(key, { id, entity, data, quantity, avg: entity === 'material' ? nonNegative(data.avgCostPerUnit, 'Material cost') : productCost(data) });
      }
      const entries: UnitStockTransaction[] = [];
      for (const [index, item] of (old?.items || []).entries()) {
        const key = keyFor(item); if (!key) continue;
        const state = balances.get(key)!;
        const cost = nonNegative(item.cogsAtSale ?? NaN, 'Original COGS') / positive(item.quantity, 'Original quantity');
        // Restore the original carrying cost even if intervening purchases changed average cost.
        const restored = restoreBalance(state.quantity, state.avg, item.quantity, item.cogsAtSale!);
        state.avg = restored.avgCost;
        state.quantity = restored.quantity;
        const entryRef = doc(collection(db, 'stockTransactions'));
        const originalMovementId = old?.inventoryMovementIds?.[index];
        if (!originalMovementId) throw new Error('Original sale movement is missing; review before reversal.');
        entries.push(movement(entryRef.id, state.id, state.entity, 'Reversal', item.quantity, cost, department(item.module), user, { reference: saleId, reverses: originalMovementId, notes: input ? 'Sale edited: reverse previous issue' : 'Sale voided: reverse previous issue' }));
      }
      const movementIds: string[] = [];
      const items: CostedSaleItem[] = (input?.items || []).map((originalItem, index) => {
        let item=originalItem;
        if(item.complementaryFor){const parent=input?.items.find(p=>p.itemId===item.complementaryFor&&p.directCosts);if(!parent)throw new Error('Complementary work requires its parent Kuyiriba item.');positive(item.complementaryQuantityPerItem??NaN,'Complementary quantity');nonNegative(item.complementaryUnitPrice??NaN,'Complementary price');item={...item,quantity:parent.quantity*item.complementaryQuantityPerItem!,price:0};}
        positive(item.quantity, 'Quantity'); nonNegative(item.price, 'Selling price');
        const key = keyFor(item);
        if (!key) { movementIds[index] = ''; return { ...item, module: department(item.module || item.metadata?.tab), cogsAtSale: directOrderCogs(item) }; }
        if (item.directCosts) throw new Error('An externally bought Kuyiriba item cannot also issue inventory stock.');
        const state = balances.get(key)!;
        if (state.data.isActive === false) throw new Error('This stock item is inactive.');
        if (state.entity === 'material' && item.metadata?.type === 'dimension') throw new Error('Unopened resale must stay separate from printing services.');
        const issued = sellBalance(state.quantity, state.avg, item.quantity, options.adminOverride);
        state.quantity = issued.quantity;
        const entryRef = doc(collection(db, 'stockTransactions'));
        movementIds[index] = entryRef.id;
        const module = department(state.data.module);
        entries.push(movement(entryRef.id, state.id, state.entity, 'Sale', -item.quantity, state.avg, module, user, { reference: saleId, notes: `${saleId}:${index}`, adminOverride: options.adminOverride === true }));
        return { ...item, ...(state.entity === 'material' ? { materialSkuId: state.id } : { productId: state.id }), stockEntity: state.entity, module, cogsAtSale: issued.cogsAtSale };
      });
      for (const state of balances.values()) tx.update(doc(db, state.entity === 'material' ? 'stockItems' : 'inventory', state.id), state.entity === 'material' ? { unitsOnHand: state.quantity, avgCostPerUnit: state.avg } : { quantity: state.quantity, avgCost: state.avg, purchasePrice: state.avg });
      for (const entry of entries) tx.set(doc(db, 'stockTransactions', entry.transactionId), entry);
      if (input) tx.set(saleRef, { ...input, items, inventoryVersion: 1, inventoryMovementIds: movementIds });
      else tx.update(saleRef, { voidedAt: new Date().toISOString() });
      const complementaryItems=items.filter(i=>i.complementaryFor).map(i=>({...i,price:i.complementaryUnitPrice!,cogsAtSale:0}));
      if(input&&complementaryItems.length){
        if(!internalCustomer?.exists())tx.set(internalCustomerRef,{name:'EKO PRINTS COMPLEMENTARY',email:'',phone:'',address:'',createdAt:new Date().toISOString()});
        const total=complementaryItems.reduce((sum,i)=>sum+i.price*i.quantity,0);
        tx.set(linkedRef,{date:input.date,items:complementaryItems,customerId:'eko-prints-complementary',subtotal:total,total,amountPaid:0,payments:[],status:'Paid',userId:user.userId,userName:user.userName,internalComplementary:true,parentSaleId:saleId,inventoryVersion:1,inventoryMovementIds:[],notes:'Internal complementary work; included in the finished customer price. No additional cash received. Stock and COGS are recorded on parent order '+saleId});
      }else if(linked?.exists())tx.update(linkedRef,{voidedAt:new Date().toISOString()});
      return items;
    });
  }
  async function paySupplier(purchaseId: string, amount: number, reference: string) {
    positive(amount, 'Payment');
    const payableRef = doc(db, 'supplierPayables', purchaseId), paymentRef = doc(collection(db, 'supplierPayments'));
    return runTransaction(db, async tx => {
      const user = await authorize(tx, true);
      const snap = await tx.get(payableRef);
      if (!snap.exists()) throw new Error('Payable not found.');
      const payable = snap.data();
      if (payable.amountPaid + amount > payable.amount) throw new Error('Payment exceeds outstanding payable.');
      tx.update(payableRef, { amountPaid: payable.amountPaid + amount });
      tx.set(paymentRef, { purchaseId, amount, reference, date: new Date().toISOString(), ...user });
    });
  }
  return {
    receiveStock: (id: string, input: ReceiveInput) => receive(id, 'material', input),
    restockProduct: (id: string, input: ReceiveInput) => receive(id, 'product', input),
    startUnit, adjustStock, saveSale,
    sellProduct: (saleId: string, sale: Omit<Sale, 'id'>, options?: ActionOptions) => saveSale(saleId, sale, options),
    reverseSale: (saleId: string) => saveSale(saleId, null), paySupplier,
  };
}

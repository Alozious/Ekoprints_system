import ActionButton, {ActionForm} from './ActionButton';
import InfoTooltip from './InfoTooltip';
import React, { useMemo, useRef, useState } from 'react';
import type { Department, Expense, InventoryItem, MaterialCategory, PricingTier, ProductCategory, Sale, SaleItem, StockItem, StockTransaction, StockUnit, User } from '../types';
import InventoryPurchaseReport from './InventoryPurchaseReport';
import { db } from '../firebase';
import { createStockService } from '../stockService';
import { createInventorySetupService } from '../inventorySetupService';
import type { ProductDetails } from '../inventorySetupService';
import { stockUnits } from '../inventorySetup';
import { useToast } from '../App';
import Modal from './Modal';

interface Props {
  materialCategories: MaterialCategory[]; stockItems: StockItem[]; stockTransactions: StockTransaction[];
  pricingTiers: PricingTier[]; inventory: InventoryItem[]; productCategories: ProductCategory[];
  currentUser: User; onRefresh: () => Promise<void>;
  onResellMaterial: (item: SaleItem) => void;
  sales?: Sale[]; expenses?: Expense[];
}
const departments: { id: Department; label: string }[] = [
  { id: 'large-format', label: 'Large Format' }, { id: 'dtf', label: 'DTF' }, { id: 'embroidery', label: 'Embroidery' },
  { id: 'bizhub', label: 'Digital / Bizhub' }, { id: 'products', label: 'Other Products' },
];
const input = 'w-full rounded-xl bg-gray-800 p-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-yellow-400';
const primary = 'bg-yellow-400 text-gray-900 px-4 py-3 rounded-xl font-black text-xs disabled:opacity-40';
const secondary = 'bg-gray-100 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40';
const cell = 'px-4 py-4';
const ugx = (n: number) => `${new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(n)} UGX`;
const stockId = (item: StockItem) => item.id || item.skuId;
const ready = (item: StockItem) => item.inventoryVersion === 1 && Number.isFinite(item.unitsOnHand) && Number.isFinite(item.avgCostPerUnit);
const missingCost = (item: InventoryItem) => {
  const cost = item.avgCost ?? item.purchasePrice;
  return item.costMissing || typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0;
};
type Dialog =
  | { kind: 'resell'; item: StockItem }
  | { kind: 'resalePrice'; item: StockItem }
  | { kind: 'receive'; item: StockItem | InventoryItem; product: boolean }
  | { kind: 'start'; item: StockItem }
  | { kind: 'material'; item: MaterialCategory | null }
  | { kind: 'variants'; category: MaterialCategory }
  | { kind: 'variant'; item: StockItem }
  | { kind: 'product'; item: InventoryItem | null }
  | { kind: 'productCategory'; item: ProductCategory | null }
  | { kind: 'tier'; item: PricingTier | null }
  | { kind: 'active'; collection: 'stockItems' | 'materialCategories' | 'inventory' | 'productCategories'; id: string; name: string; active: boolean };
function Field({ label, children }: { label: string; children: React.ReactNode; key?: string | number }) {
  return <label className="block space-y-2 text-xs font-bold text-gray-500"><span>{label}</span>{children}</label>;
}
function Numeric({ label, value, onChange, step = '1', required = true }: { label: string; value: string; onChange: (value: string) => void; step?: string; required?: boolean }) {
  return <Field label={label}><input className={input} type="number" min="0" step={step} value={value} onChange={e => onChange(e.target.value)} required={required} /></Field>;
}
function Empty({ children }: { children: React.ReactNode }) { return <p className="p-6 text-sm text-gray-500">{children}</p>; }

export default function InventoryView(props: Props) {
  const { currentUser, materialCategories, stockItems, stockTransactions, pricingTiers, inventory, productCategories } = props;
  const admin = currentUser.role === 'admin';
  const [module, setModule] = useState<Department>('large-format');
  const [tab, setTab] = useState<'stock' | 'products' | 'setup' | 'reports'>('stock');
  const [inactive, setInactive] = useState(false), [search, setSearch] = useState('');
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<Dialog | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const { addToast } = useToast();
  const stock = useMemo(() => createStockService(db, currentUser), [currentUser]);
  const setup = useMemo(() => createInventorySetupService(db, currentUser), [currentUser]);
  const open = (next: Dialog) => { setError(''); setDialog(next); };
  async function run(action: () => Promise<unknown>, success: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await action(); setDialog(null); addToast(success, 'success');
      try { await props.onRefresh(); } catch { addToast('Saved, but refresh failed. Reload before the next action.', 'error'); }
    } catch (err) { const message = err instanceof Error ? err.message : 'Unable to save.'; setError(message); addToast(message, 'error'); }
    finally { lock.current = false; setBusy(false); }
  }
  const matches = (name: string) => name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const categories = materialCategories.filter(c => c.module === module && (inactive || c.isActive !== false));
  const allMaterials = materialCategories.filter(c => c.module === module);
  const variants = stockItems.filter(s => s.module === module && (inactive || (s.isActive !== false && materialCategories.find(c => c.id === s.categoryId)?.isActive !== false)) && matches(`${s.itemName} ${s.variantLabel || ''} ${allMaterials.find(c => c.id === s.categoryId)?.name || ''}`));
  const products = inventory.filter(p => p.module === module && (inactive || p.isActive !== false) && matches(`${p.name} ${p.sku} ${p.category}`));
  const productTypes = productCategories.filter(p => p.module === module && (inactive || p.isActive !== false));
  const groupMap = new Map(categories.filter(c => !search.trim() || matches(c.name) || variants.some(v => v.categoryId === c.id)).map(c => [c.id, c.name]));
  variants.forEach(s => { if (!groupMap.has(s.categoryId)) groupMap.set(s.categoryId, allMaterials.find(c => c.id === s.categoryId)?.name || 'Material setup needed'); });
  const activeButton = (collection: 'stockItems' | 'materialCategories' | 'inventory' | 'productCategories', id: string, name: string, isActive?: boolean) =>
    <ActionButton className={secondary} disabled={busy} onClick={() => open({ kind: 'active', collection, id, name, active: isActive === false })}>{isActive === false ? 'Reactivate' : 'Deactivate'}</ActionButton>;

  return <div className="space-y-4">
    <div className="flex justify-between items-center"><div className="flex items-center gap-3"><h2 className="text-2xl font-black text-gray-900">Inventory</h2><InfoTooltip label="Inventory information"><p>Materials show unopened units only. Starting a unit removes it from stock. All unopened materials can be resold.</p><p>Receive stock records purchases. Edit setup changes reorder levels and reference roll length.</p>{admin && <p>Starting units charges average cost to COGS. Valuation includes inactive stock in this department. Search does not change valuation. Profit covers all time; Business Reports provides date filters.</p>}</InfoTooltip></div><ActionButton className={secondary} disabled={busy} onClick={() => run(async () => {}, 'Inventory refreshed.')}>Refresh</ActionButton></div>
    <div className="flex overflow-x-auto border-b border-gray-200">{departments.map(d => <ActionButton key={d.id} disabled={busy} onClick={() => { setModule(d.id); setSearch(''); }} className={`px-5 py-4 whitespace-nowrap text-xs font-black border-b-4 ${module === d.id ? 'border-yellow-400 bg-yellow-50 text-gray-900' : 'border-transparent text-gray-500'}`}>{d.label}</ActionButton>)}</div>
    <div className="flex flex-wrap justify-between gap-4"><div className="flex gap-1 rounded-xl bg-gray-100 p-1">{(['stock', 'products', ...(admin ? ['setup', 'reports'] as const : [])] as const).map(t => <ActionButton className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500'}`} key={t} disabled={busy} onClick={() => setTab(t)}>{t === 'stock' ? 'Materials' : t === 'products' ? 'Resale products' : t === 'setup' ? 'Setup' : 'Reports'}</ActionButton>)}</div>{admin && <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={inactive} onChange={e => setInactive(e.target.checked)} />Show inactive</label>}</div>
    {tab === 'products' && <input aria-label="Search inventory" className="bg-white rounded-xl border border-gray-200 px-4 py-3 w-full max-w-md" placeholder="Search inventoryâ€¦" value={search} onChange={e => setSearch(e.target.value)} />}

    {tab === 'stock' && <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search inventory" className="bg-white rounded-xl border border-gray-200 px-4 py-2.5 w-full sm:w-64 sm:flex-1" placeholder="Find material or variantâ€¦" value={search} onChange={e => setSearch(e.target.value)} />
        <ActionButton className={secondary} disabled={busy || !!search.trim()} onClick={() => setExpandedMaterials(new Set(groupMap.keys()))}>Expand all</ActionButton>
        <ActionButton className={secondary} disabled={busy || !!search.trim()} onClick={() => setExpandedMaterials(new Set())}>Collapse all</ActionButton>
        {admin && <ActionButton className={primary} disabled={busy} onClick={() => open({ kind: 'material', item: null })}>Add material</ActionButton>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 items-start">
        {[...groupMap].map(([id, name]) => {
          const items = variants.filter(v => v.categoryId === id), counted = items.filter(ready);
          const expansionKey = search.trim() ? `search-collapse:${search.trim()}:${id}` : id;
          const isExpanded = search.trim() ? !expandedMaterials.has(expansionKey) : expandedMaterials.has(expansionKey);
          const low = counted.filter(v => v.reorderLevelNeedsReview === false && v.unitsOnHand! <= v.reorderLevel).length;
          const pending = items.length - counted.length;
          return <section key={id} className={`min-w-0 bg-white rounded-2xl shadow-sm border overflow-hidden ${low ? 'border-amber-300' : 'border-gray-100'}`}>
            <ActionButton type="button" className="w-full text-left p-4 hover:bg-gray-50 transition-colors focus-visible:outline-yellow-400" aria-expanded={isExpanded} aria-controls={`material-${id}`} onClick={() => setExpandedMaterials(previous => { const next = new Set(previous); if (next.has(expansionKey)) next.delete(expansionKey); else next.add(expansionKey); return next; })}>
              <div className="flex justify-between items-start gap-3"><h3 className="text-sm font-black break-words">{name}</h3><span className="shrink-0 text-xs text-gray-400">{isExpanded ? 'Collapse âˆ’' : 'Expand +'}</span></div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500"><span>{items.length} {items.length === 1 ? 'variant' : 'variants'}</span><span className="font-bold text-gray-900">Unopened units: {counted.reduce((sum, v) => sum + v.unitsOnHand!, 0)}</span>{admin && <span>{ugx(counted.reduce((sum, v) => sum + v.unitsOnHand! * v.avgCostPerUnit!, 0))}</span>}</div>
              {(low > 0 || pending > 0) && <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-amber-700">{low > 0 && <span className="bg-amber-50 rounded-md px-2 py-1">{low} low stock</span>}{pending > 0 && <span className="bg-amber-50 rounded-md px-2 py-1">{pending} physical count required</span>}</div>}
            </ActionButton>
            {isExpanded && <div id={`material-${id}`} className="border-t border-gray-100">
              {items.map(item => {
                const migrated = ready(item), started = stockTransactions.filter(t => 'type' in t && t.type === 'Start' && (t.skuId === stockId(item) || t.skuId === item.skuId)).sort((a, b) => b.date.localeCompare(a.date))[0];
                const disabled = busy || !migrated || item.isActive === false || allMaterials.find(c => c.id === item.categoryId)?.isActive === false;
                const isLow = migrated && item.reorderLevelNeedsReview === false && item.unitsOnHand! <= item.reorderLevel;
                return <article key={stockId(item)} className={`p-4 space-y-3 border-b border-gray-100 last:border-b-0 ${isLow ? 'bg-amber-50' : ''}`}>
                  <div className="flex justify-between items-start gap-2"><div className="min-w-0"><p className="text-sm font-bold break-words">{item.variantLabel || item.itemName}</p><p className="text-xs text-gray-500 break-words">{item.itemName}{item.isActive === false ? ' Â· Inactive' : ''}</p></div><span className="shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold">{migrated ? `${item.unitsOnHand} ${item.unit || 'roll'}` : 'Count needed'}</span></div>
                  {admin && <dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-gray-400">Avg cost / unit</dt><dd className="font-bold mt-1">{migrated ? ugx(item.avgCostPerUnit!) : 'Pending migration'}</dd></div><div><dt className="text-gray-400">Total value</dt><dd className="font-bold mt-1">{migrated ? ugx(item.unitsOnHand! * item.avgCostPerUnit!) : 'Excluded'}</dd></div></dl>}
                  <p className="text-xs text-gray-500">Reorder units: {migrated && item.reorderLevelNeedsReview === false ? item.reorderLevel : 'Review in setup'}{isLow ? ' Â· Low stock' : ''}</p>
                  <div className="flex flex-wrap gap-2"><ActionButton className={secondary} disabled={disabled} onClick={() => open({ kind: 'receive', item, product: false })}>Receive stock</ActionButton><ActionButton className={primary} disabled={disabled || (!admin && item.unitsOnHand! < 1)} onClick={() => open({ kind: 'start', item })}>Start {item.unit || 'roll'}</ActionButton><ActionButton className="bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40" disabled={disabled || item.unitsOnHand! < 1} onClick={() => open({ kind: 'resell', item })}>Sell unopened</ActionButton>{admin && <ActionButton className={secondary} disabled={busy} onClick={() => open({ kind: 'variant', item })}>Edit setup</ActionButton>}</div>
                </article>;
              })}
              {!items.length && <Empty>No variants yet. Add widths, sizes or colours.</Empty>}
              {admin && categories.some(c => c.id === id && c.isActive !== false) && <div className="p-3 bg-gray-50"><ActionButton className={`${secondary} w-full`} disabled={busy} onClick={() => open({ kind: 'variants', category: categories.find(c => c.id === id)! })}>Add variants</ActionButton></div>}
            </div>}
          </section>;
        })}
      </div>
      {!groupMap.size && <Empty>{search.trim() ? 'No matching materials or variants.' : 'No materials in this department. An admin can add materials and variants in Setup.'}</Empty>}
    </div>}

    {tab === 'products' && module !== 'products' && <section className="bg-white rounded-3xl border border-gray-100 overflow-hidden"><div className="p-5 flex items-center gap-3"><h3 className="font-black">Unopened material resale</h3><InfoTooltip label="Material resale information">Quantity and purchase cost come from Materials. Set only the selling price here. Receive stock and Start unit update the same stock used by Material Sales in Calculator.</InfoTooltip></div><div className="overflow-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Product name', 'Variant', 'Unopened units', ...(admin ? ['Purchase cost / unit'] : []), 'Selling price / unit', 'Actions'].map(label => <th className={cell} key={label}>{label}</th>)}</tr></thead><tbody>{variants.map(item => <tr className="border-t border-gray-100" key={stockId(item)}><td className={cell}>{allMaterials.find(c => c.id === item.categoryId)?.name || item.itemName}</td><td className={cell}>{item.variantLabel || item.itemName}</td><td className={cell}>{ready(item) ? `${item.unitsOnHand} ${item.unit || 'roll'}` : 'Count needed'}</td>{admin && <td className={cell}>{ready(item) ? ugx(item.avgCostPerUnit!) : 'Cost review needed'}</td>}<td className={cell}>{item.resalePrice === undefined ? 'Not set' : ugx(item.resalePrice)}</td><td className={cell}><div className="flex flex-wrap gap-2">{admin && <ActionButton className={secondary} disabled={busy || item.isActive === false} onClick={() => open({ kind: 'resalePrice', item })}>Set selling price</ActionButton>}<ActionButton className={primary} disabled={busy || !ready(item) || item.isActive === false || item.unitsOnHand! < 1} onClick={() => open({ kind: 'resell', item })}>Sell unopened</ActionButton></div></td></tr>)}</tbody></table></div>{!variants.length && <Empty>No materials in this department.</Empty>}</section>}
    {tab === 'products' && module === 'products' && <section className="bg-white rounded-3xl border border-gray-100 overflow-hidden"><div className="p-5 flex justify-between"><h3 className="font-black">Resale products</h3>{admin && <ActionButton className={primary} onClick={() => open({ kind: 'product', item: null })}>Add product</ActionButton>}</div>
      <div className="overflow-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Product', 'Quantity', 'Selling price', ...(admin ? ['Purchase price / avg cost', 'Value at cost'] : []), 'Reorder', 'Actions'].map(h => <th key={h} className={cell}>{h}</th>)}</tr></thead><tbody>{products.map(p => <tr key={p.id} className={`border-t border-gray-100 ${p.quantity <= p.minStockLevel ? 'bg-amber-50' : ''}`}>
        <td className={cell}><p className="font-bold">{p.name}{p.isActive === false ? ' Â· Inactive' : ''}</p><p className="text-xs text-gray-500">{p.category} Â· {[p.attr1, p.attr2, p.attr3, p.attr4, p.attr5].filter(Boolean).join(' / ')} Â· {p.sku}</p></td><td className={cell}>{p.quantity}</td><td className={cell}>{ugx(p.price)}</td>{admin && <><td className={cell}>{missingCost(p) ? <span className="text-red-700 font-bold">Cost missing â€” edit to review</span> : ugx(p.avgCost ?? p.purchasePrice!)}</td><td className={cell}>{missingCost(p) ? 'Excluded: cost missing' : ugx(p.quantity * (p.avgCost ?? p.purchasePrice!))}</td></>}<td className={cell}>{p.minStockLevel}</td>
        <td className={cell}><div className="flex flex-wrap gap-2"><ActionButton className={secondary} disabled={busy || p.isActive === false} onClick={() => open({ kind: 'receive', item: p, product: true })}>Restock</ActionButton>{admin && <><ActionButton className={secondary} onClick={() => open({ kind: 'product', item: p })}>Edit</ActionButton>{activeButton('inventory', p.id, p.name, p.isActive)}</>}</div></td>
      </tr>)}</tbody></table></div>{!products.length && <Empty>No resale products in this department.</Empty>}</section>}

    {tab === 'setup' && admin && <div className="space-y-6"><section className="bg-white rounded-3xl p-6 space-y-4 border border-gray-100"><div className="flex justify-between"><h3 className="font-black">Materials and variants</h3><ActionButton className={primary} onClick={() => open({ kind: 'material', item: null })}>Add material</ActionButton></div>
      {categories.map(c => <div key={c.id} className="p-4 bg-gray-50 rounded-xl flex flex-wrap justify-between gap-3"><div><p className="font-bold">{c.name}{c.isActive === false ? ' Â· Inactive' : ''}</p><p className="text-xs text-gray-500">{c.unitType || 'roll'} Â· {stockItems.filter(s => s.categoryId === c.id).length} variants</p></div><div className="flex flex-wrap gap-2"><ActionButton className={secondary} disabled={c.isActive === false} onClick={() => open({ kind: 'variants', category: c })}>Add variants</ActionButton><ActionButton className={secondary} onClick={() => open({ kind: 'material', item: c })}>Edit</ActionButton>{activeButton('materialCategories', c.id, c.name, c.isActive)}</div></div>)}
      {!categories.length && <Empty>Add a material, choose its unit, then add its variants.</Empty>}</section>
      <section className="bg-white rounded-3xl p-6 space-y-4 border border-gray-100"><div className="flex justify-between"><h3 className="font-black">Calculator pricing tiers</h3><ActionButton className={primary} disabled={!categories.length} onClick={() => open({ kind: 'tier', item: null })}>Add tier</ActionButton></div>{pricingTiers.filter(t => allMaterials.some(c => c.id === t.categoryId)).map(t => <div key={t.id} className="flex justify-between items-center p-4 rounded-xl bg-gray-50"><span>{allMaterials.find(c => c.id === t.categoryId)?.name} Â· {t.name} Â· {ugx(t.value)} / {t.preset ? t.preset + ' sheet' : 'cm²'}</span><ActionButton className={secondary} onClick={() => open({ kind: 'tier', item: t })}>Edit</ActionButton></div>)}</section>
      {module === 'products' && <section className="bg-white rounded-3xl p-6 space-y-4 border border-gray-100"><div className="flex justify-between"><h3 className="font-black">Resale product categories</h3><ActionButton className={primary} onClick={() => open({ kind: 'productCategory', item: null })}>Add category</ActionButton></div>{productTypes.map(c => <div key={c.id} className="flex flex-wrap justify-between gap-3 p-4 rounded-xl bg-gray-50"><span className="font-bold">{c.name}{c.isActive === false ? ' Â· Inactive' : ''}</span><div className="flex gap-2"><ActionButton className={secondary} onClick={() => open({ kind: 'productCategory', item: c })}>Edit fields</ActionButton>{activeButton('productCategories', c.id, c.name, c.isActive)}</div></div>)}</section>}</div>}

    {tab === 'reports' && admin && <section className="bg-white rounded-3xl p-6 space-y-4 border border-gray-100"><InventoryPurchaseReport module={module} transactions={stockTransactions} stock={stockItems} categories={materialCategories} products={inventory} /></section>}

    <Modal isOpen={dialog !== null} onClose={() => { if (!busy) setDialog(null); }} title={dialog?.kind === 'resell' ? 'Sell unopened material' : dialog?.kind === 'receive' ? (dialog.product ? 'Restock product' : 'Receive stock') : dialog?.kind === 'start' ? `Start ${dialog.item.unit || 'roll'}` : dialog?.kind === 'active' ? (dialog.active ? 'Reactivate record' : 'Deactivate record') : 'Inventory setup'} size="lg">
      {dialog && <><fieldset disabled={busy} className="space-y-4 min-w-0">
        {dialog.kind === 'resalePrice' && admin && <ResalePriceForm item={dialog.item} onSave={price => run(() => setup.setMaterialResalePrice(stockId(dialog.item), price), 'Selling price saved.')} />}
        {dialog.kind === 'resell' && <MaterialResaleForm item={dialog.item} onSave={(quantity, price) => {
          props.onResellMaterial({ itemId: `material-resale-${stockId(dialog.item)}-${Date.now()}`, materialSkuId: stockId(dialog.item), stockEntity: 'material', name: `${dialog.item.itemName} (unopened ${dialog.item.unit || 'roll'})`, quantity, price, module: dialog.item.module as Department });
          setDialog(null);
        }} />}
        {dialog.kind === 'receive' && <ReceiveForm item={dialog.item} product={dialog.product} admin={admin} onSave={data => run(() => dialog.product ? stock.restockProduct((dialog.item as InventoryItem).id, data) : stock.receiveStock(stockId(dialog.item as StockItem), data), 'Stock received.')} />}
        {dialog.kind === 'start' && <StartForm item={dialog.item} admin={admin} onSave={(charged, notes, override) => run(() => stock.startUnit(stockId(dialog.item), charged, { notes, adminOverride: override }), 'Unit started.')} />}
        {dialog.kind === 'material' && admin && <MaterialForm item={dialog.item} module={module} onSave={(name, unit) => run(() => setup.saveMaterial(dialog.item?.id || null, name, module, unit), 'Material saved.')} />}
        {dialog.kind === 'variants' && admin && <VariantsForm category={dialog.category} onSave={(text, reorder, length) => run(() => setup.addVariants(dialog.category.id, text, reorder, length), 'Variants created. Receive stock to add units.')} />}
        {dialog.kind === 'variant' && admin && <VariantForm item={dialog.item} onSave={(itemName, reorderLevel, rollLengthMeters) => run(() => setup.editVariant(stockId(dialog.item), { itemName, reorderLevel, rollLengthMeters }), 'Variant setup saved.')} onActive={() => open({ kind: 'active', collection: 'stockItems', id: stockId(dialog.item), name: dialog.item.itemName, active: dialog.item.isActive === false })} />}
        {dialog.kind === 'product' && admin && <ProductForm item={dialog.item} module={module} categories={productTypes} onSave={(data, opening, cost) => run(() => setup.saveProduct(dialog.item?.id || null, data, opening, cost), 'Product saved.')} />}
        {dialog.kind === 'productCategory' && admin && <ProductCategoryForm item={dialog.item} onSave={(name, fields) => run(() => setup.saveProductCategory(dialog.item?.id || null, { name, module, field1: fields[0], field2: fields[1], field3: fields[2], field4: fields[3], field5: fields[4] }), 'Product category saved.')} />}
        {dialog.kind === 'tier' && admin && <TierForm item={dialog.item} categories={allMaterials} onSave={(id, name, value, preset) => run(() => setup.saveTier(dialog.item?.id || null, id, name, value, preset), 'Pricing tier saved.')} />}
        {dialog.kind === 'active' && admin && <div className="space-y-4"><p>{dialog.active ? 'Reactivate' : 'Deactivate'} <strong>{dialog.name}</strong>?</p><InfoTooltip label="Deactivation information">The record and movement history are retained. Inactive records are hidden from new selections.</InfoTooltip><ActionButton className={primary} onClick={() => run(() => setup.setActive(dialog.collection, dialog.id, dialog.active), dialog.active ? 'Record reactivated.' : 'Record deactivated.')}>Confirm {dialog.active ? 'reactivation' : 'deactivation'}</ActionButton></div>}
      </fieldset>{busy && <p role="status" className="mt-4 text-sm">Savingâ€¦</p>}{error && <p role="alert" className="text-red-600 mt-4">{error}</p>}</>}
    </Modal>
  </div>;
}

function MaterialResaleForm({ item, onSave }: { item: StockItem; onSave: (units: number, price: number) => void }) {
  const [units, setUnits] = useState('1'), [price, setPrice] = useState(item.resalePrice === undefined ? '' : String(item.resalePrice));
  return <ActionForm className="space-y-4" onSubmit={e => { e.preventDefault(); if (Number(units) >= 1 && Number(units) <= item.unitsOnHand! && Number.isSafeInteger(Number(units))) onSave(Number(units), Number(price)); }}>
    <p className="font-bold">{item.itemName}</p><p className="text-sm text-gray-500">Available: {item.unitsOnHand} unopened {item.unit || 'roll'} units. <InfoTooltip label="Resale information">Stock is reserved only when the sale is saved.</InfoTooltip></p>
    <Numeric label="Whole unopened units to sell" value={units} onChange={setUnits} /><Numeric label="Selling price per unit (UGX)" value={price} onChange={setPrice} step="any" />
    {Number(units) > item.unitsOnHand! && <p role="alert" className="text-red-600">Quantity exceeds available unopened stock.</p>}
    <ActionButton className={primary} disabled={Number(units) < 1 || Number(units) > item.unitsOnHand!}>Continue to invoice</ActionButton>
  </ActionForm>;
}
function ReceiveForm({ item, product, admin, onSave }: { item: StockItem | InventoryItem; product: boolean; admin: boolean; onSave: (input: { units: number; unitCost: number; supplier: string; paymentStatus: 'Paid' | 'Credit'; freightTotal: number; reference: string }) => Promise<void> }) {
  const [units, setUnits] = useState(''), [cost, setCost] = useState(''), [freight, setFreight] = useState('0'), [supplier, setSupplier] = useState(''), [reference, setReference] = useState('');
  const [payment, setPayment] = useState<'Paid' | 'Credit'>('Paid');
  return <ActionForm className="space-y-4" onSubmit={e => { e.preventDefault(); return onSave({ units: Number(units), unitCost: Number(cost), supplier, paymentStatus: payment, freightTotal: Number(freight), reference }); }}><div className="flex justify-end"><InfoTooltip label="Form information">Enter this receipt's invoice price. Freight is spread across units. Material purchases belong in inventory, not operating expenses.</InfoTooltip></div><p className="font-bold">{product ? (item as InventoryItem).name : (item as StockItem).itemName}</p>
    <div className="grid sm:grid-cols-2 gap-4"><Numeric label="Units received" value={units} onChange={setUnits} /><Numeric label="Invoice unit price (UGX)" value={cost} onChange={setCost} step="any" /><Numeric label="Freight total (UGX, optional)" value={freight} onChange={setFreight} step="any" required={false} /><Field label="Payment status"><select className={input} value={payment} onChange={e => setPayment(e.target.value as 'Paid' | 'Credit')}><option>Paid</option><option>Credit</option></select></Field></div><Field label="Supplier"><input className={input} value={supplier} onChange={e => setSupplier(e.target.value)} required /></Field><Field label="Invoice / reference (optional)"><input className={input} value={reference} onChange={e => setReference(e.target.value)} /></Field>
    {admin && Number(units) > 0 && cost !== '' && <p>Landed receipt value: <strong>{ugx(Number(units) * Number(cost) + Number(freight))}</strong></p>}<ActionButton className={primary}>Confirm receipt</ActionButton></ActionForm>;
}
function StartForm({ item, admin, onSave }: { item: StockItem; admin: boolean; onSave: (module: Department, notes: string, override: boolean) => Promise<void> }) {
  const [module, setModule] = useState<Department>(item.module as Department), [notes, setNotes] = useState(''), [override, setOverride] = useState(false);
  const short = (item.unitsOnHand ?? 0) < 1;
  return <ActionForm className="space-y-4" onSubmit={e => { e.preventDefault(); return onSave(module, notes, override); }}><p className="font-bold">{item.itemName}</p><InfoTooltip label="Start unit information">Starting one {item.unit || 'roll'} removes it from unopened stock. The latest average cost is read on confirmation.</InfoTooltip>{admin && <p className="p-4 rounded-xl bg-yellow-50">Cost charged to COGS: <strong>{ugx(item.avgCostPerUnit ?? 0)}</strong></p>}<Field label="Department charged"><select className={input} value={module} onChange={e => setModule(e.target.value as Department)} required>{departments.map(d => <option value={d.id} key={d.id}>{d.label}</option>)}</select></Field><Field label="Notes (optional)"><textarea className={input} value={notes} onChange={e => setNotes(e.target.value)} /></Field>{admin && short && <label className="block text-sm text-red-700"><input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} /> Admin override: allow negative stock and record this override.</label>}<ActionButton className={primary} disabled={short && !override}>Confirm start</ActionButton></ActionForm>;
}
function MaterialForm({ item, module, onSave }: { item: MaterialCategory | null; module: Department; onSave: (name: string, unit: StockUnit) => Promise<void> }) {
  const [name, setName] = useState(item?.name || ''), [unit, setUnit] = useState<StockUnit>(item?.unitType || 'roll');
  return <ActionForm className="space-y-4" onSubmit={e => { e.preventDefault(); return onSave(name, unit); }}><div className="flex justify-end"><InfoTooltip label="Form information">Save, then add widths, paper sizes or colours as variants.</InfoTooltip></div><p>{departments.find(d => d.id === module)?.label}</p><Field label="Material name"><input className={input} value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Flex Banner or Toner" /></Field><Field label="Unit type"><select className={input} disabled={!!item} value={unit} onChange={e => setUnit(e.target.value as StockUnit)}>{stockUnits.map(u => <option key={u}>{u}</option>)}</select></Field><ActionButton className={primary}>Save material</ActionButton></ActionForm>;
}
function VariantsForm({ category, onSave }: { category: MaterialCategory; onSave: (text: string, reorder: number, length?: number) => Promise<void> }) {
  const [text, setText] = useState(''), [reorder, setReorder] = useState('1'), [length, setLength] = useState('');
  return <ActionForm className="space-y-4" onSubmit={e => { e.preventDefault(); return onSave(text, Number(reorder), length === '' ? undefined : Number(length)); }}><div className="flex justify-end"><InfoTooltip label="Form information">Up to 40 variants. Each opens at zero; Receive stock records purchases.</InfoTooltip></div><p className="font-bold">{category.name} Â· {category.unitType || 'roll'}</p><Field label="Variants, separated by commas or new lines"><textarea className={input} rows={4} value={text} onChange={e => setText(e.target.value)} required placeholder={(category.unitType || 'roll') === 'roll' ? '1.07, 1.1, 1.3, 1.6, 1.8' : 'A3, A4 or Cyan, Magenta, Yellow, Black'} /></Field><Numeric label="Reorder level (unopened units)" value={reorder} onChange={setReorder} />{(category.unitType || 'roll') === 'roll' && <Numeric label="Roll length in meters (reference only, optional)" value={length} onChange={setLength} step="any" required={false} />}<ActionButton className={primary}>Create variants</ActionButton></ActionForm>;
}
function VariantForm({ item, onSave, onActive }: { item: StockItem; onSave: (name: string, reorder: number, length?: number) => Promise<void>; onActive: () => void }) {
  const [name, setName] = useState(item.itemName), [reorder, setReorder] = useState(String(item.reorderLevel)), [length, setLength] = useState(item.rollLengthMeters === undefined ? '' : String(item.rollLengthMeters));
  return <ActionForm className="space-y-4" onSubmit={e => { e.preventDefault(); return onSave(name, Number(reorder), length === '' ? undefined : Number(length)); }}><div className="flex justify-end"><InfoTooltip label="Form information">Quantity and average cost cannot be edited here.</InfoTooltip></div><Field label="Variant display name"><input className={input} value={name} onChange={e => setName(e.target.value)} required /></Field><Numeric label="Reorder level (units, not meters)" value={reorder} onChange={setReorder} />{(item.unit || 'roll') === 'roll' && <Numeric label="Roll length in meters (reference only)" value={length} onChange={setLength} step="any" required={false} />}<div className="flex gap-3"><ActionButton className={primary}>Save setup</ActionButton><ActionButton type="button" className={secondary} onClick={onActive}>{item.isActive === false ? 'Reactivate' : 'Deactivate'}</ActionButton></div></ActionForm>;
}
function ProductForm({ item, module, categories, onSave }: { item: InventoryItem | null; module: Department; categories: ProductCategory[]; onSave: (data: ProductDetails, opening: number, cost?: number) => Promise<void> }) {
  const [data, setData] = useState<ProductDetails>({ name: item?.name || '', category: item?.category || '', module, sku: item?.sku || '', price: item?.price ?? 0, minPrice: item?.minPrice ?? 0, minStockLevel: item?.minStockLevel ?? 1, attr1: item?.attr1 || '', attr2: item?.attr2 || '', attr3: item?.attr3 || '', attr4: item?.attr4 || '', attr5: item?.attr5 || '' });
  const [opening, setOpening] = useState('0'), [cost, setCost] = useState('');
  const needsCost = !item || missingCost(item), category = categories.find(c => c.name === data.category);
  const set = <K extends keyof ProductDetails>(key: K, value: ProductDetails[K]) => setData({ ...data, [key]: value });
  return <ActionForm className="space-y-4" onSubmit={e => { e.preventDefault(); return onSave(data, Number(opening), needsCost ? Number(cost) : undefined); }}><div className="grid sm:grid-cols-2 gap-4"><Field label="Product name"><input className={input} value={data.name} onChange={e => set('name', e.target.value)} required /></Field><Field label="SKU"><input className={input} value={data.sku} onChange={e => set('sku', e.target.value)} /></Field><Field label="Product category"><select className={input} value={data.category} onChange={e => set('category', e.target.value)} required><option value="">Choose category</option>{item?.category && !categories.some(c => c.name === item.category) && <option>{item.category}</option>}{categories.filter(c => c.isActive !== false || c.name === item?.category).map(c => <option key={c.id}>{c.name}</option>)}</select></Field><Numeric label="Selling price (UGX)" value={String(data.price)} onChange={v => set('price', Number(v))} step="any" /><Numeric label="Minimum selling price (UGX)" value={String(data.minPrice)} onChange={v => set('minPrice', Number(v))} step="any" /><Numeric label="Reorder level (units)" value={String(data.minStockLevel)} onChange={v => set('minStockLevel', Number(v))} />{!item && <Numeric label="Opening quantity (creation only)" value={opening} onChange={setOpening} />}{needsCost ? <Numeric label={item ? 'Reviewed purchase price (UGX)' : 'Purchase price per unit (UGX)'} value={cost} onChange={setCost} step="any" /> : <p className="text-sm">Current purchase cost: {ugx(item.avgCost ?? item.purchasePrice!)} <InfoTooltip label="Purchase cost information">Restock updates weighted average cost.</InfoTooltip></p>}
      {(['attr1', 'attr2', 'attr3', 'attr4', 'attr5'] as const).map((key, i) => { const label = category?.[`field${i + 1}` as 'field1' | 'field2' | 'field3' | 'field4' | 'field5']; return label ? <Field key={key} label={label}><input className={input} value={data[key]} onChange={e => set(key, e.target.value)} /></Field> : null; })}</div>{item && <p className="text-xs text-gray-500">Current quantity: {item.quantity} <InfoTooltip label="Quantity information">Use Restock to add units; quantity cannot be edited in this form.</InfoTooltip></p>}<ActionButton className={primary}>Save product</ActionButton></ActionForm>;
}
function ProductCategoryForm({ item, onSave }: { item: ProductCategory | null; onSave: (name: string, fields: string[]) => Promise<void> }) {
  const [name, setName] = useState(item?.name || ''), [fields, setFields] = useState([item?.field1 || '', item?.field2 || '', item?.field3 || '', item?.field4 || '', item?.field5 || '']);
  return <ActionForm className="space-y-4" onSubmit={e => { e.preventDefault(); return onSave(name, fields); }}><Field label="Category name"><input className={input} value={name} readOnly={!!item} onChange={e => setName(e.target.value)} required /></Field>{fields.map((value, i) => <Field label={`Attribute ${i + 1} label (optional)`} key={i}><input className={input} value={value} onChange={e => setFields(fields.map((v, index) => index === i ? e.target.value : v))} /></Field>)}<ActionButton className={primary}>Save category</ActionButton></ActionForm>;
}
function TierForm({ item, categories, onSave }: { item: PricingTier | null; categories: MaterialCategory[]; onSave: (id: string, name: string, value: number, preset: 'A4' | 'A3' | null) => Promise<void> }) {
  const [preset,setPreset]=useState<'A4'|'A3'|null>(item?.preset||null);
  const [category, setCategory] = useState(item?.categoryId || ''), [name, setName] = useState(item?.name || ''), [value, setValue] = useState(item ? String(item.value) : '');
  return <ActionForm className="space-y-4" onSubmit={e => { e.preventDefault(); return onSave(category, name, Number(value), categories.find(c=>c.id===category)?.module==='dtf'?preset:null); }}><Field label="Material"><select className={input} value={category} onChange={e => setCategory(e.target.value)} required><option value="">Choose material</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Tier name"><input className={input} value={name} onChange={e => setName(e.target.value)} required /></Field>{categories.find(c=>c.id===category)?.module==='dtf'&&<Field label="Price applies to"><select className={input} value={preset||''} onChange={e=>setPreset((e.target.value||null) as 'A4'|'A3'|null)}><option value="">Custom size (per cm²)</option><option value="A4">A4 sheet</option><option value="A3">A3 sheet</option></select></Field>}<Numeric label={preset ? `Price per ${preset} sheet (UGX)` : 'Price per cm² (UGX)'} value={value} onChange={setValue} step="any" /><ActionButton className={primary}>Save tier</ActionButton></ActionForm>;
}

function ResalePriceForm({ item, onSave }: { item: StockItem; onSave: (price: number) => Promise<void> }) {
  const [price, setPrice] = useState(item.resalePrice === undefined ? '' : String(item.resalePrice));
  return <ActionForm className="space-y-4" onSubmit={e => { e.preventDefault(); return onSave(Number(price)); }}><p className="font-bold">{item.itemName}</p><Numeric label="Selling price per unopened unit (UGX)" value={price} onChange={setPrice} step="any" /><ActionButton className={primary}>Save selling price</ActionButton></ActionForm>;
}



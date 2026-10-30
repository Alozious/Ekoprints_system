import ActionButton from './ActionButton';
import React,{useEffect,useMemo,useState} from 'react';
import { purchaseHistory } from '../inventoryPurchaseHistory';
import { businessDay } from '../reportAccounting';
import InfoTooltip from './InfoTooltip';
import type { Department,InventoryItem,MaterialCategory,StockItem,StockTransaction } from '../types';
const money=(n:number)=>`${new Intl.NumberFormat('en-UG',{maximumFractionDigits:0}).format(n)} UGX`;
const labels:Record<string,string>={'large-format':'Large Format',dtf:'DTF',embroidery:'Embroidery',bizhub:'Digital / Bizhub',supplies:'Supplies',products:'Other Products',Unassigned:'Unassigned'};
export default function InventoryPurchaseReport({transactions,stock,categories,products,module}:{transactions:StockTransaction[];stock:StockItem[];categories:MaterialCategory[];products:InventoryItem[];module:Department}){
  const [material,setMaterial]=useState(''),[variant,setVariant]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[page,setPage]=useState(1);
  useEffect(()=>{setMaterial('');setVariant('');setPage(1);},[module]);
  const all=useMemo(()=>purchaseHistory(transactions,stock,categories,products),[transactions,stock,categories,products]);
  const scoped=all.filter(r=>r.department===module);
  const materials=[...new Map<string,string>(scoped.map(r=>[r.materialId,r.material] as [string,string])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const variants=[...new Map<string,string>(scoped.filter(r=>!material||r.materialId===material).map(r=>[r.skuId,r.variant] as [string,string])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const rows=scoped.filter(r=>(!material||r.materialId===material)&&(!variant||r.skuId===variant)&&(!start||businessDay(r.date)>=start)&&(!end||businessDay(r.date)<=end));
  let missingValues=0;
  const inventoryValue=rows.reduce((sum,r)=>{
    if(r.remaining<=0)return sum;
    const item=stock.find(s=>(s.id||s.skuId)===r.skuId||s.skuId===r.skuId);
    const product=!item?products.find(p=>p.id===r.skuId):undefined;
    const cost=item?.avgCostPerUnit ?? product?.avgCost ?? product?.purchasePrice;
    if(typeof cost!=='number'||!Number.isFinite(cost)||cost<0||product?.costMissing){missingValues++;return sum;}
    return sum+r.remaining*cost;
  },0);
  const totalPages=Math.max(1,Math.ceil(rows.length/20)),current=Math.min(page,totalPages);
  const field='border border-gray-200 rounded-xl p-2 text-sm bg-white min-w-0';
  const date=(d:string)=>new Date(d).toLocaleString('en-GB',{timeZone:'Africa/Kampala',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  return <section className="space-y-4" aria-label="Inventory purchase history">
    <div className="flex flex-wrap justify-between items-center gap-3"><div className="flex items-center gap-2"><h3 className="font-black text-lg">Purchase history · {labels[module]}</h3><InfoTooltip label="Purchase history information"><p>Includes inactive variants. Used/resold dates are allocated from stock movements in purchase order (FIFO), not recorded batch links. This does not change accounting costs. Opening counts and stock corrections are not purchases; shortages and missing history are not assigned invented usage dates.</p><p>Inventory value covers the unissued units from purchases matching the department, material, variant and purchase-date filters, valued at the current stored average cost. It is a current remaining value, not a historical closing balance.</p>{missingValues>0&&<p>{missingValues} purchase rows have no usable current cost and are excluded from inventory value.</p>}</InfoTooltip></div><p className="text-sm font-bold">Inventory value: <span className="text-lg text-gray-900">{money(inventoryValue)}</span></p></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <label className="text-xs font-bold flex flex-col gap-1">Material / product<select className={field} value={material} onChange={e=>{setMaterial(e.target.value);setVariant('');setPage(1);}}><option value="">All materials</option>{materials.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label className="text-xs font-bold flex flex-col gap-1">Variant<select className={field} value={variant} onChange={e=>{setVariant(e.target.value);setPage(1);}}><option value="">All variants</option>{variants.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label className="text-xs font-bold flex flex-col gap-1">Purchased from<input className={field} type="date" value={start} onChange={e=>{setStart(e.target.value);setPage(1);}}/></label>
      <label className="text-xs font-bold flex flex-col gap-1">Purchased to<input className={field} type="date" value={end} min={start} onChange={e=>{setEnd(e.target.value);setPage(1);}}/></label>
    </div>
    {start&&end&&start>end&&<p role="alert" className="text-red-600 text-sm">The end date must be on or after the start date.</p>}
    <div className="flex flex-wrap justify-between gap-3 items-center text-sm"><p><strong>{rows.length}</strong> purchases · <strong>{rows.reduce((s,r)=>s+r.units,0)}</strong> units · Total bought: <strong>{money(rows.reduce((s,r)=>s+r.total,0))}</strong></p><ActionButton className="text-xs font-bold bg-gray-100 px-3 py-2 rounded-xl" onClick={()=>{setMaterial('');setVariant('');setStart('');setEnd('');setPage(1);}}>Clear filters</ActionButton></div>
    <div className="overflow-x-auto border border-gray-100 rounded-2xl"><table className="w-full text-xs text-left"><thead className="bg-gray-50"><tr>{['Department','Purchased (Uganda)','Material / product','Variant','Supplier','Quantity','Price / unit','Total bought','Used / resold (FIFO)','Unissued from purchase'].map(h=><th key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.slice((current-1)*20,current*20).map(r=><tr key={r.id} className="border-t border-gray-100 align-top"><td className="p-3">{labels[r.department]}</td><td className="p-3 whitespace-nowrap">{date(r.date)}{r.estimated&&<span className="block text-amber-700">Estimated date</span>}</td><td className="p-3 font-bold">{r.material}</td><td className="p-3">{r.variant}</td><td className="p-3">{r.supplier}</td><td className="p-3">{r.units}</td><td className="p-3 whitespace-nowrap">{money(r.unitCost)}</td><td className="p-3 whitespace-nowrap font-bold">{money(r.total)}</td><td className="p-3 min-w-[230px]">{r.uses.length?r.uses.map(u=><div key={u.movementId}>{u.type} {u.units} · {date(u.date)}</div>):'No recorded use / resale'}</td><td className="p-3">{r.remaining}</td></tr>)}{!rows.length&&<tr><td className="p-6 text-center text-gray-500" colSpan={10}>No purchases match these filters.</td></tr>}</tbody></table></div>
    <div className="flex justify-end gap-3 items-center text-xs"><ActionButton disabled={current===1} onClick={()=>setPage(current-1)} className="p-2 bg-gray-100 rounded-lg disabled:opacity-40">Previous</ActionButton><span>Page {current} of {totalPages}</span><ActionButton disabled={current===totalPages} onClick={()=>setPage(current+1)} className="p-2 bg-gray-100 rounded-lg disabled:opacity-40">Next</ActionButton></div>
  </section>;
}

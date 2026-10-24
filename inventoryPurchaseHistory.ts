import type { InventoryItem, MaterialCategory, StockItem, StockTransaction } from './types';
import { department } from './stockMath.ts';
export interface PurchaseHistoryRow {
  id: string; skuId: string; department: string; materialId: string; material: string; variant: string;
  date: string; supplier: string; units: number; unitCost: number; total: number; estimated: boolean;
  uses: { date: string; units: number; type: 'Used' | 'Resold'; movementId: string }[]; remaining: number;
}
/** FIFO is a report allocation, not a recorded supplier-lot link or a change to average-cost COGS. */
export function purchaseHistory(transactions: StockTransaction[], stock: StockItem[], categories: MaterialCategory[], products: InventoryItem[]): PurchaseHistoryRow[] {
  const rows: PurchaseHistoryRow[] = [];
  type Lot = { units: number; row?: PurchaseHistoryRow };
  const balances = new Map<string, Lot[]>();
  const issues = new Map<string, { lot: Lot; units: number; use?: PurchaseHistoryRow['uses'][number] }[]>();
  const ordered = transactions.filter(t => 'type' in t && t.units !== 0).sort((a,b)=>a.date.localeCompare(b.date) || ({Opening:0,Purchase:1,Reversal:2,Adjustment:3,Start:4,Sale:4}[(a as any).type] - {Opening:0,Purchase:1,Reversal:2,Adjustment:3,Start:4,Sale:4}[(b as any).type]));
  for (const t of ordered) {
    if (!('type' in t)) continue;
    const key = `${t.entity}:${t.skuId}`;
    const lots = balances.get(key) || []; balances.set(key,lots);
    if (t.type === 'Reversal' && t.units > 0) {
      let remaining=t.units;
      for(const allocation of issues.get(t.reverses || '') || []) {
        const restored=Math.min(remaining,allocation.units); allocation.lot.units+=restored;allocation.units-=restored;
        if(allocation.use)allocation.use.units-=restored;remaining-=restored;if(remaining<=0)break;
      }
      if(remaining>0)lots.push({units:remaining});
      continue;
    }
    if(t.type==='Purchase' && t.units>0){
      const item=t.entity==='material'?stock.find(s=>(s.id||s.skuId)===t.skuId||s.skuId===t.skuId):products.find(p=>p.id===t.skuId);
      const material=t.entity==='material'?categories.find(c=>c.id===(item as StockItem|undefined)?.categoryId):undefined;
      const row:PurchaseHistoryRow={id:t.transactionId,skuId:t.skuId,department:department(t.module || item?.module),materialId:material?.id || (t.entity==='product'?'product:':'unknown:')+t.skuId,material:material?.name || (material as MaterialCategory & {categoryName?:string})?.categoryName || (item && ('itemName' in item?item.itemName:item.name)) || t.skuId,variant:item && ('itemName' in item?(item.variantLabel||item.itemName):item.name) || t.skuId,date:t.date,supplier:t.supplier?.trim()||'Not recorded',units:t.units,unitCost:t.unitCost,total:t.totalValue,estimated:!!(t as any).dateEstimated,uses:[],remaining:t.units};
      rows.push(row);lots.push({units:t.units,row});continue;
    }
    if((t.type==='Opening'||t.type==='Adjustment')&&t.units>0){lots.push({units:t.units});continue;}
    if(t.units<0){let remaining=-t.units;const allocations: {lot:Lot;units:number;use?:PurchaseHistoryRow['uses'][number]}[]=[];
      for(const lot of lots){if(lot.units<=0)continue;const units=Math.min(lot.units,remaining);lot.units-=units;remaining-=units;
        const use=lot.row&&(t.type==='Start'||t.type==='Sale')?{date:t.date,units,type:t.type==='Start'?'Used' as const:'Resold' as const,movementId:t.transactionId}:undefined;
        if(use)lot.row!.uses.push(use);allocations.push({lot,units,use});if(remaining<=0)break;}
      issues.set(t.transactionId,allocations);
    }
  }
  for(const lots of balances.values())for(const lot of lots)if(lot.row){lot.row.remaining=lot.units;lot.row.uses=lot.row.uses.filter(u=>u.units>0);}
  return rows.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}


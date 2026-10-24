import type { SaleItem } from './types.ts';
import { nonNegative, positive, wholeUnits, department } from './stockMath.ts';
export function invoiceItems(document: {items:SaleItem[];internalComplementary?:boolean}): SaleItem[] {
  if(document.internalComplementary)return document.items;
  const result:SaleItem[]=[];
  for(const item of document.items.filter(i=>!i.complementaryFor)){
    const complements=document.items.filter(i=>i.complementaryFor===item.itemId);
    if(!complements.length){result.push(item);continue;}
    const charge=complements.reduce((sum,i)=>sum+(i.complementaryUnitPrice||0)*i.quantity,0);
    const remainder=item.price*item.quantity-charge;
    result.push({...item,price:Math.max(0,remainder)/item.quantity});
    if(remainder<0)result.push({itemId:item.itemId+'-adjustment',name:'Finished-work price adjustment',quantity:1,price:remainder});
    let others=0;
    for(const part of complements){
      const price=part.complementaryUnitPrice||0;
      if(part.showComplementaryOnInvoice)result.push({...part,price});
      else others+=price*part.quantity;
    }
    if(others)result.push({itemId:item.itemId+'-others',name:'Others',quantity:1,price:others});
  }
  return result;
}
/** Quotations retain draft costs for conversion, but never a posted COGS snapshot. */
export function quotationItems(items:SaleItem[]):SaleItem[]{
  return items.map(({cogsAtSale: _postedCogs,...draft})=>draft);
}
export function directOrderCogs(item: SaleItem): number {
  if(!item.directCosts)return 0;
  if(item.metadata?.tab!=='kuyiriba')throw Error('Direct buying costs require a Kuyiriba order item.');
  const {buyingPrice,otherCost,otherDescription,otherRows}=item.directCosts;
  nonNegative(buyingPrice,'Buying price');nonNegative(otherCost,'Other cost');positive(wholeUnits(item.quantity),'Quantity');
  const extra=otherRows ? otherRows.reduce((sum,row)=>{nonNegative(row.amount,'Other cost');if(row.amount>0&&!row.description.trim())throw Error('Describe each other cost.');return sum+row.amount;},0) : otherCost;
  if(!otherRows&&otherCost>0&&!otherDescription.trim())throw Error('Describe the other costs.');
  return nonNegative((buyingPrice+extra)*item.quantity,'Total direct costs');
}
export function kuyiribaLines(description:string,buyingPrice:number,sellingPrice:number,otherDescription:string,otherCost:number,quantity:number,complement?:SaleItem,otherRows?:{description:string;amount:number}[]):SaleItem[]{
  if(!description.trim())throw Error('Enter the item description.');
  nonNegative(sellingPrice,'Customer selling price');positive(wholeUnits(quantity),'Quantity');
  const item:SaleItem={itemId:'kuyiriba-'+Date.now(),name:description.trim(),quantity,price:sellingPrice,module:department(complement?.module||complement?.metadata?.tab),directCosts:{buyingPrice,otherCost,otherDescription:otherDescription.trim(),...(otherRows?{otherRows}: {})},metadata:{type:'manual',tab:'kuyiriba',manualItemName:description.trim(),manualPrice:sellingPrice,manualQuantity:quantity}};
  directOrderCogs(item);
  if(!complement)return [item];
  positive(complement.quantity,'Complementary quantity');nonNegative(complement.price,'Complementary selling price');
  return [item,{...complement,itemId:item.itemId+'-complement',name:`${description.trim()} · ${complement.name}`,quantity:complement.quantity*quantity,price:0,complementaryFor:item.itemId,complementaryUnitPrice:complement.price,complementaryQuantityPerItem:complement.quantity}];
}

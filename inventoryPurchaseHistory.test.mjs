import {test} from 'node:test';import assert from 'node:assert/strict';import {purchaseHistory} from './inventoryPurchaseHistory.ts';
const stock=[{id:'roll',skuId:'legacy-roll',itemName:'Hello Banner 1.3 m',variantLabel:'1.3 m',categoryId:'banner',module:'large-format'}];const categories=[{id:'banner',name:'Hello Banner'}];
const m=(id,type,units,date,extra={})=>({transactionId:id,type,units,date,skuId:'roll',entity:'material',unitCost:100,totalValue:Math.abs(units)*100,module:'large-format',...extra});
test('purchase report allocates partial use and resale chronologically without treating openings as purchases',()=>{
const rows=purchaseHistory([m('sale','Sale',-2,'2026-03-01'),m('purchase','Purchase',3,'2026-02-01',{supplier:'Extreme'}),m('opening','Opening',1,'2026-01-01'),m('use','Start',-1,'2026-02-10'),m('zero','Purchase',0,'2026-03-01')],stock,categories,[]);
assert.equal(rows.length,1);assert.equal(rows[0].material,'Hello Banner');assert.equal(rows[0].supplier,'Extreme');assert.equal(rows[0].remaining,1);assert.deepEqual(rows[0].uses.map(u=>[u.type,u.units]),[['Resold',2]]);
});
test('reversal removes reversed resale allocation and restores the purchase units',()=>{
const rows=purchaseHistory([m('buy','Purchase',2,'2026-01-01'),m('sell','Sale',-2,'2026-01-02'),m('undo','Reversal',2,'2026-01-03',{reverses:'sell'}),m('start','Start',-1,'2026-01-04')],stock,categories,[]);
assert.equal(rows[0].remaining,1);assert.deepEqual(rows[0].uses.map(u=>u.type),['Used']);
});
test('use before a purchase is not assigned an invented later purchase date and missing supplier stays unknown',()=>{
const rows=purchaseHistory([m('start','Start',-1,'2026-01-01'),m('buy','Purchase',1,'2026-01-02',{dateEstimated:true})],stock,categories,[]);
assert.equal(rows[0].uses.length,0);assert.equal(rows[0].remaining,1);assert.equal(rows[0].supplier,'Not recorded');assert.equal(rows[0].estimated,true);
});

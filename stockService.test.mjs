import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import {quotationItems,kuyiribaLines} from './kuyiriba.ts';
// In-memory transaction adapter: staged writes commit only on success and reads after
// writes fail, mirroring the Firestore transaction ordering requirement. No network.
const mock = `
let sequence = 0;
export function collection(db, path) { return { db, path }; }
export function doc(a, b, c) { const id = a.db ? (b || 'entry-' + ++sequence) : c; return a.db ? { db: a.db, id, path: a.path + '/' + id } : { db: a, id, path: b + '/' + id }; }
export async function runTransaction(db, callback) {
 const writes = [];
 const tx = {
  async get(ref) { if(writes.length) throw Error('Reads must precede writes'); const data = db.docs.get(ref.path); return { exists: () => data !== undefined, data: () => structuredClone(data) }; },
  set(ref, data) { writes.push([ref.path, structuredClone(data), false]); },
  update(ref, data) { writes.push([ref.path, structuredClone(data), true]); }
 };
 const result = await callback(tx);
 for(const [path, data, merge] of writes) db.docs.set(path, merge ? {...db.docs.get(path), ...data} : data);
 return result;
}`;
const bundle = await build({ stdin: { contents: "export { createStockService } from './stockService.ts'", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{name:'mock-firestore', setup(builder) {
  builder.onResolve({filter:/^firebase\/firestore$/}, () => ({path:'db',namespace:'mock'}));
  builder.onLoad({filter:/.*/,namespace:'mock'}, () => ({contents:mock}));
}}] });
const module = { exports: {} }; new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const actor = {id:'admin',username:'Admin',role:'admin'};
const input = items => ({date:'2026-10-22T10:00:00Z',items,customerId:'c',total:100000,status:'Paid',userId:'admin'});
function fixture() {
 const db = { docs:new Map([['users/admin',actor],['stockItems/roll',{unitsOnHand:4,avgCostPerUnit:10000,inventoryVersion:1,isActive:true,module:'large-format'}],['inventory/shirt',{quantity:1,avgCost:5000,purchasePrice:5000,module:'products'}]]) };
 return {db,service:module.exports.createStockService(db,actor)};
}

test('Kuyiriba costs post once per ordered unit; payment updates preserve costs and void removes active COGS',async()=>{
 const {db,service}=fixture();const line={itemId:'custom-shirt',name:'Bought T-shirt',quantity:3,price:15000,module:'dtf',directCosts:{buyingPrice:7000,otherCost:1000,otherDescription:'Transport'},metadata:{type:'manual',tab:'kuyiriba'}};
 const before=structuredClone(db.docs.get('inventory/shirt'));
 const items=await service.saveSale('custom',input([line]));assert.equal(items[0].cogsAtSale,24000);assert.deepEqual(db.docs.get('inventory/shirt'),before);
 await service.saveSale('custom',{...input(items),amountPaid:45000});assert.equal(db.docs.get('sales/custom').items[0].cogsAtSale,24000);
 const edited=await service.saveSale('custom',input([{...line,quantity:2}]));assert.equal(edited[0].cogsAtSale,16000);
 await service.reverseSale('custom');assert.ok(db.docs.get('sales/custom').voidedAt);assert.deepEqual(db.docs.get('inventory/shirt'),before);
 assert.equal([...db.docs.values()].filter(d=>d.type==='Purchase'||d.type==='Start').length,0);
});

test('invalid Kuyiriba costs fail atomically without saving a sale',async()=>{
 const {db,service}=fixture();const line={itemId:'custom',name:'Custom shirt',quantity:1,price:15000,directCosts:{buyingPrice:-1,otherCost:0,otherDescription:''},metadata:{type:'manual',tab:'kuyiriba'}};
 await assert.rejects(service.saveSale('bad',input([line])),/Buying price/);assert.equal(db.docs.has('sales/bad'),false);
 await assert.rejects(service.saveSale('bad',input([{...line,directCosts:{buyingPrice:100,otherCost:5,otherDescription:''}}])),/Describe/);
 await assert.rejects(service.saveSale('bad',input([{...line,directCosts:{buyingPrice:100,otherCost:0,otherDescription:''},productId:'shirt'}])),/cannot also issue/);
});

test('complementary sale is linked, noncash, updated with parent quantities and voided with the parent',async()=>{
 const {db,service}=fixture();
 const base={itemId:'finished',name:'Finished shirt',quantity:2,price:20000,module:'dtf',metadata:{type:'manual',tab:'kuyiriba'},directCosts:{buyingPrice:7000,otherCost:1500,otherDescription:'Transport; Packing',otherRows:[{description:'Transport',amount:1000},{description:'Packing',amount:500}]}};
 const complement={itemId:'print',name:'DTF A4',quantity:2,price:0,complementaryFor:'finished',complementaryUnitPrice:5000,complementaryQuantityPerItem:1,metadata:{type:'dimension',tab:'dtf'}};
 let items=await service.saveSale('order',{...input([base,complement]),total:40000,amountPaid:40000});
 assert.equal(items.reduce((s,i)=>s+i.cogsAtSale,0),17000);
 let linked=db.docs.get('sales/order--complementary');assert.equal(linked.total,10000);assert.equal(linked.amountPaid,0);assert.deepEqual(linked.payments,[]);assert.equal(linked.internalComplementary,true);assert.equal(linked.parentSaleId,'order');
 assert.equal(db.docs.get('customers/eko-prints-complementary').name,'EKO PRINTS COMPLEMENTARY');
 const count=db.docs.size;await service.saveSale('order',{...db.docs.get('sales/order'),notes:'Payment updated'});assert.equal(db.docs.size,count);
 items=await service.saveSale('order',{...input([{...items[0],quantity:1},items[1]]),total:20000});
 assert.equal(items[1].quantity,1);assert.equal(db.docs.get('sales/order--complementary').total,5000);
 await assert.rejects(service.saveSale('order--complementary',input([])),/parent customer order/);
 await service.reverseSale('order');assert.ok(db.docs.get('sales/order--complementary').voidedAt);
});

test('quotation keeps draft costs unposted; conversion creates buying/other COGS and the internal invoice',async()=>{
const {db,service}=fixture();const drafted=kuyiribaLines('Finished T-shirt',7000,15000,'Transport',1000,2,{itemId:'dtf',name:'A4 DTF',quantity:1,price:5000,metadata:{type:'dimension',tab:'dtf'}});
const quote={...input(quotationItems(drafted.map(i=>({...i,cogsAtSale:99999})))),total:30000};db.docs.set('quotations/q',quote);
assert.ok(quote.items.every(i=>i.cogsAtSale===undefined));assert.equal([...db.docs.keys()].filter(k=>k.startsWith('sales/')).length,0);assert.equal(db.docs.has('customers/eko-prints-complementary'),false);assert.equal([...db.docs.values()].filter(d=>d.type==='Sale').length,0);
const posted=await service.saveSale('invoice-from-q',quote);assert.equal(posted.reduce((sum,i)=>sum+i.cogsAtSale,0),16000);assert.equal(db.docs.get('sales/invoice-from-q').total,30000);assert.equal(db.docs.get('sales/invoice-from-q--complementary').total,10000);
});

test('inventory used for complementary work is issued and restored only once',async()=>{
 const {db,service}=fixture();db.docs.get('inventory/shirt').quantity=5;
 const base={itemId:'finished',name:'Finished item',quantity:2,price:20000,metadata:{type:'manual',tab:'kuyiriba'},directCosts:{buyingPrice:7000,otherCost:0,otherDescription:''}};
 const component={itemId:'component',name:'Inventory component',productId:'shirt',quantity:2,price:0,complementaryFor:'finished',complementaryUnitPrice:10000,complementaryQuantityPerItem:1};
 const items=await service.saveSale('order',{...input([base,component]),total:40000});
 assert.equal(db.docs.get('inventory/shirt').quantity,3);assert.equal(items.reduce((sum,i)=>sum+i.cogsAtSale,0),24000);
 assert.equal([...db.docs.values()].filter(d=>d.type==='Sale').length,1);
 await service.reverseSale('order');assert.equal(db.docs.get('inventory/shirt').quantity,5);
});
test('unopened material resale issues units and records average-cost COGS without a Start', async () => {
 const {db,service} = fixture();
 const items = await service.saveSale('s',input([{itemId:'line',name:'Roll',materialSkuId:'roll',quantity:3,price:20000}]));
 assert.equal(db.docs.get('stockItems/roll').unitsOnHand,1); assert.equal(items[0].cogsAtSale,30000);
 assert.equal(items[0].module,'large-format');
 assert.equal([...db.docs.values()].filter(d=>d.type==='Start').length,0);
 assert.equal([...db.docs.values()].filter(d=>d.type==='Sale').length,1);
});
test('mixed sale with insufficient resale stock commits no stock, invoice or ledger writes', async () => {
 const {db,service} = fixture(); const before = structuredClone(db.docs);
 await assert.rejects(service.saveSale('s',input([{itemId:'r',name:'Roll',materialSkuId:'roll',quantity:1,price:20000},{itemId:'p',name:'Shirt',productId:'shirt',quantity:2,price:10000}])));
 assert.deepEqual(db.docs,before);
});
test('void restores original material carrying value after a restock and cannot reverse twice', async () => {
 const {db,service} = fixture();
 await service.saveSale('s',input([{itemId:'line',name:'Roll',materialSkuId:'roll',quantity:3,price:20000}]));
 await service.receiveStock('roll',{units:3,unitCost:20000,supplier:'Supplier',paymentStatus:'Paid'});
 await service.reverseSale('s');
 assert.equal(db.docs.get('stockItems/roll').unitsOnHand,7);
 assert.equal(db.docs.get('stockItems/roll').avgCostPerUnit,100000/7);
 assert.ok(db.docs.get('sales/s').voidedAt);
 await assert.rejects(service.reverseSale('s'));
});
test('metadata-only update cannot overwrite stock movement IDs or reprice COGS', async () => {
 const {db,service} = fixture();
 await service.saveSale('s',input([{itemId:'line',name:'Roll',materialSkuId:'roll',quantity:1,price:20000}]));
 const original = db.docs.get('sales/s'), before = db.docs.size;
 await service.saveSale('s',{...original,notes:'Payment note',inventoryMovementIds:['stale']});
 assert.deepEqual(db.docs.get('sales/s').inventoryMovementIds,original.inventoryMovementIds);
 assert.equal(db.docs.size,before); assert.equal(db.docs.get('stockItems/roll').unitsOnHand,3);
});
test('editing an unopened resale reverses the old issue before applying the new quantity', async () => {
 const {db,service} = fixture();
 await service.saveSale('s',input([{itemId:'line',name:'Roll',materialSkuId:'roll',quantity:2,price:20000}]));
 await service.receiveStock('roll',{units:2,unitCost:20000,supplier:'Supplier',paymentStatus:'Paid'});
 const original = structuredClone(db.docs.get('sales/s'));
 const items = await service.saveSale('s',{...original,items:[{...original.items[0],quantity:1}]});
 assert.equal(db.docs.get('stockItems/roll').unitsOnHand,5);
 assert.equal(items[0].cogsAtSale,80000/6);
 assert.equal([...db.docs.values()].filter(d=>d.type==='Reversal').length,1);
 assert.notDeepEqual(db.docs.get('sales/s').inventoryMovementIds,original.inventoryMovementIds);
});

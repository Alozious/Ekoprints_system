import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
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

import {test} from 'node:test';import assert from 'node:assert/strict';import {kuyiribaLines,directOrderCogs,invoiceItems} from './kuyiriba.ts';
test('DTF complement keeps final customer price fixed and carries its own internal sale value',()=>{
 const complement={itemId:'a4',name:'DTF A4',quantity:1,price:5000,metadata:{type:'dimension',tab:'dtf'}};
 const lines=kuyiribaLines('T-shirt',7000,15000,'Transport',1000,2,complement);
 assert.equal(lines.reduce((s,i)=>s+i.price*i.quantity,0),30000);
 assert.equal(lines.reduce((s,i)=>s+directOrderCogs(i),0),16000);
 assert.equal(lines[0].module,'dtf');assert.equal(lines[1].quantity,2);
 assert.equal(lines[1].complementaryUnitPrice,5000);assert.equal(lines[1].complementaryFor,lines[0].itemId);
});

test('multiple other-cost rows contribute to COGS and require descriptions',()=>{
const lines=kuyiribaLines('Shirt',7000,20000,'Transport; Packing',1500,2,undefined,[{description:'Transport',amount:1000},{description:'Packing',amount:500}]);
assert.equal(directOrderCogs(lines[0]),17000);assert.equal(lines[0].price*lines[0].quantity,40000);
assert.throws(()=>kuyiribaLines('Shirt',7000,20000,'',1000,1,undefined,[{description:'',amount:1000}]),/Describe/);
});
test('Kuyiriba rejects missing descriptions and fractional quantities',()=>{
 assert.throws(()=>kuyiribaLines('',1,2,'',0,1),/description/);
 assert.throws(()=>kuyiribaLines('Shirt',1,2,'',0,1.5),/whole/);
 assert.throws(()=>kuyiribaLines('Shirt',1,2,'',1,1),/Describe/);
});

 test('customer document allocations preserve totals for shown and hidden complementary work',()=>{
 for(const shown of [true,false])for(const selling of [15000,3000]){
 const source=kuyiribaLines('Shirt',1000,selling,'',0,2,{itemId:'dtf',name:'DTF A4',quantity:1,price:5000,showComplementaryOnInvoice:shown});
 const projected=invoiceItems({items:source});
 assert.equal(projected.reduce((s,i)=>s+i.price*i.quantity,0),selling*2);
 assert.equal(projected.some(i=>i.name==='Others'),!shown);
 assert.equal(projected.some(i=>i.name.includes('DTF A4')),shown);
 assert.equal(source[0].price,selling);assert.equal(source[1].price,0);
 assert.deepEqual(invoiceItems({items:source,internalComplementary:true}),source);
 }
 });

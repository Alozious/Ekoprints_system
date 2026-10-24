import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const bundle=await build({stdin:{contents:"export {default} from './components/Invoice.tsx'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.png':'dataurl'},plugins:[{name:'invoice-modal-stub',setup(builder){builder.onResolve({filter:/\/Modal$|^\.\/Modal$/},()=>({path:'modal',namespace:'stub'}));builder.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export default function Modal({children}){return children;}'}));}}]});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const Invoice=module.exports.default;
const primary={itemId:'shirt',name:'Finished customer T-shirt',price:15000,quantity:2};
const complementary={itemId:'print',name:'INTERNAL DTF A4 WORK',price:0,quantity:2,complementaryFor:'shirt',complementaryUnitPrice:5000};
const sale={id:'customer-order',date:'2026-10-25T10:00:00Z',total:30000,subtotal:30000,status:'Unpaid',items:[primary,complementary],customer:{id:'c',name:'Customer',phone:'',email:'',address:''}};
const props={isOpen:true,onClose(){},sale,settings:{businessName:'Eko Prints',businessPhone:'',businessEmail:'',businessLocation:'',receiptFooter:'',receiptHeader:'',statementFooter:'',statementHeader:''}};
test('customer invoice and quotation previews omit complementary work',()=>{
for(const isQuotation of [false,true]){const html=renderToStaticMarkup(React.createElement(Invoice,{...props,isQuotation}));assert.ok(html.includes(primary.name));assert.ok(!html.includes(complementary.name));assert.ok(html.includes('30,000'));}
});
test('the internal complementary invoice shows complementary work and the internal customer',()=>{
const html=renderToStaticMarkup(React.createElement(Invoice,{...props,sale:{...sale,internalComplementary:true,total:10000,subtotal:10000,items:[{...complementary,price:5000}],customer:{...sale.customer,name:'EKO PRINTS COMPLEMENTARY'}}}));
assert.ok(html.includes(complementary.name));assert.ok(html.includes('EKO PRINTS COMPLEMENTARY'));assert.ok(html.includes('Internal complementary work'));assert.ok(html.includes('10,000'));
});

 test('ticked complementary work is visible on the customer invoice',()=>{
 const html=renderToStaticMarkup(React.createElement(Invoice,{...props,sale:{...sale,items:[primary,{...complementary,showComplementaryOnInvoice:true}]}}));
 assert.ok(html.includes(complementary.name));assert.ok(html.includes('30,000'));
 });
 test('unticked complementary work appears as Others',()=>{
 const html=renderToStaticMarkup(React.createElement(Invoice,props));assert.ok(html.includes('Others'));assert.ok(!html.includes(complementary.name));
 });

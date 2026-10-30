import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dashboardInsights} from './dashboardInsights.ts';
const sales=[{id:'external',date:'2026-01-31T22:00:00Z',total:180,amountPaid:180,items:[{itemId:'shirt',name:'Shirt',module:'dtf',quantity:2,price:100,cogsAtSale:40},{itemId:'print',name:'Internal print',price:0,quantity:2,complementaryFor:'shirt',module:'dtf'}],payments:[{date:'2026-02-02T10:00:00Z',amount:100},{date:'2026-03-02T10:00:00Z',amount:80}]},{id:'internal',date:'2026-02-01',total:500,internalComplementary:true,items:[{name:'Internal print',price:500,quantity:1}],payments:[]}];
const expenses=[{date:'2026-02-03',category:'Rent',amount:30,module:'dtf'},{date:'2026-02-04',category:'Transport',amount:10,module:'dtf'}];
const movements=[{type:'Start',date:'2026-02-05',module:'dtf',totalValue:20},{type:'Adjustment',date:'2026-02-06',module:'dtf',units:-1,unitCost:5,totalValue:5}];
const filter={period:'custom',dateMode:'range',start:'2026-02-01',end:'2026-03-03',now:new Date('2026-03-03T12:00:00Z')};
test('trend matches totals and counts late payments on their collection dates in Uganda',()=>{
 const d=dashboardInsights(sales,expenses,movements,filter,'all',true);
 assert.equal(d.trend[0].invoiced,180);assert.equal(d.trend[0].cash,100);assert.equal(d.trend[1].cash,80);
 for(const [key,total] of [['cash','cashCollected'],['invoiced','revenue'],['cogs','cogs'],['expenses','operatingExpenses'],['net','netProfit']])assert.equal(d.trend.reduce((n,r)=>n+r[key],0),d.totals[total]);
 assert.equal(d.totals.netProfit,75);assert.equal(d.departments[0].net,75);
});
test('item ranks allocate discounts and exclude internal complementary entries',()=>{
 const d=dashboardInsights(sales,expenses,movements,filter,'dtf',true);
 assert.deepEqual(d.items,[{name:'Shirt',quantity:2,value:180}]);assert.equal(d.categories[0].name,'Rent');assert.equal(d.categories[0].value,30);
});
test('daily trend keeps empty dates and department filters affect every dataset',()=>{
 const d=dashboardInsights(sales,expenses,movements,filter,'dtf',false);
 assert.equal(d.trend.length,31);assert.equal(d.trend[0].key,'2026-02-01');assert.equal(d.trend[0].cash,0);
 const empty=dashboardInsights(sales,expenses,movements,filter,'embroidery',true);
 assert.equal(empty.totals.cashCollected,0);assert.deepEqual(empty.items,[]);assert.deepEqual(empty.categories,[]);assert.deepEqual(empty.departments,[]);
});

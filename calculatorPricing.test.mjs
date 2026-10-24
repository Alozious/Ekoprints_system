import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculatorTiers,dimensionPrice} from './calculatorPricing.ts';
test('DTF presets use saved sheet tiers while custom dimensions use area tiers',()=>{
 const tiers=[{id:'a4',categoryId:'dtf',preset:'A4',value:6500},{id:'a3',categoryId:'dtf',preset:'A3',value:12000},{id:'area',categoryId:'dtf',value:8},{id:'other',categoryId:'banner',value:3}];
 assert.deepEqual(calculatorTiers(tiers,'dtf',true,'A4').map(t=>t.id),['a4']);
 assert.deepEqual(calculatorTiers(tiers,'dtf',true,'A3').map(t=>t.id),['a3']);
 assert.deepEqual(calculatorTiers(tiers,'dtf',true,null).map(t=>t.id),['area']);
 assert.equal(dimensionPrice(623.7,6500,true),6500);
 assert.equal(dimensionPrice(100,8,false),800);
 assert.deepEqual(calculatorTiers(tiers,'missing',true,'A4'),[]);
 assert.equal(dimensionPrice(623.7,0,true),0);
 assert.deepEqual(calculatorTiers(tiers,'banner',false,null).map(t=>t.id),['other']);
});

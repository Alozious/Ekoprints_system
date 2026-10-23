import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materialResaleCatalog } from './materialResale.ts';
const item = { id: 'firestore-id', skuId: 'legacy-sku', categoryId: 'film', module: 'dtf', itemName: 'Film A4', variantLabel: 'A4', inventoryVersion: 1, unitsOnHand: 3, avgCostPerUnit: 40000, resalePrice: 55000 };
const categories = [{ id: 'film', name: 'Film', module: 'dtf', isActive: true }];
test('material resale uses the material document identity, quantity and selling price without creating inventory or exposing cost', () => {
 const [product] = materialResaleCatalog([item], categories);
 assert.equal(product.materialSkuId, 'firestore-id'); assert.equal(product.quantity, 3); assert.equal(product.price, 55000);
 assert.equal(product.module, 'dtf'); assert.equal(product.name, 'Film · A4'); assert.equal(product.purchasePrice, undefined);
 assert.equal(materialResaleCatalog([{ ...item, unitsOnHand: 2 }], categories)[0].quantity, 2);
});
test('inactive or uncounted stock is excluded, zero stock remains visible and absent selling prices are never replaced by purchase costs', () => {
 assert.equal(materialResaleCatalog([{ ...item, isActive: false }], categories).length, 0);
 assert.equal(materialResaleCatalog([item], [{ ...categories[0], isActive: false }]).length, 0);
 assert.equal(materialResaleCatalog([{ ...item, inventoryVersion: undefined }], categories).length, 0);
 assert.equal(materialResaleCatalog([{ ...item, unitsOnHand: 0, resalePrice: undefined }], categories)[0].price, 0);
});

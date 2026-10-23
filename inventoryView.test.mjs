import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render the actual view with no Auth/Firestore initialization or network calls.
// App's toast provider and the db instance are replaced only in this test bundle.
const bundle = await build({
  stdin: { contents: "export { default } from './components/InventoryView.tsx'", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'inventory-test-isolation', setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)App$/ }, () => ({ path: 'toast', namespace: 'test-stub' }));
    builder.onResolve({ filter: /(?:^|\/)firebase$/ }, () => ({ path: 'db', namespace: 'test-stub' }));
    builder.onLoad({ filter: /.*/, namespace: 'test-stub' }, args => ({ contents: args.path === 'toast' ? 'export const useToast = () => ({ addToast() {} });' : 'export const db = {};' }));
  } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const View = module.exports.default;
const variant = { id: 'physical-id', skuId: 'calculator-sku', categoryId: 'flex', module: 'large-format', width: 1.27,
  itemName: 'Flex Banner 1.27 m', variantLabel: '1.27 m', unit: 'roll', inventoryVersion: 1, isActive: true,
  unitsOnHand: 2, avgCostPerUnit: 450000, reorderLevel: 2, reorderLevelNeedsReview: false, totalStockMeters: 999, lastPurchasePricePerRoll_UGX: 100 };
const props = {
  materialCategories: [{ id: 'flex', module: 'large-format', name: 'Flex Banner', unitType: 'roll', isActive: true }],
  stockItems: [variant, { ...variant, id: 'inactive', skuId: 'inactive', itemName: 'Inactive variant', isActive: false },
    { ...variant, id: 'legacy', skuId: 'legacy', itemName: 'Legacy variant', inventoryVersion: undefined, unitsOnHand: undefined, avgCostPerUnit: undefined }],
  stockTransactions: [{ transactionId: 'start', skuId: 'physical-id', type: 'Start', date: '2026-10-21T09:00:00Z' }],
  inventory: [], productCategories: [], pricingTiers: [], onRefresh: async () => {},
};
test('admin overview shows compact collapsed material summaries with unit totals and low-stock flags', () => {
  const html = renderToStaticMarkup(React.createElement(View, { ...props, currentUser: { id: 'admin', username: 'Admin', role: 'admin' } }));
  assert.match(html, /900,000 UGX/); assert.match(html, /Unopened units: 2/);
  assert.match(html, /bg-amber-50/); assert.match(html, /physical count required/);
  assert.match(html, /aria-expanded="false"/); assert.match(html, /Expand all/); assert.match(html, /Collapse all/);
  assert.doesNotMatch(html, /Avg cost \/ unit|Last started:/);
  assert.doesNotMatch(html, /Inactive variant/); assert.doesNotMatch(html, /999/);
});
test('staff stock view hides stored cost, valuation, setup and reports', () => {
  const html = renderToStaticMarkup(React.createElement(View, { ...props, currentUser: { id: 'staff', username: 'Staff', role: 'user' } }));
  assert.doesNotMatch(html, /450,000|900,000|Avg cost|Total value|COGS|Edit setup|Add material|>Reports<|>Setup</);
  assert.match(html, /Unopened units/); assert.match(html, /aria-expanded="false"/); assert.match(html, /Expand all/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { variantDefinitions } from './inventorySetup.ts';

test('bulk roll widths retain Calculator width in meters and readable labels', () => {
  assert.deepEqual(variantDefinitions('1.07, 1.1 m\n1.3, 1.6, 1.8', 'roll'), [
    { variantLabel: '1.07 m', width: 1.07 }, { variantLabel: '1.1 m', width: 1.1 },
    { variantLabel: '1.3 m', width: 1.3 }, { variantLabel: '1.6 m', width: 1.6 }, { variantLabel: '1.8 m', width: 1.8 },
  ]);
});
test('paper sizes and colours use unit labels without inventing widths', () => {
  assert.deepEqual(variantDefinitions('A3, A4', 'ream'), [{ variantLabel: 'A3', width: 0 }, { variantLabel: 'A4', width: 0 }]);
  assert.equal(variantDefinitions('Cyan, Magenta, Yellow, Black, White', 'bottle').length, 5);
  assert.equal(variantDefinitions('Standard', 'roll')[0].width, 0);
});
test('bulk setup rejects empty, duplicate, zero-width and oversized batches', () => {
  for (const [text, unit] of [[' , ', 'roll'], ['1.1, 1.10 m', 'roll'], ['Cyan, cyan', 'bottle'], ['0', 'roll']]) assert.throws(() => variantDefinitions(text, unit));
  assert.throws(() => variantDefinitions(Array.from({ length: 41 }, (_, i) => String(i + 1)).join(','), 'roll'));
});

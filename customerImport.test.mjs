import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { cleanPhone, readCustomerWorkbook, suggestMapping, mapRows, planImport } from './customerImport.ts';
const customer = (data = {}) => ({ name: 'Jane', email: '', phone: '', address: '', category: '', district: '', ...data });
const row = (number, data, issue = '') => ({ row: number, customer: customer(data), issue });
const existing = (data = {}) => ({ ...customer(data), id: 'existing', createdAt: '2020-01-01' });
function workbook(rows) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Customers');
    return XLSX.write(book, { type: 'array', bookType: 'xlsx' });
}
test('phone cleanup normalizes local, numeric Excel, international and spaced numbers', () => {
    for (const phone of ['0700 123 456', '700123456', '+256 700-123-456', '256700123456', '00256700123456']) assert.equal(cleanPhone(phone), '+256700123456');
    for (const phone of ['+254700123456', '0700123', '0700123456 / 0770123456', 'hello', '+256000000000']) assert.equal(cleanPhone(phone), null);
    assert.equal(cleanPhone(''), '');
});
test('arbitrary Excel columns can map to category, district and contact', () => {
    const sheet = readCustomerWorkbook(workbook([['Client', 'Area', 'Group', 'Telephone'], ['Jane', 'Masaka', 'Retail', '0700 123456']]));
    const mapping = { ...suggestMapping(sheet), name: 0, district: 1, category: 2, phone: 3 };
    const [result] = mapRows(sheet, mapping);
    assert.equal(result.customer.district, 'Masaka'); assert.equal(result.customer.category, 'Retail');
    assert.equal(result.customer.phone, '+256700123456'); assert.equal(result.issue, '');
});
test('name matches despite different contacts and requires an explicit decision', () => {
    const plan = planImport([row(2, { name: ' JANE ', phone: '+256700123456' })], [existing({ phone: '+256777123456' })], {});
    assert.equal(plan.pending.row, 2); assert.equal(plan.writes.size, 0);
});
test('matching contact allows independent name and phone choices, preserving other fields', () => {
    const data = [row(2, { name: 'Jane New', phone: '+256700123456', district: 'Masaka' })];
    const saved = [existing({ name: 'Jane Old', phone: '0700 123456', category: 'Wholesale', district: 'Kampala' })];
    const plan = planImport(data, saved, { 2: { action: 'merge', target: 'existing', incoming: ['name', 'district'] } });
    assert.equal(plan.pending, null); assert.equal(plan.writes.size, 1);
    assert.deepEqual(plan.writes.get('existing'), customer({ name: 'Jane New', phone: '+256700123456', category: 'Wholesale', district: 'Masaka' }));
});
test('within-file duplicates merge into a single new record', () => {
    const rows = [row(2, { phone: '+256700123456' }), row(3, { name: 'Jane New', phone: '+256700123456' })];
    assert.equal(planImport(rows, [], {}).pending.row, 3);
    const plan = planImport(rows, [], { 3: { action: 'merge', target: 'import-row:2', incoming: ['name'] } });
    assert.equal(plan.writes.size, 1); assert.equal(plan.writes.get('import-row:2').name, 'Jane New');
});
test('ambiguous matches show all candidates and only update selected ID', () => {
    const saved = [existing({ name: 'Jane', phone: '+256700123456' }), { ...existing({ name: 'Other', phone: '+256777123456' }), id: 'second' }];
    const rows = [row(2, { name: 'Jane', phone: '+256777123456' })];
    assert.equal(planImport(rows, saved, {}).pending.candidates.length, 2);
    const plan = planImport(rows, saved, { 2: { action: 'merge', target: 'second', incoming: [] } });
    assert.deepEqual([...plan.writes.keys()], ['second']);
});
test('skip leaves saved data unchanged and separate customer is explicit', () => {
    assert.equal(planImport([row(2, {})], [existing()], { 2: { action: 'skip' } }).writes.size, 0);
    assert.equal(planImport([row(2, {})], [existing()], { 2: { action: 'new' } }).writes.size, 1);
});
test('invalid incoming phone can be resolved by retaining valid existing phone', () => {
    const rows = [row(2, { phone: 'invalid' }, 'Invalid phone')];
    const plan = planImport(rows, [existing({ phone: '+256700123456' })], { 2: { action: 'merge', target: 'existing', incoming: [] } });
    assert.equal(plan.pending, null); assert.equal(plan.writes.get('existing').phone, '+256700123456');
    assert.ok(planImport(rows, [], { 2: { action: 'new' } }).pending);
});
test('400 row bound never silently truncates', () => {
    const rows = Array.from({ length: 400 }, (_, i) => [`Name ${i}`]);
    assert.equal(readCustomerWorkbook(workbook([['Name'], ...rows])).rows.length, 400);
    assert.throws(() => readCustomerWorkbook(workbook([['Name'], ...rows, ['Extra']])), /400/);
});
test('CSV preserves blank-row location and flags invalid data', () => {
    const sheet = readCustomerWorkbook(new TextEncoder().encode('Name,Phone\nJane,0700123456\n\nOther,bad').buffer);
    const rows = mapRows(sheet, suggestMapping(sheet));
    assert.equal(rows[0].customer.phone, '+256700123456'); assert.equal(rows[1].row, 4); assert.ok(rows[1].issue);
});

test('multiple contacts clean individually and remove repeated numbers', async () => {
    const { cleanPhones, matches } = await import('./customerImport.ts');
    assert.equal(cleanPhones('0700 123456 / 0777 123456 / +256700123456'), '+256700123456/+256777123456');
    assert.equal(cleanPhones('0700123456;0777123456'), '+256700123456/+256777123456');
    assert.equal(cleanPhones('0700123456/bad'), null);
    assert.equal(matches(customer({name:'A', phone:'0700123456/0777123456'}), customer({name:'B', phone:'+256777123456'})), true);
    assert.equal(matches(customer({name:'A', phone:'0700123456/0777123456'}), customer({name:'B', phone:'+256788123456'})), false);
});
test('merge can preserve both contact lists without duplicate numbers', () => {
    const plan = planImport([row(2, {phone:'+256777123456/+256700123456'})], [existing({phone:'0700123456'})], {2:{action:'merge', target:'existing', combinePhones:true}});
    assert.equal(plan.pending, null);
    assert.equal(plan.writes.get('existing').phone, '+256700123456/+256777123456');
});
test('name query distinguishes repeated, similar, reordered and unique names', async () => {
    const { nameSimilarity, queryCustomerNames } = await import('./customerNames.ts');
    assert.ok(nameSimilarity(' EKO-PRINTS ', 'eko prints'));
    assert.ok(nameSimilarity('Jane Mary', 'Mary Jane'));
    assert.ok(nameSimilarity('Kampala Prints', 'Kampala Print'));
    assert.equal(nameSimilarity('Ali', 'Ala'), null);
    assert.equal(nameSimilarity('', ''), null);
    const result = queryCustomerNames([existing({name:'EKO PRINTS'}), {...existing({name:'Eko-Prints'}),id:'second'}, {...existing({name:'Different Shop'}),id:'unique'}]);
    assert.equal(result.get('existing').length, 1);
    assert.equal(result.get('second').length, 1);
    assert.equal(result.get('unique').length, 0);
});

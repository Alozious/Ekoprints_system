import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignAudience } from './marketing.ts';
const customer = (id, phone) => ({ id, name: id, phone, email: '', address: '', createdAt: '' });
test('campaign audience handles multiple contacts and globally deduplicates', () => {
    const result = campaignAudience([customer('one', '0700123456/0777123456'), customer('two', '+256700123456'), customer('three', 'bad'), customer('four', '')]);
    assert.equal(result.recipients.length, 2); assert.equal(result.duplicates, 1); assert.equal(result.invalid, 1); assert.equal(result.missing, 1);
});
test('first-contact mode excludes additional numbers', () => {
    assert.equal(campaignAudience([customer('one', '0700123456/0777123456')], true).recipients.length, 1);
});

import { filterCampaignCustomers, combineRecipients } from './marketing.ts';
test('date filters use Uganda calendar dates inclusively and filters do not mutate selection', () => {
    const customers = [
        {...customer('a','0700123456'), name:'Alpha', category:'Printing', district:'Masaka City', createdAt:'2026-09-30T22:30:00Z'},
        {...customer('b','0777123456'), name:'Beta', category:'Printing', district:'Kampala', createdAt:'2026-09-29T10:00:00Z'}
    ];
    const selected = ['a', 'b'];
    const filters = {category:'printing', district:'masaka', search:'', from:'2026-10-01', to:'2026-10-01', sort:'name-desc'};
    assert.deepEqual(filterCampaignCustomers(customers, filters).map(c=>c.id), ['a']);
    assert.deepEqual(filterCampaignCustomers(customers, {...filters, search:'no match'}), []);
    assert.equal(campaignAudience(customers.filter(c=>selected.includes(c.id))).recipients.length, 2);
    assert.deepEqual(selected,['a','b']);
    assert.equal(customers[0].id,'a');
});
test('manual contacts combine with selected customers and deduplicate phone numbers', () => {
    const system = [{name:'Existing',phone:'+256700123456'}];
    const manual = [{name:'Manual duplicate',phone:'+256700123456'},{name:'Extra',phone:'+256777123456'}];
    const result = combineRecipients(system,manual);
    assert.equal(result.length,2); assert.equal(result.find(r=>r.phone===system[0].phone).name,'Existing');
});

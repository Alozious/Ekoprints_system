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

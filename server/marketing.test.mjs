import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMarketingApi, verifyAdmin } from './marketing.mjs';
import { buildSmsPayload, egoRequest, validateCampaign } from './ego.mjs';
const draft = { title: 'Test only', channel: 'sms', message: 'Test message', recipients: [{ name: 'Example', phone: '+256700123456' }] };
async function harness(t, provider, authenticate = async () => 'admin-test') {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'eko-marketing-test-'));
    const api = createMarketingApi({ directory, provider, authenticate });
    const server = createServer((req, res) => api(req, res, () => { res.writeHead(404).end(); }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { await new Promise(resolve => server.close(resolve)); assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep + 'eko-marketing-test-')); await rm(directory, { recursive: true, force: true }); });
    const base = `http://127.0.0.1:${server.address().port}`;
    return { directory, request: async (suffix = '', body, extraHeaders = {}) => {
        const response = await fetch(base + '/api/marketing' + suffix, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, data: await response.json() };
    } };
}
test('payload follows EGO contract and removes leading plus', () => {
    const payload = buildSmsPayload({ username: 'test-user', password: 'test-password', senderid: 'Test' }, draft);
    assert.equal(payload.method, 'SendSms'); assert.equal(payload.msgdata[0].number, '256700123456');
    assert.equal(payload.msgdata[0].senderid, 'Test'); assert.equal(payload.msgdata[0].priority, 1);
});
test('provider body failures are failures even with HTTP 200', async () => {
    const result = await egoRequest({}, async () => ({ ok: true, json: async () => ({ Status: 'Failed', Message: 'Wrong credentials' }) }));
    assert.equal(result.status, 'failed');
    const accepted = await egoRequest({}, async () => ({ ok: true, json: async () => ({ Status: 'OK', Cost: 0.09, MsgFollowUpUniqueCode: 'tracking' }) }));
    assert.equal(accepted.cost, 0.09); assert.equal(accepted.trackingCode, 'tracking');
    await assert.rejects(() => egoRequest({}, async () => ({ ok: true, json: async () => ({ unexpected: true }) })));
});
test('campaign validates numbers, deduplicates recipients and enforces limits', () => {
    assert.equal(validateCampaign({ ...draft, recipients: [...draft.recipients, ...draft.recipients] }).recipients.length, 1);
    assert.throws(() => validateCampaign({ ...draft, recipients: [{ phone: '0700123456' }] }));
    assert.throws(() => validateCampaign({ ...draft, recipients: Array(1001).fill(draft.recipients[0]) }));
    assert.throws(() => validateCampaign({ ...draft, message: '' }));
});
test('server keeps credentials private and serializes duplicate send attempts', async t => {
    let sends = 0;
    const app = await harness(t, async payload => { assert.equal(payload.method, 'SendSms'); sends++; return { status: 'accepted', cost: 35, trackingCode: 'test-tracking' }; });
    const setup = await app.request('/config', { username: 'test-user', password: 'secret-test-only', senderid: 'Test' });
    assert.equal(setup.status, 200); assert.equal(setup.data.password, undefined);
    const saved = await app.request('/campaigns', draft); assert.equal(saved.data.status, 'draft');
    const replies = await Promise.all([app.request(`/campaigns/${saved.data.id}/send`, { confirmRecipients: 1 }), app.request(`/campaigns/${saved.data.id}/send`, { confirmRecipients: 1 })]);
    assert.equal(sends, 1); assert.equal(replies.filter(r => r.status === 200).length, 1);
    const list = await app.request(); assert.equal(list.data.campaigns[0].status, 'accepted');
    assert.equal(JSON.stringify(list.data).includes('secret-test-only'), false);
    const stored = JSON.parse(await readFile(path.join(app.directory, 'store.json'), 'utf8')); assert.equal(stored.campaigns[0].trackingCode, 'test-tracking');
});
test('uncertain send cannot be automatically repeated', async t => {
    let sends = 0;
    const app = await harness(t, async () => { sends++; throw new Error('Timeout'); });
    await app.request('/config', { username: 'test-user', password: 'test-password', senderid: 'Test' });
    const saved = await app.request('/campaigns', draft);
    const first = await app.request(`/campaigns/${saved.data.id}/send`, { confirmRecipients: 1 });
    assert.equal(first.data.status, 'unknown');
    assert.equal((await app.request(`/campaigns/${saved.data.id}/send`, { confirmRecipients: 1 })).status, 400);
    assert.equal(sends, 1);
});
test('balance is separate from sending and cross-origin requests are rejected', async t => {
    const app = await harness(t, async payload => { assert.equal(payload.method, 'Balance'); assert.equal(payload.walletType, undefined); return { status: 'accepted', balance: 123.5 }; });
    await app.request('/config', { username: 'test-user', password: 'test-password', senderid: 'Test' });
    assert.equal((await app.request('/balance', {})).data.balance, 123.5);
    assert.equal((await app.request('/campaigns', draft, { Origin: 'https://untrusted.example' })).status, 403);
});
test('authentication rejects unauthenticated and non-admin accounts', async t => {
    const app = await harness(t, async () => {}, verifyAdmin);
    assert.equal((await app.request()).status, 401);
    let requests = 0;
    await assert.rejects(() => verifyAdmin({ headers: { authorization: 'Bearer test-token' } }, async () => ({ ok: true, json: async () => ++requests === 1 ? { users: [{ localId: 'example' }] } : { fields: { role: { stringValue: 'user' } } } })), /administrators/);
});

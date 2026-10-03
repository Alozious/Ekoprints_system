import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMarketingOrigin } from './marketingOrigin.mjs';
const req = origin => ({ headers: { host: 'site.vercel.app', origin } });
test('Vercel deployment metadata permits deployed site and rejects unrelated origins', () => {
    const env = { VERCEL: '1', VERCEL_URL: 'preview.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'site.vercel.app' };
    assert.doesNotThrow(() => checkMarketingOrigin(req('https://site.vercel.app'), env));
    assert.doesNotThrow(() => checkMarketingOrigin(req('https://preview.vercel.app'), env));
    assert.throws(() => checkMarketingOrigin(req('https://attacker.example'), env));
    assert.throws(() => checkMarketingOrigin(req('https://site.vercel.app'), {}));
});
test('explicit origin normalizes trailing slash and overrides defaults', () => {
    const env = { MARKETING_ORIGIN: 'https://custom.example/', VERCEL: '1', VERCEL_URL: 'preview.vercel.app' };
    assert.doesNotThrow(() => checkMarketingOrigin(req('https://custom.example'), env));
    assert.throws(() => checkMarketingOrigin(req('https://preview.vercel.app'), env));
    assert.throws(() => checkMarketingOrigin({headers:{origin:'https://custom.example','sec-fetch-site':'cross-site'}},env));
});

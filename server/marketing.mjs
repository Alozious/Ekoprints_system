import { createCloudCampaignStore } from './cloudCampaignStore.mjs';
import { checkMarketingOrigin } from './marketingOrigin.mjs';
import './trust.mjs';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateCampaign, buildSmsPayload, egoRequest } from './ego.mjs';
import { createFirebaseSettings } from './firebaseSettings.mjs';
const projectId = 'ekoprints-63f33';
const apiKey = 'AIzaSyCNieyBeHBTLgXqiKt4BUnYZMehbDKJYYo';
export async function verifyAdmin(req, fetcher = fetch) {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw Object.assign(new Error('Sign in to use Marketing.'), { status: 401 });
    const response = await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(10000) });
    const account = await response.json();
    const uid = account.users?.[0]?.localId;
    if (!response.ok || !uid || account.users[0].disabled) throw Object.assign(new Error('Your sign-in has expired. Sign in again.'), { status: 401 });
    const roleResponse = await fetcher(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    const role = await roleResponse.json();
    if (!roleResponse.ok || role.fields?.role?.stringValue !== 'admin') throw Object.assign(new Error('Marketing is available to administrators only.'), { status: 403 });
    return uid;
}
export function createMarketingApi({ directory = path.resolve('.marketing.local'), authenticate = verifyAdmin, provider = egoRequest, settingsStore = createFirebaseSettings({ directory }) } = {}) {
    const cloud = process.env.VERCEL ? createCloudCampaignStore() : null;
    let queue = Promise.resolve();
    const file = path.join(directory, 'store.json');
    async function load(req) {
        if (cloud) return cloud.load(req);
        try { return JSON.parse(await readFile(file, 'utf8')); }
        catch (error) { if (error.code === 'ENOENT') return { config: {}, campaigns: [] }; throw error; }
    }
    async function persist(data, req) {
        if (cloud) return cloud.save(req, data);
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const temporary = path.join(directory, `${randomUUID()}.tmp`);
        await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
        await rename(temporary, file);
    }
    function publicConfig(config) { return { configured: !!(config.username && config.password && config.senderid), username: config.username || '', senderid: config.senderid || '' }; }
    async function route(req, body, uid, url) {
        const state = await load(req);
        if (req.method === 'GET' && url === '/api/marketing') return { config: publicConfig(await settingsStore.load(req)), campaigns: state.campaigns };
        if (req.method !== 'POST') throw Object.assign(new Error('Not found.'), { status: 404 });
        if (url === '/api/marketing/config') {
            const username = String(body.username || '').trim(), senderid = String(body.senderid || 'EgoSMS').trim();
            const previous = body.password ? {} : await settingsStore.load(req);
            const password = typeof body.password === 'string' && body.password ? body.password : (username === previous.username ? previous.password : '');
            if (!username || !password || !senderid || username.length > 200 || password.length > 1000 || senderid.length > 50) throw new Error('Enter your EGO SMS API username, password and configured sender ID.');
            const config = { username, password, senderid };
            await settingsStore.save(req, config, uid);
            delete state.config;
            await persist(state, req); return publicConfig(config);
        }
        if (url === '/api/marketing/balance') {
            const config = await settingsStore.load(req);
            if (!publicConfig(config).configured) throw new Error('Set up EGO SMS first.');
            const result = await provider({ method: 'Balance', userdata: { username: config.username, password: config.password } });
            if (result.status === 'failed') throw new Error('Balance check failed. Verify your EGO SMS credentials and account.');
            return { balance: result.balance };
        }
        if (url === '/api/marketing/campaigns') {
            const data = validateCampaign(body);
            const campaign = { ...data, id: randomUUID(), status: 'draft', createdAt: new Date().toISOString(), createdBy: uid };
            state.campaigns.unshift(campaign); await persist(state, req); return campaign;
        }
        const match = url.match(/^\/api\/marketing\/campaigns\/([a-zA-Z0-9-]+)\/send$/);
        if (!match) throw Object.assign(new Error('Not found.'), { status: 404 });
        const campaign = state.campaigns.find(c => c.id === match[1]);
        if (!campaign || campaign.channel !== 'sms') throw new Error('SMS campaign not found.');
        if (campaign.status !== 'draft') throw new Error('This campaign has already been submitted. Refresh and check its result; it will not be sent again.');
        if (body.confirmRecipients !== campaign.recipients.length) throw new Error('Review the campaign recipients before sending.');
        const config = await settingsStore.load(req);
        if (!publicConfig(config).configured) throw new Error('Set up EGO SMS first.');
        campaign.status = 'submitting'; campaign.submittedAt = new Date().toISOString(); campaign.submittedBy = uid;
        campaign.senderid = config.senderid;
        await persist(state, req); // Persist before sending: ambiguous sends are never automatically retried.
        try {
            const result = await provider(buildSmsPayload(config, campaign));
            campaign.status = result.status;
            campaign.cost = result.cost ?? null;
            campaign.trackingCode = result.trackingCode || '';
            campaign.error = result.status === 'failed' ? 'EGO SMS rejected the campaign. Check your credentials, sender ID and account balance in EGO SMS.' : '';
        } catch {
            campaign.status = 'unknown'; campaign.error = 'Submission outcome is unknown. Check the EGO SMS dashboard before creating another send.';
        }
        await persist(state, req); return campaign;
    }
    return async function marketingApi(req, res, next) {
        const url = (req.url || '').split('?')[0];
        if (!url.startsWith('/api/marketing')) return next();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json');
        try {
            checkMarketingOrigin(req);
            const uid = await authenticate(req);
            let body = {};
            if (req.method === 'POST') {
                if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Expected JSON.');
                if (req.body !== undefined) {
                    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
                    if (Buffer.byteLength(raw) > 600000) throw new Error('Request too large.');
                    body = JSON.parse(raw);
                } else {
                let size = 0; const chunks = [];
                for await (const chunk of req) { size += chunk.length; if (size > 600000) throw new Error('Request too large.'); chunks.push(chunk); }
                body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                }
            }
            const operation = queue.then(() => route(req, body, uid, url));
            queue = operation.catch(() => {});
            const result = await operation;
            res.end(JSON.stringify(result));
        } catch (error) {
            res.statusCode = error.status || 400;
            const message = error.message === 'fetch failed' ? 'The server could not connect to Firebase or EGO SMS. Check its network and trusted certificates, then retry.' : error.code || error.name === 'SyntaxError' ? 'The request could not be processed. Check the server and retry.' : error.message;
            res.end(JSON.stringify({ error: message || 'Marketing request failed.' }));
        }
    };
}

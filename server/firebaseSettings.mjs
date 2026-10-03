import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
const documentUrl = 'https://firestore.googleapis.com/v1/projects/ekoprints-63f33/databases/(default)/documents/marketingSettings/egoSms';
const aad = Buffer.from('ekoprints-63f33/marketingSettings/egoSms/v1');
export function sealSettings(config, key) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()]);
    return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: encrypted.toString('base64') };
}
export function openSettings(sealed, key) {
    if (sealed.version !== 1) throw new Error('Unsupported settings version.');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
    decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
}
export function createFirebaseSettings({ directory, fetcher = fetch }) {
    async function key(create = false) {
        if (process.env.MARKETING_ENCRYPTION_KEY) {
            const value = Buffer.from(process.env.MARKETING_ENCRYPTION_KEY, 'base64');
            if (value.length !== 32) throw new Error('MARKETING_ENCRYPTION_KEY must contain a base64 encoded 32-byte key.');
            return value;
        }
        if (process.env.VERCEL) throw new Error('Set MARKETING_ENCRYPTION_KEY in Vercel before saving SMS settings.');
        const file = path.join(directory, 'encryption.key');
        if (create) {
            await mkdir(directory, { recursive: true, mode: 0o700 });
            try { await writeFile(file, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
            catch (error) { if (error.code !== 'EEXIST') throw error; }
        }
        try { const value = await readFile(file); if (value.length !== 32) throw new Error(); return value; }
        catch { throw new Error('This server cannot unlock the Firebase SMS settings. Restore its encryption key, or enter and save both API credentials again.'); }
    }
    function headers(req) { return { Authorization: req.headers.authorization, 'Content-Type': 'application/json' }; }
    async function check(response) {
        if (!response.ok) throw new Error(response.status === 403 ? 'Firebase denied access to SMS settings. The marketingSettings/egoSms document must allow your signed-in administrator to read and write.' : 'Unable to save or load SMS settings in Firebase. Please retry.');
    }
    return {
        async load(req) {
            const response = await fetcher(documentUrl, { headers: headers(req), signal: AbortSignal.timeout(10000) });
            if (response.status === 404) return {};
            await check(response);
            const doc = await response.json();
            try { return openSettings(JSON.parse(doc.fields.encryptedConfig.stringValue), await key()); }
            catch { throw new Error('Unable to unlock the Firebase SMS settings. Restore this server’s encryption key or enter and save both API credentials again.'); }
        },
        async save(req, config, uid) {
            const encryptedConfig = JSON.stringify(sealSettings(config, await key(true)));
            const response = await fetcher(documentUrl, { method: 'PATCH', headers: headers(req), body: JSON.stringify({ fields: { encryptedConfig: { stringValue: encryptedConfig }, updatedBy: { stringValue: uid }, updatedAt: { timestampValue: new Date().toISOString() } } }), signal: AbortSignal.timeout(10000) });
            await check(response);
        }
    };
}

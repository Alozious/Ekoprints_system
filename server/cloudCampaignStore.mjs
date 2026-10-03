// Firestore compare-and-swap prevents concurrent serverless instances from
// claiming the same draft. A failed claim never reaches the SMS provider.
export function createCloudCampaignStore(fetcher = fetch) {
    const url = 'https://firestore.googleapis.com/v1/projects/ekoprints-63f33/databases/(default)/documents/marketingSettings/campaigns';
    const versions = new WeakMap();
    const headers = req => ({ Authorization: req.headers.authorization, 'Content-Type': 'application/json' });
    return {
        async load(req) {
            const response = await fetcher(url, { headers: headers(req), signal: AbortSignal.timeout(10000) });
            if (response.status === 404) { const state = { campaigns: [] }; versions.set(state, null); return state; }
            if (!response.ok) throw new Error('Firebase denied campaign access. Allow administrators to access marketingSettings/campaigns.');
            const document = await response.json();
            const state = JSON.parse(document.fields.state.stringValue);
            versions.set(state, document.updateTime);
            return state;
        },
        async save(req, state) {
            const value = JSON.stringify(state);
            if (Buffer.byteLength(value) > 900000) throw new Error('Campaign storage is full. Contact your administrator before creating more campaigns.');
            const version = versions.get(state);
            const condition = version ? `currentDocument.updateTime=${encodeURIComponent(version)}` : 'currentDocument.exists=false';
            const response = await fetcher(`${url}?${condition}`, { method: 'PATCH', headers: headers(req), body: JSON.stringify({ fields: { state: { stringValue: value } } }), signal: AbortSignal.timeout(10000) });
            if (!response.ok) throw new Error('Campaign could not be saved or was changed by another session. Refresh campaign results before retrying.');
            versions.set(state, (await response.json()).updateTime);
        }
    };
}

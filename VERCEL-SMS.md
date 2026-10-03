# SMS on Vercel

Deploy the whole repository (including `api` and `server`), not only `dist`.
One Vercel function (`api/sms.mjs`) calls EGO SMS. Explicit rewrites route `/api/marketing` and all its subroutes, including campaign sends, to that function. No separate server deployment is needed.

Before redeploying, set server-only environment variables:

- `MARKETING_ORIGIN`: the exact website origin, e.g. `https://your-site.vercel.app` (no trailing slash).
- `MARKETING_ENCRYPTION_KEY`: base64-encoded 32-byte key. To retain the existing encrypted Firebase credentials, base64-encode the contents of your local `.marketing.local/encryption.key` and set that same key here. Do not commit it or prefix it with `VITE_`. If using a new key, enter and save both EGO SMS credentials again; the local server also needs that same key to read them.

Firebase rules must allow signed-in administrators to read/write both `marketingSettings/egoSms` and `marketingSettings/campaigns`. Merge these rules with your existing rules; do not replace unrelated rules:

```
match /marketingSettings/{document} {
  allow read, write: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

Campaigns on Vercel use a Firestore ledger with conditional writes to prevent duplicate concurrent sends. Local campaign history is not automatically copied. The ledger rejects writes above 900 KB; larger installations need per-campaign storage. Provider timeouts remain uncertain; check EGO SMS before retrying.

Personalization tokens such as `{{name:20}}` are expanded separately for each saved recipient. The limit includes three dots: a value exceeding 20 characters becomes its first 17 characters plus ... (20 total). Values at or below the limit stay unchanged. Empty fields render blank; use the previews before sending.

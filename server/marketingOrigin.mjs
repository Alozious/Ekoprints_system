export function checkMarketingOrigin(req, env = process.env) {
    const origins = new Set();
    if (env.MARKETING_ORIGIN) {
        try { origins.add(new URL(env.MARKETING_ORIGIN.trim()).origin); }
        catch { throw new Error('MARKETING_ORIGIN must be your full website URL, including https://.'); }
    } else if (env.VERCEL) {
        // Trust deployment metadata, never an arbitrary request Host header.
        for (const key of ['VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_BRANCH_URL']) {
            if (env[key]) origins.add(new URL(`https://${env[key]}`).origin);
        }
    } else if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) {
        origins.add(`http://${req.headers.host}`);
    }
    const reject = message => { throw Object.assign(new Error(message), { status: 403 }); };
    if (!origins.size) reject('Set MARKETING_ORIGIN to your website URL in hosting environment variables, then redeploy.');
    if (req.headers['sec-fetch-site'] === 'cross-site') reject('Origin is not allowed.');
    if (req.headers.origin && !origins.has(req.headers.origin)) reject('This website origin is not configured. Set MARKETING_ORIGIN to the exact website URL and redeploy.');
}

export function createVercelMarketingHandler(handler) {
    return (req, res) => {
        const parsed = new URL(req.url || '/', 'https://localhost');
        // Vercel rewrites supply the original route as a query parameter.
        const route = req.query?.marketingRoute ?? parsed.searchParams.get('marketingRoute');
        if (route != null) {
            if (typeof route !== 'string' || !/^\/(?:config|balance|campaigns(?:\/[a-zA-Z0-9-]+\/send)?)?$/.test(route)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'SMS route not found.' }));
            }
            req.url = '/api/marketing' + (route === '/' ? '' : route);
        }
        return handler(req, res, () => {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'SMS route not found.' }));
        });
    };
}

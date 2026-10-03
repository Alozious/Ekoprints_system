import { createMarketingApi } from '../../server/marketing.mjs';
const handler = createMarketingApi();
export default function marketing(req, res) {
    return handler(req, res, () => { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'SMS API route not found.' })); });
}

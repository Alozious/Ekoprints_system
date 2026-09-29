import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createMarketingApi } from './marketing.mjs';
const root = path.resolve('dist');
const api = createMarketingApi();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
createServer((req, res) => api(req, res, async () => {
    try {
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (pathname.startsWith('/api/')) { res.writeHead(404).end(); return; }
        let file = path.resolve(root, '.' + pathname);
        if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        if (!path.extname(file)) file = path.join(root, 'index.html');
        const contents = await readFile(file);
        res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.end(req.method === 'HEAD' ? undefined : contents);
    } catch { res.writeHead(404).end('Not found'); }
})).listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log('Eko Prints server ready.'));

import test from 'node:test';
import assert from 'node:assert/strict';
import { createVercelMarketingHandler } from './vercelMarketing.mjs';
test('rewritten routes including nested send reach the SMS handler', async () => {
    for (const route of ['/', '/config', '/balance', '/campaigns', '/campaigns/draft-123/send']) {
        let reached;
        const handler = createVercelMarketingHandler(req => { reached = req.url; });
        await handler({ url: '/api/sms?marketingRoute=' + encodeURIComponent(route) }, {});
        assert.equal(reached, '/api/marketing' + (route === '/' ? '' : route));
    }
});
test('invalid routes cannot reach provider handler', () => {
    let invoked = false, body;
    const res = {setHeader(){},end(value){body=value;}};
    createVercelMarketingHandler(() => {invoked=true;})({url:'/api/sms',query:{marketingRoute:'/other'}},res);
    assert.equal(invoked,false); assert.equal(res.statusCode,404); assert.match(body,/not found/);
});

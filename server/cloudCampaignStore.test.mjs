import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudCampaignStore } from './cloudCampaignStore.mjs';
test('concurrent serverless claims cannot overwrite a committed draft claim', async () => {
    let version = 1, state = {campaigns:[{id:'draft',status:'draft'}]};
    const fetcher = async (url, options) => {
        if (options.method !== 'PATCH') return Response.json({fields:{state:{stringValue:JSON.stringify(state)}},updateTime:String(version)});
        if (new URL(url).searchParams.get('currentDocument.updateTime') !== String(version)) return new Response('',{status:409});
        state = JSON.parse(JSON.parse(options.body).fields.state.stringValue); version++;
        return Response.json({updateTime:String(version)});
    };
    const store = createCloudCampaignStore(fetcher), req = {headers:{authorization:'Bearer test'}};
    const first = await store.load(req), second = await store.load(req);
    first.campaigns[0].status = 'submitting';
    await store.save(req, first);
    await assert.rejects(store.save(req, second), /another session/);
    assert.equal((await store.load(req)).campaigns[0].status,'submitting');
});

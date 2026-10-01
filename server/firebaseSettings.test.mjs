import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { sealSettings, openSettings, createFirebaseSettings } from './firebaseSettings.mjs';
test('credentials are encrypted and authenticated, not recoverable with wrong key', () => {
    const key=randomBytes(32), config={username:'test-user',password:'test-password',senderid:'EgoSMS'};
    const sealed=sealSettings(config,key);
    assert.equal(JSON.stringify(sealed).includes('test-password'),false);
    assert.equal(JSON.stringify(sealed).includes('test-user'),false);
    assert.deepEqual(openSettings(sealed,key),config);
    assert.throws(()=>openSettings(sealed,randomBytes(32)));
    assert.throws(()=>openSettings({...sealed,ciphertext:Buffer.from('tampered').toString('base64')},key));
});
test('Firebase saves ciphertext and reloads credentials after store recreation', async t => {
    const directory=await mkdtemp(path.join(os.tmpdir(),'eko-settings-test-'));
    t.after(async()=>{assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'eko-settings-test-'));await rm(directory,{recursive:true,force:true});});
    let remote=null;
    const fetcher=async(url,options)=>{
        assert.match(url,/marketingSettings\/egoSms$/); assert.equal(options.headers.Authorization,'Bearer test');
        if(options.method==='PATCH'){ remote=JSON.parse(options.body); assert.equal(options.body.includes('test-password'),false); return {ok:true,status:200}; }
        return remote ? {ok:true,status:200,json:async()=>remote} : {ok:false,status:404};
    };
    const store=createFirebaseSettings({directory,fetcher}), req={headers:{authorization:'Bearer test'}};
    assert.deepEqual(await store.load(req),{});
    await store.save(req,{username:'test-user',password:'test-password',senderid:'EgoSMS'},'admin');
    assert.equal((await createFirebaseSettings({directory,fetcher}).load(req)).password,'test-password');
    const denied=createFirebaseSettings({directory,fetcher:async()=>({ok:false,status:403})});
    await assert.rejects(()=>denied.save(req,{username:'test'},'admin'),/Firebase denied/);
});

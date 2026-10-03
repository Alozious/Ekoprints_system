import test from 'node:test';
import assert from 'node:assert/strict';
import { personalizeMessage, shortenField } from './messagePersonalization.mjs';
import { validateCampaign, buildSmsPayload } from './server/ego.mjs';
test('limit uses full character allowance and adds three dots only when truncated', () => {
    assert.equal(shortenField('amazing grace stationers kyazanga', 20), 'amazing grace statio...');
    assert.equal(shortenField('KBD ADVERTISING COMPANY', 20), 'KBD ADVERTISING COMP...');
    assert.equal(shortenField('A'.repeat(20), 20), 'A'.repeat(20));
    assert.equal(shortenField('A'.repeat(21), 20), 'A'.repeat(20) + '...');
    assert.equal(shortenField('Grace', 20), 'Grace');
    assert.equal(shortenField('', 20), '');
    assert.equal(Array.from(shortenField('😀'.repeat(30), 20)).length, 23);
});
test('provider receives separate personalized messages and saved fields', () => {
    const campaign = validateCampaign({title:'Test',channel:'sms',message:'Hi {{name:20}} in {{district:30}}',recipients:[{phone:'+256700123456',name:'amazing grace stationers kyazanga',district:'Masaka'},{phone:'+256700123457',name:'Ann'}]});
    const rows = buildSmsPayload({senderid:'Test'}, campaign).msgdata;
    assert.equal(rows[0].message, 'Hi amazing grace statio... in Masaka');
    assert.equal(rows[1].message, 'Hi Ann in ');
    assert.equal(personalizeMessage('Hello everyone', {}), 'Hello everyone');
});
test('expanded message length is enforced before saving', () => {
    assert.throws(() => validateCampaign({title:'Test',channel:'sms',message:'{{address}}'.repeat(10),recipients:[{phone:'+256700123456',name:'Test',address:'a'.repeat(500)}]}), /1,600/);
});

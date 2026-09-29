export const EGO_ENDPOINT = 'https://comms.egosms.co/api/v1/json/';
export function validateCampaign(input) {
    const title = String(input.title || '').trim();
    const message = String(input.message || '').trim();
    if (!title || title.length > 120) throw new Error('Enter a campaign name of up to 120 characters.');
    if (!message || message.length > 1600) throw new Error('Enter a message of up to 1,600 characters.');
    if (!['sms', 'whatsapp'].includes(input.channel)) throw new Error('Invalid channel.');
    if (!Array.isArray(input.recipients) || !input.recipients.length || input.recipients.length > 1000) throw new Error('Choose between 1 and 1,000 phone contacts.');
    const unique = new Map();
    for (const r of input.recipients) {
        if (!/^\+256[347]\d{8}$/.test(r.phone)) throw new Error('Every recipient must have a valid +256 phone number.');
        if (!unique.has(r.phone)) unique.set(r.phone, { phone: r.phone, name: String(r.name || '').slice(0, 200) });
    }
    return { title, message, channel: input.channel, recipients: [...unique.values()] };
}
export function buildSmsPayload(config, campaign) {
    return { method: 'SendSms', userdata: { username: config.username, password: config.password }, msgdata: campaign.recipients.map(r => ({ number: r.phone.slice(1), message: campaign.message, senderid: config.senderid, priority: 1 })) };
}
export async function egoRequest(payload, fetcher = fetch) {
    const response = await fetcher(EGO_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Provider response is uncertain. Check the EGO SMS dashboard before sending again.');
    const body = await response.json();
    if (body.Status === 'Failed') return { status: 'failed', error: String(body.Message || 'EGO SMS rejected the request.').slice(0, 300) };
    if (body.Status !== 'OK') throw new Error('Unrecognized provider response. Check EGO SMS before sending again.');
    return { status: 'accepted', cost: body.Cost ?? null, trackingCode: body.MsgFollowUpUniqueCode || '', balance: body.Balance ?? null };
}

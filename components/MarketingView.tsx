import React, { useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '../firebase';
import type { Customer } from '../types';
import { Campaign, Recipient, campaignAudience, filterCampaignCustomers, combineRecipients } from '../marketing';
import { cleanPhones, splitContacts } from '../customerImport';
import Modal from './Modal';
import './MarketingView.css';
import { messageFields, personalizeMessage, messageLengthSummary } from '../messagePersonalization.mjs';

type Config = { configured: boolean; username: string; senderid: string };
async function api(path = '', body?: unknown) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Sign in to use Marketing.');
    const response = await fetch(`/api/marketing${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    let result;
    try { result = JSON.parse(await response.text()); }
    catch { throw new Error('The website could not reach its EGO SMS connection. Redeploy the latest Vercel routing fix. If this happened while sending, check campaign results and EGO SMS before retrying.'); }
    if (!response.ok) throw new Error(result.error || 'Marketing request failed.');
    return result;
}
const statusLabel: Record<string, string> = { draft: 'Draft', submitting: 'Submission in progress / check EGO SMS', accepted: 'Accepted by EGO SMS', failed: 'Rejected by EGO SMS', unknown: 'Unknown — check EGO SMS' };
export default function MarketingView({ customers }: { customers: Customer[] }) {
    const [channel, setChannel] = useState<'sms' | 'whatsapp' | null>(() => window.location.hash === '#marketing/sms' ? 'sms' : null);
    const [config, setConfig] = useState<Config>({ configured: false, username: '', senderid: '' });
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [senderid, setSenderid] = useState('');
    const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
    const [balance, setBalance] = useState<string | null>(null);
    const [editing, setEditing] = useState(window.location.hash === '#marketing/sms');
    const [smsPage, setSmsPage] = useState<'compose' | 'campaigns' | 'settings'>('compose');
    const [recipientSource, setRecipientSource] = useState<'customers' | 'manual'>('manual');
    useEffect(() => {
        const navigate = () => { const sms = window.location.hash === '#marketing/sms'; setChannel(sms ? 'sms' : null); if (sms) { setSmsPage('compose'); setEditing(true); } };
        window.addEventListener('hashchange', navigate);
        return () => window.removeEventListener('hashchange', navigate);
    }, []);
    const [title, setTitle] = useState(''), [message, setMessage] = useState('');
    const [personalField, setPersonalField] = useState('name');
    const [fieldLimit, setFieldLimit] = useState(20);
    const [category, setCategory] = useState(''), [district, setDistrict] = useState(''), [search, setSearch] = useState('');
    const [selected, setSelected] = useState<string[]>([]), [excluded, setExcluded] = useState<string[]>([]);
    const [primaryOnly, setPrimaryOnly] = useState(false);
    const [from, setFrom] = useState(''), [to, setTo] = useState(''), [sort, setSort] = useState('name-asc');
    const [manual, setManual] = useState<Recipient[]>([]);
    const [manualName, setManualName] = useState(''), [manualPhone, setManualPhone] = useState('');
    const [review, setReview] = useState<Campaign | null>(null);
    const [confirmSend, setConfirmSend] = useState(false);
    const lock = useRef(false);
    const categories = [...new Set(customers.map(c => c.category).filter(Boolean))].sort();
    const districts = [...new Set(customers.map(c => c.district).filter(Boolean))].sort();
    const filtered = useMemo(() => filterCampaignCustomers(customers, { category, district, search, from, to, sort }), [customers, category, district, search, from, to, sort]);
    const filteredSelectedCount = filtered.filter(c => selected.includes(c.id)).length;
    const allFilteredSelected = filtered.length > 0 && filteredSelectedCount === filtered.length;
    const selectAllFilteredRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (selectAllFilteredRef.current) selectAllFilteredRef.current.indeterminate = filteredSelectedCount > 0 && !allFilteredSelected;
    }, [filteredSelectedCount, allFilteredSelected, recipientSource, editing, smsPage, channel]);
    const audience = useMemo(() => campaignAudience(customers.filter(c => selected.includes(c.id)), primaryOnly), [customers, selected, primaryOnly]);
    const combined = combineRecipients(audience.recipients, manual);
    const recipients = combined.filter(r => !excluded.includes(r.phone));
    const messageStats = messageLengthSummary(message, recipients);
    async function refresh() {
        const data = await api(); setConfig(data.config); setCampaigns(data.campaigns);
        setUsername(data.config.username); setSenderid(data.config.senderid);
    }
    useEffect(() => { refresh().catch(e => setError(e.message)); }, []);
    async function run(action: () => Promise<void>) {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError(''); setNotice('');
        try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete the request.'); }
        finally { lock.current = false; setBusy(false); }
    }
    function startCampaign() { setEditing(true); setTitle(''); setMessage(''); setSelected([]); setExcluded([]); setCategory(''); setDistrict(''); setSearch(''); setFrom(''); setTo(''); setSort('name-asc'); setManual([]); setManualName(''); setManualPhone(''); }
    const input = 'w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900';
    const button = 'rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed';
    return <div className={channel === 'sms' ? 'sms-center' : 'space-y-6'}>
        {channel !== 'sms' && <><div><h2 className="text-2xl font-black text-gray-900">Marketing</h2><p className="text-sm text-gray-500 mt-1">Create campaigns and reach your customer contacts.</p></div>
        <div className="grid sm:grid-cols-2 gap-5">
            <button disabled={busy} onClick={() => { window.location.hash = 'marketing/sms'; setChannel('sms'); setSmsPage('compose'); setEditing(true); }} className={`text-left rounded-3xl p-7 shadow-sm border-2 ${channel === 'sms' ? 'border-yellow-400 bg-yellow-50' : 'border-white bg-white'}`}><span className="text-3xl" aria-hidden="true">✉</span><strong className="block text-xl mt-3 text-gray-900">SMS Marketing</strong><span className="text-sm text-gray-600">Campaigns powered by EGO SMS</span></button>
            <button disabled={busy} onClick={() => { setChannel('whatsapp'); setEditing(false); }} className={`text-left rounded-3xl p-7 shadow-sm border-2 ${channel === 'whatsapp' ? 'border-emerald-500 bg-emerald-50' : 'border-white bg-white'}`}><span className="text-3xl" aria-hidden="true">☏</span><strong className="block text-xl mt-3 text-gray-900">WhatsApp</strong><span className="text-sm text-gray-600">Prepare messages and open customer chats</span></button>
        </div>
        </>}
        {channel === 'sms' && <>
            <header className="sms-heading"><div><a href="#marketing" className="sms-back">← Marketing</a><h2>Message Center</h2><p>Connect with your customers through EGO SMS</p></div><div className="sms-wallet"><span>LOCAL SMS CREDITS</span><strong>{balance === null ? 'Balance not checked' : balance}</strong><button disabled={busy || !config.configured} onClick={() => run(async () => { const result = await api('/balance', {}); setBalance(result.balance === null ? 'Unavailable' : String(result.balance)); })}>↻ Check balance</button></div></header>
            <nav className="sms-nav" aria-label="SMS navigation">{([{id:'compose', label:'✉  Single / Bulk SMS'}, {id:'campaigns', label:'▤  Campaigns & Outbox'}, {id:'settings', label:'⚙  SMS Settings'}] as const).map(item => <button key={item.id} disabled={busy} aria-current={smsPage === item.id ? 'page' : undefined} onClick={() => { setSmsPage(item.id); if (item.id === 'compose') setEditing(true); }}>{item.label}</button>)}</nav>
        </>}
        <div className={channel === 'sms' ? 'sms-content' : ''}>
        {error && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-4">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-emerald-50 text-emerald-800 p-4">{notice}</p>}
        {channel === 'sms' && smsPage === 'settings' && <details className="bg-white rounded-2xl p-5" open>
            <summary className="cursor-pointer font-bold">EGO SMS API setup · {config.configured ? 'Configured' : 'Not configured'}</summary>
            <p className="text-sm text-gray-500 my-3">Enter the API credentials from your EGO SMS account and its configured sender ID. Save your API username and password to Firebase. The password is encrypted and never displayed again. Sender ID is optional; leave it blank to use EgoSMS.</p>
            <form onSubmit={e => { e.preventDefault(); run(async () => { const result = await api('/config', { username, password, senderid }); setConfig(result); setPassword(''); setBalance(null); setNotice('SMS settings saved to Firebase. Use Check balance to verify the connection.'); }); }} className="space-y-3">
                <div className="grid sm:grid-cols-3 gap-3"><label className="text-sm font-bold">API username<input required value={username} onChange={e => setUsername(e.target.value)} className={input} autoComplete="off" /></label><label className="text-sm font-bold">API password<input type="password" required={!config.configured || username !== config.username} value={password} onChange={e => setPassword(e.target.value)} placeholder={config.configured ? 'Leave blank to keep saved password' : 'API password'} className={input} autoComplete="new-password" /></label><label className="text-sm font-bold">Sender ID (optional)<input value={senderid} onChange={e => setSenderid(e.target.value)} className={input} placeholder="Your approved sender ID" /></label></div>
                <div className="flex flex-wrap gap-3 items-center"><button disabled={busy} type="submit" className={`${button} bg-gray-900 text-white`}>Save SMS settings to Firebase</button><button disabled={busy || !config.configured} type="button" onClick={() => run(async () => { const result = await api('/balance', {}); setBalance(result.balance === null ? 'Not returned by provider' : String(result.balance)); })} className={`${button} bg-gray-100`}>Check balance</button>{balance !== null && <span>Credit balance: {balance}</span>}<a href="https://developers.pahappa.com/docs/sending-sms/api-specs-and-usage/" target="_blank" rel="noreferrer" className="text-blue-700 text-sm underline">EGO SMS documentation</a></div>
            </form>
        </details>}
        {channel === 'whatsapp' && <p className="bg-emerald-50 p-4 rounded-xl text-sm">Prepare a campaign, then open each contact in WhatsApp with the message filled in. You send it in WhatsApp. Automatic bulk delivery is not connected.</p>}
        {channel && (channel !== 'sms' || smsPage !== 'settings') && <div className="sms-panel bg-white rounded-3xl p-5 space-y-5">
            <div className="flex justify-between items-center"><h3 className="font-black text-lg">{channel === 'sms' ? smsPage === 'compose' ? 'Single / Bulk SMS' : 'Campaigns & Outbox' : 'WhatsApp campaigns'}</h3><button disabled={busy} onClick={() => { startCampaign(); setSmsPage('compose'); }} className={`${button} bg-yellow-400`}>New campaign</button></div>
            {editing && (channel !== 'sms' || smsPage === 'compose') && <form className="space-y-4 border rounded-2xl p-4" onSubmit={e => { e.preventDefault(); run(async () => { const campaign = await api('/campaigns', { title, message, channel, recipients }); setCampaigns(previous => [campaign, ...previous]); setEditing(false); setSmsPage('campaigns'); setReview(campaign); setConfirmSend(false); setNotice('Draft saved. Review the message and contacts before sending.'); }); }}>
                <label className="block font-bold text-sm">Campaign name<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className={input} placeholder="e.g. October printing offer" /></label>
                {channel === 'sms' && <div className="sms-sender"><strong>Sender ID</strong><div><span className="sms-sender-badge">{config.senderid || 'EgoSMS'}</span><span className="sms-muted">{config.configured ? 'EGO SMS account configured' : 'Set up your API credentials before sending'}</span><button type="button" onClick={() => setSmsPage('settings')}>Edit SMS settings</button></div></div>}
                <div className="sms-recipient-tabs" role="group" aria-label="Recipient source"><strong>Phone numbers</strong><label><input type="radio" name="recipient-source" checked={recipientSource === 'manual'} onChange={() => setRecipientSource('manual')} /> Copy and paste</label><label><input type="radio" name="recipient-source" checked={recipientSource === 'customers'} onChange={() => setRecipientSource('customers')} /> Select system customers</label><span>{recipients.length} contacts selected</span></div>
                <div hidden={recipientSource !== 'customers'} className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-3"><input aria-label="Search campaign customers" value={search} onChange={e => setSearch(e.target.value)} className={input} placeholder="Search customers" /><select aria-label="Campaign category" value={category} onChange={e => setCategory(e.target.value)} className={input}><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><input aria-label="Campaign district" list="marketing-districts" value={district} onChange={e => setDistrict(e.target.value)} className={input} placeholder="Search district" /><datalist id="marketing-districts">{districts.map(d => <option key={d} value={d} />)}</datalist></div>
                <div className="grid sm:grid-cols-3 gap-3"><label className="text-sm">Registered from<input type="date" aria-label="Registered from" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className={input} /></label><label className="text-sm">Registered through<input type="date" aria-label="Registered through" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className={input} /></label><label className="text-sm">Sort customers<select aria-label="Sort campaign customers" value={sort} onChange={e => setSort(e.target.value)} className={input}><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="newest">Newest registered</option><option value="oldest">Oldest registered</option></select></label></div>
                <p className="text-xs text-gray-500">Timeline uses customer registration dates in Uganda time, including both selected dates.</p>
                <div className="flex flex-wrap gap-3"><button type="button" className={`${button} bg-gray-100`} onClick={() => setSelected(previous => [...new Set([...previous, ...filtered.map(c => c.id)])])}>Select filtered customers ({filtered.length})</button><button type="button" className={`${button} bg-gray-100`} onClick={() => { setSelected([]); setManual([]); setExcluded([]); }}>Clear selection</button><label className="text-sm self-center"><input type="checkbox" checked={primaryOnly} onChange={e => setPrimaryOnly(e.target.checked)} /> First contact only per customer</label></div>

                <label className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-800">
                    <input ref={selectAllFilteredRef} type="checkbox" disabled={!filtered.length} checked={allFilteredSelected} aria-label="Select all filtered customers" onChange={e => {
                        const checked = e.target.checked;
                        const ids = new Set(filtered.map(c => c.id));
                        setSelected(previous => checked ? [...new Set([...previous, ...ids])] : previous.filter(id => !ids.has(id)));
                    }} />
                    Select all filtered ({filtered.length})
                    <span className="ml-auto font-normal">{filteredSelectedCount} selected</span>
                </label>
                <div className="max-h-48 overflow-auto border rounded-xl p-3 space-y-2">{filtered.map(c => <label key={c.id} className="block text-sm"><input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))} /> <strong>{c.name}</strong> <span className="text-gray-500">{c.phone || 'No phone'}</span></label>)}{!filtered.length && <p>No matching customers.</p>}</div>
                </div><div hidden={recipientSource !== 'manual'}>                <fieldset className="border rounded-xl p-3 space-y-3"><legend className="text-sm font-bold px-2">Add manual contacts to this campaign</legend><div className="grid sm:grid-cols-2 gap-3"><input aria-label="Manual contact name" placeholder="Name (optional)" value={manualName} onChange={e => setManualName(e.target.value)} className={input} /><textarea rows={4} aria-label="Manual phone contacts" placeholder="Enter or paste recipients here… Separate numbers with a slash, comma, semicolon or a new line." value={manualPhone} onChange={e => setManualPhone(e.target.value)} className={input} /></div><button type="button" className={`${button} bg-blue-50 text-blue-700`} onClick={() => {
                    const normalized = cleanPhones(manualPhone);
                    if (!normalized) { setError('Enter valid Ugandan phone contacts separated by /.'); return; }
                    const added = splitContacts(normalized).map(phone => ({ phone, name: manualName.trim() || 'Manual contact' }));
                    setManual(previous => combineRecipients(previous, added)); setExcluded(previous => previous.filter(phone => !added.some(r => r.phone === phone))); setManualName(''); setManualPhone(''); setError('');
                }}>Add contacts</button><p className="text-xs text-gray-500">These contacts are added to this campaign only. Repeated numbers across manual contacts and selected customers receive one message.</p><div className="max-h-32 overflow-auto">{manual.map(r => <div key={r.phone} className="flex justify-between text-sm"><span>{r.name} — {r.phone}</span><button type="button" className="text-red-600" onClick={() => setManual(previous => previous.filter(item => item.phone !== r.phone))}>Remove</button></div>)}</div></fieldset></div>
                <p className="text-sm">{selected.length} selected customers · {manual.length} manual contacts · <strong>{recipients.length} unique phone contacts</strong> · {audience.duplicates} repeated contacts removed · {audience.invalid} invalid contacts excluded · {audience.missing} customers without contacts. Selected contacts are kept when you change search, category, district, dates or sort order.</p>
                <details><summary className="cursor-pointer font-bold text-sm">Review / exclude individual contacts</summary><div className="max-h-48 overflow-auto p-3">{combined.map(r => <label key={r.phone} className="block text-sm"><input type="checkbox" checked={!excluded.includes(r.phone)} onChange={e => setExcluded(e.target.checked ? excluded.filter(p => p !== r.phone) : [...excluded, r.phone])} /> {r.name} — {r.phone}</label>)}</div></details>
                <fieldset className="border rounded p-3 space-y-3"><legend>Customize message</legend><div className="flex flex-wrap gap-3 items-end">
                <label>Customer column<select className={input} value={personalField} onChange={e => setPersonalField(e.target.value)}>{messageFields.map(field => <option key={field}>{field}</option>)}</select></label>
                <label>Character limit<input className={input} type="number" min={3} max={500} value={fieldLimit} onChange={e => setFieldLimit(Number(e.target.value))} /></label>
                <button type="button" className={`${button} bg-blue-50 text-blue-700`} disabled={!Number.isInteger(fieldLimit) || fieldLimit < 3 || fieldLimit > 500} onClick={() => setMessage(previous => previous + `{{${personalField}:${fieldLimit}}}`)}>Insert field</button></div>
                <p className="text-xs">Inserts at the end of your message. The limit includes the three dots. At 20, a long name uses 17 characters plus ... (20 total). Dots appear only when the value exceeds the limit. Shorter names stay unchanged; empty fields appear blank. To change an inserted field, edit its limit in the message, for example {'{{name:20}}'}.</p></fieldset>
                <label className="block font-bold text-sm">Message<textarea required rows={4} maxLength={1600} value={message} onChange={e => setMessage(e.target.value)} className={input} placeholder="Write your campaign message…" /></label><p className="text-xs text-gray-500">{message.length}/1600 characters. SMS charges depend on message length and encoding; EGO SMS returns the actual credit cost after submission.</p>
                {message && <section aria-label="Message length summary" className="rounded border bg-blue-50 p-3 space-y-2"><h4 className="font-bold text-sm">Message length summary</h4>{messageStats ? <><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">{[['Shortest', messageStats.shortest], ['Longest', messageStats.longest], ['Average', messageStats.average], ['Median (middle)', messageStats.median]].map(([label, count]) => <div key={String(label)}><span className="block text-gray-600">{label}</span><strong>{Number(count).toLocaleString(undefined, { maximumFractionDigits: 1 })} characters</strong></div>)}</div><p className="text-xs">Based on all {recipients.length} selected phone contacts after personalization. Character counts are not SMS segment counts.</p></> : <p className="text-sm">Select contacts to see message lengths.</p>}</section>}
                {message && <details open><summary>Personalized previews</summary><div className="max-h-48 overflow-auto">{recipients.map(r => <div key={r.phone} className="p-2 border-b"><strong>{r.name} ({Array.from(personalizeMessage(message, r)).length} characters)</strong><p className="whitespace-pre-wrap">{personalizeMessage(message, r)}</p></div>)}</div></details>}
                {recipients.length > 1000 && <p className="text-red-700">Select at most 1,000 phone contacts for this campaign.</p>}
                <div className="flex gap-3"><button disabled={busy || !recipients.length || recipients.length > 1000} className={`${button} bg-yellow-400`} type="submit">Review campaign →</button><button disabled={busy} className={`${button} bg-gray-100`} type="button" onClick={() => { setEditing(false); setSmsPage('campaigns'); }}>Cancel</button></div>
            </form>}
            {(channel !== 'sms' || smsPage === 'campaigns') && <><div className="flex justify-end"><button disabled={busy} className="text-sm text-blue-700" onClick={() => run(refresh)}>Refresh campaign results</button></div>
            <div className="overflow-auto"><table className="w-full text-sm text-left"><thead className="text-gray-500"><tr><th className="p-2">Campaign</th><th>Contacts</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>{campaigns.filter(c => c.channel === channel).map(c => <tr key={c.id} className="border-t"><td className="p-2 font-bold">{c.title}</td><td>{c.recipients.length}</td><td>{statusLabel[c.status] || c.status}</td><td>{new Date(c.createdAt).toLocaleDateString()}</td><td><button disabled={busy} className="text-blue-700 font-bold p-2" onClick={() => { setReview(c); setConfirmSend(false); }}>Review</button></td></tr>)}</tbody></table>{!campaigns.some(c => c.channel === channel) && <p className="text-center text-gray-500 p-8">No campaigns yet. Create your first campaign above.</p>}</div></>}
        </div>}
        </div>
        {review && <Modal isOpen title={review.title} size="lg" onClose={() => { if (!lock.current) { setReview(null); setConfirmSend(false); } }}><div className="space-y-4 text-sm">
            <p><strong>{review.recipients.length} phone contacts</strong> · {statusLabel[review.status] || review.status}</p><div className="p-4 bg-gray-50 rounded-xl whitespace-pre-wrap break-words">{review.message}</div>
            {review.channel === 'sms' && <><p>Sender ID: <strong>{review.senderid || config.senderid || 'Not configured'}</strong></p>{review.cost != null && <p>Credit cost: {review.cost}</p>}{review.trackingCode && <p className="break-all">EGO SMS tracking code: {review.trackingCode}</p>}<p className="text-gray-500">Accepted means EGO SMS received the campaign. Handset delivery reports are not connected on localhost; check the EGO SMS dashboard for delivery.</p>{review.error && <p className="text-red-700">{review.error}</p>}</>}
            <div className="max-h-52 overflow-auto border rounded-xl p-3 space-y-2">{review.recipients.map(r => <div key={r.phone} className="flex justify-between gap-3"><span>{r.name} — {r.phone}<span className="block whitespace-pre-wrap">{personalizeMessage(review.message, r)}</span></span>{review.channel === 'whatsapp' && <a className="text-emerald-700 font-bold" href={`https://wa.me/${r.phone.slice(1)}?text=${encodeURIComponent(personalizeMessage(review.message, r))}`} target="_blank" rel="noreferrer">Open WhatsApp</a>}</div>)}</div>
            {review.channel === 'sms' && review.status === 'draft' && <><label className="block"><input type="checkbox" checked={confirmSend} disabled={busy} onChange={e => setConfirmSend(e.target.checked)} /> Send this message to these {review.recipients.length} contacts using my EGO SMS credit.</label><button disabled={busy || !confirmSend || !config.configured} className={`${button} bg-yellow-400 w-full`} onClick={() => run(async () => { const result = await api(`/campaigns/${review.id}/send`, { confirmRecipients: review.recipients.length }); setCampaigns(previous => previous.map(c => c.id === result.id ? result : c)); setReview(result); setConfirmSend(false); })}>{busy ? 'Submitting…' : `Send SMS campaign to ${review.recipients.length} contacts`}</button>{!config.configured && <p>Configure EGO SMS before sending.</p>}</>}
            {error && <p role="alert" className="text-red-700">{error}</p>}
        </div></Modal>}
    </div>;
}


import React, { useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import type { Customer } from '../types';
import { fields, Field, CustomerWrite, SheetData, Mapping, Decision, readCustomerWorkbook, suggestMapping, mapRows, planImport } from '../customerImport';
export default function CustomerImportModal({ customers, onClose, onImport }: { customers: Customer[]; onClose: () => void; onImport: (rows: CustomerWrite[]) => Promise<void> }) {
    const [sheet, setSheet] = useState<SheetData | null>(null);
    const [mapping, setMapping] = useState<Mapping | null>(null);
    const [review, setReview] = useState(false);
    const [decisions, setDecisions] = useState<Record<number, Decision>>({});
    const [target, setTarget] = useState('');
    const [incoming, setIncoming] = useState<Field[]>([]);
    const [combinePhones, setCombinePhones] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const lock = useRef(false);
    const rows = useMemo(() => sheet && mapping ? mapRows(sheet, mapping) : [], [sheet, mapping]);
    const plan = useMemo(() => planImport(rows, customers, decisions), [rows, customers, decisions]);
    const pending = plan.pending;
    const selected = pending?.candidates.find(c => c.id === target) || pending?.candidates[0];
    const button = 'px-4 py-2 rounded-xl font-bold bg-gray-100 disabled:opacity-40';
    async function load(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget, file = input.files?.[0];
        if (!file || lock.current) return;
        lock.current = true; setBusy(true); setError(''); setSheet(null); setReview(false); setDecisions({}); setTarget(''); setIncoming([]);
        try {
            if (!/\.(xlsx|xls|csv)$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error('Choose an Excel or CSV file smaller than 5 MB.');
            const result = readCustomerWorkbook(await file.arrayBuffer());
            setSheet(result); setMapping(suggestMapping(result));
        } catch (e) { setError(e instanceof Error ? e.message : 'Unable to read file.'); }
        finally { lock.current = false; setBusy(false); input.value = ''; }
    }
    function decide(action: Decision['action']) {
        if (!pending) return;
        setDecisions(previous => ({ ...previous, [pending.row]: { action, target: selected?.id, incoming, combinePhones } }));
        setTarget(''); setIncoming([]); setCombinePhones(false);
    }
    async function save() {
        if (lock.current || pending || !plan.writes.size) return;
        lock.current = true; setBusy(true); setError('');
        try { await onImport([...plan.writes].map(([id, data]) => ({ id: id.startsWith('import-row:') ? undefined : id, data }))); setDone(true); }
        catch { setError('Saving failed. Check your connection and permissions, then retry.'); }
        finally { lock.current = false; setBusy(false); }
    }
    return <Modal isOpen title="Import and review customers" size="xl" onClose={() => { if (!lock.current) onClose(); }}>
        <div className="space-y-4 text-sm text-gray-700">
            {error && <p role="alert" className="text-red-700">{error}</p>}
            {done ? <><p role="status">Customer changes saved successfully.</p><button onClick={onClose} className={button}>Done</button></> : <>
                <p>Choose Excel or CSV, map your columns, then settle duplicate names, emails and phone numbers. First worksheet only; maximum 400 rows / 5 MB.</p>
                <input aria-label="Customer Excel file" type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={load} />
                {sheet && mapping && !review && <>
                    <p>Match each customer field to an Excel column. Unmapped fields are blank for new customers and can be kept unchanged when merging.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{fields.map(field => <label key={field} className="capitalize font-bold">{field}{field === 'name' ? ' (required)' : ''}<select aria-label={`Excel column for ${field}`} className="block w-full border p-2 rounded-lg" value={mapping[field]} onChange={e => setMapping({ ...mapping, [field]: Number(e.target.value) })}><option value={-1}>Not mapped</option>{sheet.headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header} — {sheet.rows[0]?.values[index] || '(blank)'}</option>)}</select></label>)}</div>
                    <p>Phone cleanup runs automatically: 0700 123 456 → +256700123456. Multiple numbers may be separated by /. Each contact is cleaned and checked for duplicates. Invalid or foreign numbers are flagged for correction.</p>
                    <button className={button} disabled={mapping.name < 0 || new Set(fields.map(f => mapping[f]).filter(v => v >= 0)).size !== fields.map(f => mapping[f]).filter(v => v >= 0).length} onClick={() => { setReview(true); setDecisions({}); }}>Check duplicates and preview</button>
                </>}
                {review && <>
                    <p>{plan.writes.size} customer changes prepared · {plan.skipped} rows skipped. Nothing is saved until you finish.</p>
                    {pending ? <div className="border rounded-xl p-4 space-y-3">
                        <h3 className="font-bold">Excel row {pending.row}: {pending.customer.name || '(missing name)'}</h3>
                        {pending.issue && <p className="text-red-700">{pending.issue}</p>}
                        {!!pending.candidates.length && <>
                            <p>Duplicate found by name, phone or email. Choose a matching customer, then choose each value to keep. Earlier Excel rows are included.</p>
                            <select aria-label="Matching customer" className="border p-2 w-full" value={selected?.id} onChange={e => { setTarget(e.target.value); setIncoming([]); }}>{pending.candidates.map(c => <option key={c.id} value={c.id}>{c.data.name} — {c.data.phone || c.data.email || 'No contact'}{c.id.startsWith('import-row:') ? ' (earlier Excel row)' : ''}</option>)}</select>
                            <div className="overflow-auto"><table className="w-full text-left"><thead><tr><th>Field</th><th>Keep existing</th><th>Use Excel value</th></tr></thead><tbody>{fields.map(field => <tr key={field}><th className="capitalize p-2">{field}</th><td className="p-2"><label><input type="radio" name={`resolve-${field}`} checked={!incoming.includes(field)} onChange={() => setIncoming(incoming.filter(f => f !== field))} /> {selected?.data[field] || '(blank)'}</label></td><td className="p-2"><label><input type="radio" name={`resolve-${field}`} checked={incoming.includes(field)} onChange={() => setIncoming([...incoming, field])} /> {pending.customer[field] || '(blank)'}</label></td></tr>)}</tbody></table></div>
                        </>}
                        {!!pending.candidates.length && <label className="block"><input type="checkbox" checked={combinePhones} onChange={e => setCombinePhones(e.target.checked)} /> Keep all existing and incoming phone contacts (overrides the phone choice above)</label>}
                        <div className="flex flex-wrap gap-2"><button className={button} onClick={() => decide('skip')}>Skip Excel row / keep existing</button>{!!pending.candidates.length && <button className={button} onClick={() => decide('merge')}>Use selected values</button>}{!pending.issue && <button className={button} onClick={() => decide('new')}>Keep as separate customer</button>}</div>
                    </div> : <p className="text-emerald-700">All rows checked. Review the final values below.</p>}
                    <div className="overflow-auto max-h-60"><table className="w-full text-xs text-left"><thead><tr><th>Action</th>{fields.map(f => <th className="p-2 capitalize" key={f}>{f}</th>)}</tr></thead><tbody>{[...plan.writes].map(([id, data]) => <tr key={id}><td>{id.startsWith('import-row:') ? 'Add' : 'Update'}</td>{fields.map(f => <td className="p-2" key={f}>{data[f]}</td>)}</tr>)}</tbody></table></div>
                    <div className="flex gap-3"><button disabled={busy} className={button} onClick={() => { setReview(false); setDecisions({}); }}>Back to mapping</button><button disabled={busy || !!pending || !plan.writes.size} className={`${button} bg-yellow-400`} onClick={save}>{busy ? 'Saving…' : 'Save reviewed customers'}</button></div>
                </>}
            </>}
        </div>
    </Modal>;
}


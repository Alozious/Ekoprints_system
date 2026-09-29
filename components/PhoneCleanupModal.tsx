import React, { useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import type { Customer } from '../types';
import { cleanPhones, CustomerWrite, fields, CustomerInput } from '../customerImport';

export default function PhoneCleanupModal({ customers, onClose, onSave }: { customers: Customer[]; onClose: () => void; onSave: (rows: CustomerWrite[]) => Promise<void> }) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const locked = useRef(false);
    const preview = useMemo(() => customers.filter(c => c.phone).map(customer => ({ customer, phone: cleanPhones(customer.phone) })).filter(row => row.phone !== row.customer.phone), [customers]);
    const changes = preview.filter(row => row.phone !== null).slice(0, 400);
    async function save() {
        if (locked.current || !changes.length) return;
        locked.current = true; setBusy(true); setMessage('');
        try {
            await onSave(changes.map(({ customer, phone }) => ({ id: customer.id, data: { ...Object.fromEntries(fields.map(f => [f, customer[f] || ''])) as CustomerInput, phone: phone! } })));
            setMessage(`Cleaned ${changes.length} phone numbers. Invalid numbers remain unchanged for manual correction.`);
        } catch { setMessage('Could not save changes. Check your connection and retry.'); }
        finally { locked.current = false; setBusy(false); }
    }
    return <Modal isOpen title="Clean customer phone numbers" size="lg" onClose={() => { if (!locked.current) onClose(); }}>
        <div className="space-y-4 text-sm">
            <p>Remove spaces and punctuation and convert Ugandan numbers to +256 followed by nine digits. Multiple contacts separated by /, commas or semicolons are cleaned individually and repeated numbers are removed. Blank numbers are left blank. Invalid and foreign numbers need manual correction.</p>
            <p>{changes.length} numbers ready to clean{preview.filter(row => row.phone !== null).length > 400 ? ' in this batch (run again for the rest)' : ''}.</p>
            <div className="max-h-72 overflow-auto"><table className="w-full text-left"><thead><tr><th>Customer</th><th>Current phone</th><th>Cleaned phone</th></tr></thead><tbody>{preview.map(({ customer, phone }) => <tr key={customer.id}><td className="p-2">{customer.name}</td><td className="p-2">{customer.phone}</td><td className={`p-2 ${phone === null ? 'text-red-700' : 'text-emerald-700'}`}>{phone === null ? 'Needs manual correction' : phone}</td></tr>)}</tbody></table></div>
            {!preview.length && <p>All recorded phone numbers are already clean.</p>}
            {message && <p role="status">{message}</p>}
            <div className="flex justify-end gap-3"><button disabled={busy} onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-xl">Close</button><button disabled={busy || !changes.length} onClick={save} className="px-4 py-2 bg-yellow-400 rounded-xl font-bold disabled:opacity-40">{busy ? 'Saving…' : `Clean ${changes.length} numbers`}</button></div>
        </div>
    </Modal>;
}


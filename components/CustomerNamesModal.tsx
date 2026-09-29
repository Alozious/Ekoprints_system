import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import type { Customer } from '../types';
import { normalizeName, queryCustomerNames } from '../customerNames';

export default function CustomerNamesModal({ customers, onClose, onEdit }: { customers: Customer[]; onClose: () => void; onEdit: (customer: Customer) => void }) {
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState('similar');
    const [page, setPage] = useState(1);
    const matches = useMemo(() => queryCustomerNames(customers), [customers]);
    const results = useMemo(() => customers.filter(c => {
        const related = matches.get(c.id) || [];
        const visible = mode === 'all' || (mode === 'similar' && related.length > 0) || (mode === 'unique' && !!normalizeName(c.name) && !related.length) || (mode === 'exact' && related.some(m => normalizeName(m.customer.name) === normalizeName(c.name)));
        return visible && normalizeName(c.name).includes(normalizeName(query));
    }).sort((a, b) => a.name.localeCompare(b.name)), [customers, matches, mode, query]);
    return <Modal isOpen title="Query customer names" size="xl" onClose={onClose}>
        <div className="space-y-4 text-sm">
            <p>Find repeated names, spelling variations, or unique names among existing customers. Similarity is a suggestion, not proof that two records belong to the same person. No records are changed automatically.</p>
            <div className="flex flex-wrap gap-3"><input aria-label="Search existing customer names" placeholder="Search a customer name…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} className="border rounded-xl p-2 flex-1" /><select aria-label="Name query type" value={mode} onChange={e => { setMode(e.target.value); setPage(1); }} className="border rounded-xl p-2"><option value="similar">Similar or repeated names</option><option value="exact">Repeated names only</option><option value="unique">Unique names (no similar match)</option><option value="all">All names</option></select></div>
            <p role="status">{results.length} customers found. Matching ignores case, punctuation and extra spaces; similar names also include reordered words and small spelling differences.</p>
            <div className="max-h-96 overflow-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Customer / contacts</th><th className="p-2">Possible matches</th><th className="p-2">Action</th></tr></thead><tbody>{results.slice((page - 1) * 20, page * 20).map(c => <tr className="border-t" key={c.id}><td className="p-2"><strong>{c.name || '(No name)'}</strong><div className="break-all">{c.phone || c.email || 'No contact'}</div></td><td className="p-2">{(matches.get(c.id) || []).map(m => <div className="mb-2" key={m.customer.id}><strong>{m.customer.name}</strong><div className="break-all">{m.customer.phone || m.customer.email || 'No contact'}</div><div className="text-xs text-gray-500">{m.reason}</div></div>)}{!matches.get(c.id)?.length && 'No similar name found'}</td><td className="p-2"><button className="text-blue-700 font-bold" onClick={() => onEdit(c)}>Edit customer</button></td></tr>)}</tbody></table></div>
            {!results.length && <p>No customers match this query.</p>}
            <div className="flex justify-end gap-3"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(results.length / 20))}</span><button disabled={page * 20 >= results.length} onClick={() => setPage(page + 1)}>Next</button></div>
        </div>
    </Modal>;
}

import React from 'react';

export default function CustomerContactsInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const contacts = value.split(/[\/;,\n]+/).map(part => part.trim());
    return <div className="space-y-2">
        {contacts.map((contact, index) => <div className="flex gap-2" key={index}>
            <input type="tel" aria-label={`Phone contact ${index + 1}`} value={contact} placeholder="0700 123456 or +256700123456" onChange={e => onChange(contacts.map((v, i) => i === index ? e.target.value : v).join('/'))} className="min-w-0 w-full rounded-xl bg-gray-800 p-3 text-sm text-white" />
            {contacts.length > 1 && <button type="button" aria-label={`Remove phone contact ${index + 1}`} onClick={() => onChange(contacts.filter((_, i) => i !== index).join('/'))} className="text-red-600 px-2">Remove</button>}
        </div>)}
        <button type="button" onClick={() => onChange(`${value}/`)} className="text-blue-700 text-xs font-bold">+ Add another contact</button>
        <p className="text-xs text-gray-500">You can also paste numbers separated by /. Each number is saved as +256 with no spaces.</p>
    </div>;
}

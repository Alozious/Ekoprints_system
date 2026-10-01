import type { Customer } from './types';
import { cleanPhone, splitContacts } from './customerImport.ts';
export type Recipient = { name: string; phone: string };
export type Campaign = { id: string; title: string; channel: 'sms' | 'whatsapp'; message: string; recipients: Recipient[]; status: string; createdAt: string; cost?: number; trackingCode?: string; error?: string; senderid?: string };
export function campaignAudience(customers: Customer[], primaryOnly = false) {
    const recipients = new Map<string, Recipient>();
    let invalid = 0, duplicates = 0, missing = 0;
    for (const customer of customers) {
        const parts = splitContacts(customer.phone || '');
        if (!parts.length) missing++;
        for (const part of (primaryOnly ? parts.slice(0, 1) : parts)) {
            const phone = cleanPhone(part);
            if (!phone) { invalid++; continue; }
            if (recipients.has(phone)) { duplicates++; continue; }
            recipients.set(phone, { name: customer.name, phone });
        }
    }
    return { recipients: [...recipients.values()], invalid, duplicates, missing };
}


export type AudienceFilters = { category: string; district: string; search: string; from: string; to: string; sort: string };
export function filterCampaignCustomers(customers: Customer[], filters: AudienceFilters) {
    const { category, district, search, from, to, sort } = filters;
    return customers.filter(c => {
        const date = new Date(c.createdAt);
        const day = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
        return (!category || (c.category || '').toLowerCase() === category.toLowerCase()) &&
            (!district || (c.district || '').toLowerCase().includes(district.toLowerCase())) &&
            `${c.name} ${c.phone} ${c.email} ${c.category || ''} ${c.district || ''}`.toLowerCase().includes(search.toLowerCase()) &&
            (!from || (!!day && day >= from)) && (!to || (!!day && day <= to));
    }).sort((a, b) => {
        if (sort === 'name-desc') return b.name.localeCompare(a.name);
        if (sort === 'oldest') return (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
        if (sort === 'newest') return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
        return a.name.localeCompare(b.name);
    });
}
export function combineRecipients(system: Recipient[], manual: Recipient[]) {
    return [...new Map([...manual, ...system].map(r => [r.phone, r])).values()];
}

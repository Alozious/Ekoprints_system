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


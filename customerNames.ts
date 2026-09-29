import type { Customer } from './types';
export function normalizeName(value: string): string {
    return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
function distance(a: string, b: string): number {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
    }
    return previous[b.length];
}
export function nameSimilarity(left: string, right: string): string | null {
    const a = normalizeName(left), b = normalizeName(right);
    if (!a || !b) return null;
    if (a === b) return 'Same name (ignoring case, punctuation and spacing)';
    if (a.split(' ').sort().join(' ') === b.split(' ').sort().join(' ')) return 'Same words in a different order';
    if (Math.min(a.length, b.length) < 5) return null;
    const limit = Math.min(a.length, b.length) >= 10 ? 2 : 1;
    if (Math.abs(a.length - b.length) <= limit && distance(a, b) <= limit) return 'Similar spelling — review before changing';
    return null;
}
export function queryCustomerNames(customers: Customer[]) {
    const matches = new Map<string, { customer: Customer; reason: string }[]>(customers.map(c => [c.id, []]));
    for (let i = 0; i < customers.length; i++) for (let j = i + 1; j < customers.length; j++) {
        const reason = nameSimilarity(customers[i].name, customers[j].name);
        if (reason) {
            matches.get(customers[i].id)!.push({ customer: customers[j], reason });
            matches.get(customers[j].id)!.push({ customer: customers[i], reason });
        }
    }
    return matches;
}

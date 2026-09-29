import * as XLSX from 'xlsx';
import type { Customer } from './types';
export const fields = ['name', 'email', 'phone', 'address', 'category', 'district'] as const;
export type Field = typeof fields[number];
export type CustomerInput = Pick<Customer, 'name' | 'email' | 'phone' | 'address' | 'category' | 'district'>;
export type CustomerWrite = { id?: string; data: CustomerInput };
export type ImportRow = { row: number; customer: CustomerInput; issue: string };
export type SheetData = { sheet: string; headers: string[]; rows: { row: number; values: string[] }[] };
export type Mapping = Record<Field, number>;
export type Decision = { action: 'skip' | 'new' | 'merge'; target?: string; incoming?: Field[]; combinePhones?: boolean };
const nameKey = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
export function cleanPhone(value: string): string | null {
    if (!value.trim()) return '';
    if (!/^[+\d\s().-]+$/.test(value)) return null;
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (/^0\d{9}$/.test(digits)) digits = `256${digits.slice(1)}`;
    else if (/^[347]\d{8}$/.test(digits)) digits = `256${digits}`;
    return /^256[347]\d{8}$/.test(digits) ? `+${digits}` : null;
}
export function splitContacts(value: string): string[] {
    return value.split(/[\/;,\n]+/).map(part => part.trim()).filter(Boolean);
}
export function cleanPhones(value: string): string | null {
    const numbers = splitContacts(value).map(cleanPhone);
    return numbers.some(number => number === null) ? null : [...new Set(numbers)].join('/');
}
export function contactKeys(value: string): string[] {
    return splitContacts(value).map(cleanPhone).filter((number): number is string => !!number);
}
export function readCustomerWorkbook(data: ArrayBuffer): SheetData {
    const book = XLSX.read(data, { type: 'array', raw: true, sheetRows: 402 });
    const sheet = book.SheetNames[0];
    if (!sheet) throw new Error('No worksheets found.');
    const cells = XLSX.utils.sheet_to_json<string[]>(book.Sheets[sheet], { header: 1, raw: false, defval: '', blankrows: true });
    const header = cells.findIndex(row => row.some(value => String(value).trim()));
    if (header < 0) throw new Error('The first worksheet is empty.');
    const range = book.Sheets[sheet]['!fullref'] || book.Sheets[sheet]['!ref'];
    if (range && XLSX.utils.decode_range(range).e.r > 400) throw new Error('Maximum 400 rows per import. Split larger files.');
    const rows = cells.slice(header + 1).flatMap((values, index) => values.some(value => String(value).trim()) ? [{ row: header + index + 2, values: values.map(String) }] : []);
    if (!rows.length) throw new Error('No customer rows found.');
    return { sheet, headers: cells[header].map((value, index) => String(value).trim() || `Column ${index + 1}`), rows };
}
export function suggestMapping(sheet: SheetData): Mapping {
    const aliases: Record<Field, string[]> = { name: ['name', 'customername', 'fullname'], email: ['email', 'emailaddress', 'customeremail'], phone: ['phone', 'phonenumber', 'contact', 'customerphone', 'mobile'], address: ['address', 'customeraddress'], category: ['category', 'customercategory'], district: ['district'] };
    return Object.fromEntries(fields.map(field => [field, sheet.headers.findIndex(header => aliases[field].includes(header.toLowerCase().replace(/[^a-z]/g, '')))])) as Mapping;
}
export function mapRows(sheet: SheetData, mapping: Mapping): ImportRow[] {
    return sheet.rows.map(({ row, values }) => {
        const customer = Object.fromEntries(fields.map(field => [field, String(values[mapping[field]] ?? '').trim()])) as CustomerInput;
        const phone = cleanPhones(customer.phone);
        const issue = customerIssue(customer);
        if (phone !== null) customer.phone = phone;
        return { row, customer, issue };
    });
}
export function customerIssue(customer: CustomerInput): string {
    if (!customer.name.trim()) return 'Name is required.';
    if (cleanPhones(customer.phone) === null) return 'One or more contacts cannot be converted to a valid +256 number. Choose valid contacts, correct the file or skip this row.';
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return 'Invalid email address.';
    if (fields.some(field => (customer[field] || '').length > 500)) return 'A field exceeds 500 characters.';
    return '';
}
export function matches(a: CustomerInput, b: CustomerInput): boolean {
    return (!!a.name && nameKey(a.name) === nameKey(b.name)) || (!!a.email && a.email.trim().toLowerCase() === b.email?.trim().toLowerCase()) || contactKeys(a.phone || '').some(phone => contactKeys(b.phone || '').includes(phone));
}
export function planImport(rows: ImportRow[], existing: Customer[], decisions: Record<number, Decision>) {
    const records = new Map<string, CustomerInput>(existing.map(c => [c.id, Object.fromEntries(fields.map(f => [f, c[f] || ''])) as CustomerInput]));
    const writes = new Map<string, CustomerInput>();
    let skipped = 0;
    for (const row of rows) {
        const decision = decisions[row.row];
        if (decision?.action === 'skip') { skipped++; continue; }
        const candidates = [...records].filter(([, data]) => matches(data, row.customer)).map(([id, data]) => ({ id, data }));
        if ((row.issue || candidates.length) && !decision) return { writes, skipped, pending: { ...row, candidates } };
        if (decision?.action === 'merge') {
            const target = records.get(decision.target!);
            if (!target || !candidates.some(c => c.id === decision.target)) return { writes, skipped, pending: { ...row, candidates } };
            const merged = { ...target };
            for (const field of decision.incoming || []) merged[field] = row.customer[field] || '';
            if (decision.combinePhones) merged.phone = [target.phone, row.customer.phone].filter(Boolean).join('/');
            const issue = customerIssue(merged);
            if (issue) return { writes, skipped, pending: { ...row, issue, candidates } };
            const phone = cleanPhones(merged.phone);
            if (phone === null) return { writes, skipped, pending: { ...row, issue: 'Choose the valid incoming phone or skip this row; the existing phone is invalid.', candidates } };
            merged.phone = phone;
            records.set(decision.target!, merged); writes.set(decision.target!, merged);
        } else {
            if (row.issue) return { writes, skipped, pending: { ...row, candidates } };
            const id = `import-row:${row.row}`;
            records.set(id, row.customer); writes.set(id, row.customer);
        }
    }
    return { writes, skipped, pending: null };
}

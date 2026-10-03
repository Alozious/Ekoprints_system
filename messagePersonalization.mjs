export const messageFields = ['name', 'phone', 'address', 'category', 'district', 'email'];
export function shortenField(value, limit) {
    const chars = Array.from(String(value || '').trim());
    if (!limit || chars.length <= limit) return chars.join('');
    return chars.slice(0, limit).join('') + '...';
}
export function personalizeMessage(message, recipient) {
    return message.replace(/\{\{(name|phone|address|category|district|email)(?::(\d+))?\}\}/g, (_, field, limit) => shortenField(recipient[field], limit ? Math.max(1, Math.min(1600, Number(limit))) : 0));
}

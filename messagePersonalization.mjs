export const messageFields = ['name', 'phone', 'address', 'category', 'district', 'email'];
export function shortenField(value, limit) {
    const chars = Array.from(String(value || '').trim());
    if (!limit || chars.length <= limit) return chars.join('');
    const dots = '.'.repeat(Math.min(3, limit));
    return chars.slice(0, limit - dots.length).join('') + dots;
}
export function messageLengthSummary(message, recipients) {
    if (!recipients.length) return null;
    const lengths = recipients.map(recipient => Array.from(personalizeMessage(message, recipient)).length).sort((a, b) => a - b);
    const middle = Math.floor(lengths.length / 2);
    return {
        shortest: lengths[0], longest: lengths[lengths.length - 1],
        average: lengths.reduce((sum, length) => sum + length, 0) / lengths.length,
        median: lengths.length % 2 ? lengths[middle] : (lengths[middle - 1] + lengths[middle]) / 2,
    };
}
export function personalizeMessage(message, recipient) {
    return message.replace(/\{\{(name|phone|address|category|district|email)(?::(\d+))?\}\}/g, (_, field, limit) => shortenField(recipient[field], limit ? Math.max(1, Math.min(1600, Number(limit))) : 0));
}

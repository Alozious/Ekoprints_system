export const CONSOLIDATED_CATEGORY = 'PRINTING-PHOTOGRAPHY-BRANDING';
export function consolidateCategory(value?: string): string {
    return (value || '').trim() ? CONSOLIDATED_CATEGORY : value || '';
}

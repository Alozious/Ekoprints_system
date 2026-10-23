import type { StockUnit } from './types.ts';

export const stockUnits: StockUnit[] = ['roll', 'ream', 'packet', 'bottle', 'cartridge', 'cone', 'pcs'];
export function variantDefinitions(text: string, unit: StockUnit) {
  const labels = text.split(/[,\n]/).map(label => label.trim()).filter(Boolean);
  if (!labels.length) throw new Error('Enter at least one variant.');
  if (labels.length > 40) throw new Error('Add up to 40 variants at a time.');
  const variants = labels.map(label => {
    const match = unit === 'roll' ? label.match(/^(\d+(?:\.\d+)?|\.\d+)\s*m?$/i) : null;
    if (unit === 'roll' && /^[+\-\d.]/.test(label) && !match) throw new Error('Enter roll widths as positive meters, e.g. 1.27.');
    const width = match ? Number(match[1]) : undefined;
    if (width !== undefined && (!Number.isFinite(width) || width <= 0)) throw new Error('Roll widths must be positive.');
    return { variantLabel: width === undefined ? label : `${width} m`, width: width ?? 0 };
  });
  if (new Set(variants.map(v => v.variantLabel.toLocaleLowerCase())).size !== variants.length) throw new Error('Duplicate variants in this list.');
  return variants;
}

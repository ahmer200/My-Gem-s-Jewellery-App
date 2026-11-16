export interface AutoSkuInput {
  sizeMm?: string;
  subCategory?: string;
  stockPieces?: number;
  batchNumber?: string;
}

function cleanToken(raw: string | undefined, fallback: string, maxLen: number): string {
  const cleaned = (raw || '')
    .trim()
    .toUpperCase()
    .replace(/MM/g, '')
    .replace(/[×*]/g, 'X')
    .replace(/[^A-Z0-9.X]+/g, '')
    .replace(/^\.+|\.+$/g, '');
  return (cleaned || fallback).slice(0, maxLen);
}

/**
 * Generates an inventory SKU deterministically from:
 * Sub-Category, Product Size (mm), Stock Pieces, and Batch #.
 * Example: "Calibrated" + "8 x 6 mm" + 12 pcs + "B-2026-01" -> "CAL-8X6-12P-B202601"
 */
export function generateInventorySku(input: AutoSkuInput): string {
  const subTok = cleanToken(input.subCategory, 'GEM', 4);
  const sizeTok = cleanToken(input.sizeMm, 'STD', 10);
  const pcsVal = Math.max(0, Math.round(Number(input.stockPieces) || 0));
  const pcsTok = `${pcsVal}P`;
  const batchTok = cleanToken(input.batchNumber, 'B01', 10);

  return `${subTok}-${sizeTok}-${pcsTok}-${batchTok}`.slice(0, 64);
}

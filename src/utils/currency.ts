import { CompanyProfile, CurrencyCode } from '../types/business';

export interface LineItemCalcInput {
  quantity: number;
  unitPriceOrig: number;
  markupPercent?: number;
}

export interface InvoiceCalculationInput {
  baseSubtotal: number;
  sourceCurrency: CurrencyCode;
  rmbRateUsed: number;
  usdRateUsed: number;
  markupPercentUsed: number;
  items?: LineItemCalcInput[];
}

export interface InvoiceCalculationResult {
  sourceCurrency: CurrencyCode;
  finalCurrency: CurrencyCode;
  exchangeRateApplied: number;
  isOriginalCurrencyMode: boolean;
  baseSubtotal: number;
  convertedAmountPkr: number;
  markupPercentUsed: number;
  markupAmount: number;
  finalTotal: number;
  finalTotalPkrEquivalent: number;
  calculationExplanation: string;
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  switch (currency) {
    case 'RMB':
      return '¥ RMB';
    case 'USD':
      return '$ USD';
    case 'PKR':
      return 'Rs. PKR';
  }
}

export function getCurrencyShortSymbol(currency: CurrencyCode): string {
  switch (currency) {
    case 'RMB':
      return 'RMB';
    case 'USD':
      return 'USD';
    case 'PKR':
      return 'PKR';
  }
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = safe.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${getCurrencyShortSymbol(currency)}`;
}

export function convertToPkr(
  amount: number,
  currency: CurrencyCode,
  rmbToPkr: number,
  usdToPkr: number
): number {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  if (currency === 'PKR') return safeAmount;
  if (currency === 'RMB') return rmbToPkr > 0 ? safeAmount * rmbToPkr : safeAmount;
  if (currency === 'USD') return usdToPkr > 0 ? safeAmount * usdToPkr : safeAmount;
  return safeAmount;
}

export function getRateForCurrency(
  currency: CurrencyCode,
  rmbToPkr: number,
  usdToPkr: number
): number {
  if (currency === 'RMB') return rmbToPkr;
  if (currency === 'USD') return usdToPkr;
  return 1;
}

export function getLineItemAmounts(
  item: LineItemCalcInput,
  fallbackPercent: number
): {
  lineBaseOrig: number;
  percentUsed: number;
  lineMarkupOrig: number;
  lineTotalOrig: number;
} {
  const qty = Math.max(0, Number(item.quantity) || 0);
  const unit = Math.max(0, Number(item.unitPriceOrig) || 0);
  const percentUsed = Number.isFinite(item.markupPercent)
    ? Number(item.markupPercent)
    : fallbackPercent;
  const lineBaseOrig = qty * unit;
  const lineMarkupOrig = lineBaseOrig * (percentUsed / 100);
  const lineTotalOrig = lineBaseOrig + lineMarkupOrig;
  return { lineBaseOrig, percentUsed, lineMarkupOrig, lineTotalOrig };
}

/**
 * Exact Invoice Currency & Per-Item Percentage Calculation System:
 * - Each line item can carry its own percentage markup (or fallback to invoice default %).
 * - If product price is entered in RMB and RMB rate > 0: auto convert RMB -> PKR using RMB rate, apply per-item markup %, show final PKR price.
 * - If product price is entered in USD and USD rate > 0 (and RMB rate is not 0): auto convert USD -> PKR using USD rate, apply per-item markup %, show final PKR price.
 * - If RMB value = 0 in invoice (or active foreign rate = 0): invoice total is calculated and shown in original currency (RMB or USD),
 *   and final amount clearly mentions currency symbol (RMB / USD / PKR) at the end of bill.
 * - If product price is entered in PKR: apply per-item markup % directly in PKR.
 */
export function calculateInvoiceTotals(
  input: InvoiceCalculationInput,
  fallbackProfile?: Pick<CompanyProfile, 'rmbToPkr' | 'usdToPkr'>
): InvoiceCalculationResult {
  const rmbRate = Math.max(0, Number(input.rmbRateUsed) || 0);
  const usdRate = Math.max(0, Number(input.usdRateUsed) || 0);
  const defaultMarkup = Math.max(0, Number(input.markupPercentUsed) || 0);

  let baseSubtotal = Math.max(0, Number(input.baseSubtotal) || 0);
  let totalMarkupOrig = baseSubtotal * (defaultMarkup / 100);
  let effectiveMarkupPercent = defaultMarkup;

  if (input.items && input.items.length > 0) {
    baseSubtotal = input.items.reduce(
      (sum, li) => sum + Math.max(0, Number(li.unitPriceOrig) || 0) * Math.max(0, Number(li.quantity) || 0),
      0
    );
    totalMarkupOrig = input.items.reduce((sum, li) => {
      const { lineMarkupOrig } = getLineItemAmounts(li, defaultMarkup);
      return sum + lineMarkupOrig;
    }, 0);
    effectiveMarkupPercent =
      baseSubtotal > 0
        ? Number(((totalMarkupOrig / baseSubtotal) * 100).toFixed(2))
        : defaultMarkup;
  }

  if (input.sourceCurrency === 'PKR') {
    const markupAmount = totalMarkupOrig;
    const finalTotal = baseSubtotal + markupAmount;
    return {
      sourceCurrency: 'PKR',
      finalCurrency: 'PKR',
      exchangeRateApplied: 1,
      isOriginalCurrencyMode: false,
      baseSubtotal,
      convertedAmountPkr: baseSubtotal,
      markupPercentUsed: effectiveMarkupPercent,
      markupAmount,
      finalTotal,
      finalTotalPkrEquivalent: finalTotal,
      calculationExplanation: `Entered in PKR (Rate: 1.00) + ${effectiveMarkupPercent}% avg item markup = ${formatMoney(finalTotal, 'PKR')}`,
    };
  }

  // Rule: If RMB value = 0 in invoice, show invoice total in original currency (RMB or USD)
  if (rmbRate === 0 || (input.sourceCurrency === 'USD' && usdRate === 0)) {
    const markupAmount = totalMarkupOrig;
    const finalTotal = baseSubtotal + markupAmount;
    const referenceRate =
      input.sourceCurrency === 'RMB'
        ? fallbackProfile?.rmbToPkr || 0
        : fallbackProfile?.usdToPkr || usdRate || 0;
    const pkrEquivalent = referenceRate > 0 ? finalTotal * referenceRate : finalTotal;

    return {
      sourceCurrency: input.sourceCurrency,
      finalCurrency: input.sourceCurrency,
      exchangeRateApplied: 0,
      isOriginalCurrencyMode: true,
      baseSubtotal,
      convertedAmountPkr: 0,
      markupPercentUsed: effectiveMarkupPercent,
      markupAmount,
      finalTotal,
      finalTotalPkrEquivalent: pkrEquivalent,
      calculationExplanation: `RMB Rate = 0 (Original Currency Mode): ${formatMoney(baseSubtotal, input.sourceCurrency)} + ${effectiveMarkupPercent}% item markup = ${formatMoney(finalTotal, input.sourceCurrency)}`,
    };
  }

  // Standard Foreign Currency -> PKR conversion + per-item percentage markup
  const activeRate = input.sourceCurrency === 'RMB' ? rmbRate : usdRate;
  const convertedAmountPkr = baseSubtotal * activeRate;
  const markupAmount = totalMarkupOrig * activeRate;
  const finalTotal = convertedAmountPkr + markupAmount;

  return {
    sourceCurrency: input.sourceCurrency,
    finalCurrency: 'PKR',
    exchangeRateApplied: activeRate,
    isOriginalCurrencyMode: false,
    baseSubtotal,
    convertedAmountPkr,
    markupPercentUsed: effectiveMarkupPercent,
    markupAmount,
    finalTotal,
    finalTotalPkrEquivalent: finalTotal,
    calculationExplanation: `${formatMoney(baseSubtotal, input.sourceCurrency)} × ${activeRate.toFixed(2)} = ${formatMoney(convertedAmountPkr, 'PKR')} + ${effectiveMarkupPercent}% item markup = ${formatMoney(finalTotal, 'PKR')}`,
  };
}

export function computeItemFinalPkr(
  baseSellPrice: number,
  sellCurrency: CurrencyCode,
  profile: Pick<CompanyProfile, 'rmbToPkr' | 'usdToPkr' | 'defaultMarkupPercent'>
): { convertedPkr: number; finalPkr: number; rate: number } {
  const rate = getRateForCurrency(sellCurrency, profile.rmbToPkr, profile.usdToPkr);
  const convertedPkr =
    sellCurrency === 'PKR' ? baseSellPrice : rate > 0 ? baseSellPrice * rate : baseSellPrice;
  const finalPkr = convertedPkr * (1 + (profile.defaultMarkupPercent || 0) / 100);
  return { convertedPkr, finalPkr, rate };
}

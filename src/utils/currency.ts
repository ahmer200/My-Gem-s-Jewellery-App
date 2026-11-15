import { CompanyProfile, CurrencyCode } from '../types/business';

export interface InvoiceCalculationInput {
  baseSubtotal: number;
  sourceCurrency: CurrencyCode;
  rmbRateUsed: number;
  usdRateUsed: number;
  markupPercentUsed: number;
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

/**
 * Exact Invoice Currency & Percentage Calculation System:
 * - If product price is entered in RMB and RMB rate > 0: auto convert RMB -> PKR using RMB rate, apply markup %, show final PKR price.
 * - If product price is entered in USD and USD rate > 0 (and RMB rate is not 0): auto convert USD -> PKR using USD rate, apply markup %, show final PKR price.
 * - If RMB value = 0 in invoice (or the active foreign rate = 0): invoice total is calculated and shown in original currency (RMB or USD),
 *   and final amount clearly mentions currency symbol (RMB / USD / PKR) at the end of bill.
 * - If product price is entered in PKR: apply markup % directly in PKR.
 */
export function calculateInvoiceTotals(
  input: InvoiceCalculationInput,
  fallbackProfile?: Pick<CompanyProfile, 'rmbToPkr' | 'usdToPkr'>
): InvoiceCalculationResult {
  const baseSubtotal = Math.max(0, Number(input.baseSubtotal) || 0);
  const rmbRate = Math.max(0, Number(input.rmbRateUsed) || 0);
  const usdRate = Math.max(0, Number(input.usdRateUsed) || 0);
  const markupPercent = Math.max(0, Number(input.markupPercentUsed) || 0);

  if (input.sourceCurrency === 'PKR') {
    const markupAmount = baseSubtotal * (markupPercent / 100);
    const finalTotal = baseSubtotal + markupAmount;
    return {
      sourceCurrency: 'PKR',
      finalCurrency: 'PKR',
      exchangeRateApplied: 1,
      isOriginalCurrencyMode: false,
      baseSubtotal,
      convertedAmountPkr: baseSubtotal,
      markupPercentUsed: markupPercent,
      markupAmount,
      finalTotal,
      finalTotalPkrEquivalent: finalTotal,
      calculationExplanation: `Entered in PKR (Rate: 1.00) + ${markupPercent}% markup = ${formatMoney(finalTotal, 'PKR')}`,
    };
  }

  // Rule: If RMB value = 0 in invoice, show invoice total in original currency (RMB or USD)
  if (rmbRate === 0 || (input.sourceCurrency === 'USD' && usdRate === 0)) {
    const markupAmount = baseSubtotal * (markupPercent / 100);
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
      markupPercentUsed: markupPercent,
      markupAmount,
      finalTotal,
      finalTotalPkrEquivalent: pkrEquivalent,
      calculationExplanation: `RMB Rate = 0 (Original Currency Mode): ${formatMoney(baseSubtotal, input.sourceCurrency)} + ${markupPercent}% markup = ${formatMoney(finalTotal, input.sourceCurrency)}`,
    };
  }

  // Standard Foreign Currency -> PKR conversion + percentage markup
  const activeRate = input.sourceCurrency === 'RMB' ? rmbRate : usdRate;
  const convertedAmountPkr = baseSubtotal * activeRate;
  const markupAmount = convertedAmountPkr * (markupPercent / 100);
  const finalTotal = convertedAmountPkr + markupAmount;

  return {
    sourceCurrency: input.sourceCurrency,
    finalCurrency: 'PKR',
    exchangeRateApplied: activeRate,
    isOriginalCurrencyMode: false,
    baseSubtotal,
    convertedAmountPkr,
    markupPercentUsed: markupPercent,
    markupAmount,
    finalTotal,
    finalTotalPkrEquivalent: finalTotal,
    calculationExplanation: `${formatMoney(baseSubtotal, input.sourceCurrency)} × ${activeRate.toFixed(2)} = ${formatMoney(convertedAmountPkr, 'PKR')} + ${markupPercent}% markup = ${formatMoney(finalTotal, 'PKR')}`,
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

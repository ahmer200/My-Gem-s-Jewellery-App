import { CompanyProfile, CurrencyCode } from '../types/business';
import {
  DEFAULT_CURRENCY_RATES_PKR,
  getWorldCurrency,
  normalizeCurrencyCode,
} from './worldCurrencies';

export interface LineItemCalcInput {
  quantity: number;
  unitPriceOrig: number;
  markupPercent?: number;
}

export interface InvoiceCalculationInput {
  baseSubtotal: number;
  sourceCurrency: CurrencyCode;
  exchangeRateUsed: number;
  markupPercentUsed: number;
  courierCharges?: number;
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
  courierCharges: number;
  courierChargesPkrEquivalent: number;
  finalTotal: number;
  finalTotalPkrEquivalent: number;
  calculationExplanation: string;
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  const info = getWorldCurrency(currency);
  return `${info.symbol} ${info.code}`;
}

export function getCurrencyShortSymbol(currency: CurrencyCode): string {
  const clean = (currency || 'PKR').trim().toUpperCase();
  if (clean === 'RMB') return 'RMB';
  return clean || 'PKR';
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = safe.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${getCurrencyShortSymbol(currency)}`;
}

/**
 * Look up the saved conversion rate (-> PKR) for any world currency from CompanyProfile,
 * falling back to DEFAULT_CURRENCY_RATES_PKR or 0 if not set.
 */
export function getRateForCurrency(
  currency: CurrencyCode,
  profile?: Pick<CompanyProfile, 'currencyRates' | 'rmbToPkr' | 'usdToPkr'> | null
): number {
  const raw = (currency || 'PKR').trim().toUpperCase();
  if (raw === 'PKR') return 1;
  const normalized = normalizeCurrencyCode(raw);

  if (profile?.currencyRates) {
    if (typeof profile.currencyRates[raw] === 'number') {
      return Math.max(0, profile.currencyRates[raw]);
    }
    if (typeof profile.currencyRates[normalized] === 'number') {
      return Math.max(0, profile.currencyRates[normalized]);
    }
  }

  if ((raw === 'RMB' || normalized === 'CNY') && typeof profile?.rmbToPkr === 'number') {
    return Math.max(0, profile.rmbToPkr);
  }
  if (normalized === 'USD' && typeof profile?.usdToPkr === 'number') {
    return Math.max(0, profile.usdToPkr);
  }

  if (typeof DEFAULT_CURRENCY_RATES_PKR[raw] === 'number') {
    return DEFAULT_CURRENCY_RATES_PKR[raw];
  }
  if (typeof DEFAULT_CURRENCY_RATES_PKR[normalized] === 'number') {
    return DEFAULT_CURRENCY_RATES_PKR[normalized];
  }
  return 0;
}

export function convertToPkr(
  amount: number,
  currency: CurrencyCode,
  rateOrProfile:
    | number
    | Pick<CompanyProfile, 'currencyRates' | 'rmbToPkr' | 'usdToPkr'>
    | undefined
): number {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const clean = (currency || 'PKR').trim().toUpperCase();
  if (clean === 'PKR') return safeAmount;

  const rate =
    typeof rateOrProfile === 'number'
      ? Math.max(0, rateOrProfile)
      : getRateForCurrency(clean, rateOrProfile);

  return rate > 0 ? safeAmount * rate : safeAmount;
}

export function convertAmountBetweenCurrencies(
  amount: number,
  fromCur: CurrencyCode,
  toCur: CurrencyCode,
  fromRateToPkr: number,
  toRateToPkr: number
): number {
  const fromClean = normalizeCurrencyCode(fromCur);
  const toClean = normalizeCurrencyCode(toCur);
  if (fromClean === toClean) return Number((amount || 0).toFixed(2));
  const pkr = fromClean === 'PKR' ? amount : (fromRateToPkr > 0 ? amount * fromRateToPkr : amount);
  if (toClean === 'PKR') return Number(pkr.toFixed(2));
  return Number((toRateToPkr > 0 ? pkr / toRateToPkr : pkr).toFixed(2));
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
 * Universal World Currency & Per-Item Percentage Calculation System:
 * - Supports any world currency (PKR, USD, CNY, AED, SAR, EUR, GBP, etc.).
 * - If sourceCurrency === 'PKR': calculates directly in PKR.
 * - If conversion box (exchangeRateUsed) > 0: converts sourceCurrency -> PKR at exchangeRateUsed, applies markup % & courier charges in PKR.
 * - If conversion box (exchangeRateUsed) === 0: keeps invoice & final amount in its selected sourceCurrency (NO PKR conversion).
 */
export function calculateInvoiceTotals(
  input: InvoiceCalculationInput,
  fallbackProfile?: Pick<CompanyProfile, 'currencyRates' | 'rmbToPkr' | 'usdToPkr'>
): InvoiceCalculationResult {
  const rate = Math.max(0, Number(input.exchangeRateUsed) || 0);
  const defaultMarkup = Math.max(0, Number(input.markupPercentUsed) || 0);
  const srcCode = getCurrencyShortSymbol(input.sourceCurrency);

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

  const courierCharges = Math.max(0, Number(input.courierCharges) || 0);
  const courierNote = courierCharges > 0 ? ` + Courier ${courierCharges.toFixed(2)}` : '';

  if (srcCode === 'PKR') {
    const markupAmount = totalMarkupOrig;
    const finalTotal = baseSubtotal + markupAmount + courierCharges;
    return {
      sourceCurrency: 'PKR',
      finalCurrency: 'PKR',
      exchangeRateApplied: 1,
      isOriginalCurrencyMode: false,
      baseSubtotal,
      convertedAmountPkr: baseSubtotal,
      markupPercentUsed: effectiveMarkupPercent,
      markupAmount,
      courierCharges,
      courierChargesPkrEquivalent: courierCharges,
      finalTotal,
      finalTotalPkrEquivalent: finalTotal,
      calculationExplanation: `Entered in PKR (Rate: 1.00) + ${effectiveMarkupPercent}% avg item markup${courierNote} = ${formatMoney(finalTotal, 'PKR')}`,
    };
  }

  // Rule: If conversion rate box = 0, keep the amount in its own selected currency (not PKR)
  if (rate === 0) {
    const markupAmount = totalMarkupOrig;
    const finalTotal = baseSubtotal + markupAmount + courierCharges;
    const referenceRate = getRateForCurrency(srcCode, fallbackProfile);
    const pkrEquivalent = referenceRate > 0 ? finalTotal * referenceRate : finalTotal;
    const courierPkr = referenceRate > 0 ? courierCharges * referenceRate : courierCharges;

    return {
      sourceCurrency: srcCode,
      finalCurrency: srcCode,
      exchangeRateApplied: 0,
      isOriginalCurrencyMode: true,
      baseSubtotal,
      convertedAmountPkr: 0,
      markupPercentUsed: effectiveMarkupPercent,
      markupAmount,
      courierCharges,
      courierChargesPkrEquivalent: courierPkr,
      finalTotal,
      finalTotalPkrEquivalent: pkrEquivalent,
      calculationExplanation: `Conversion Rate = 0 (Kept in ${srcCode}): ${formatMoney(baseSubtotal, srcCode)} + ${effectiveMarkupPercent}% item markup${courierNote} = ${formatMoney(finalTotal, srcCode)}`,
    };
  }

  // Standard Foreign Currency -> PKR conversion + per-item percentage markup + courier charges (PKR)
  const convertedAmountPkr = baseSubtotal * rate;
  const markupAmount = totalMarkupOrig * rate;
  const finalTotal = convertedAmountPkr + markupAmount + courierCharges;

  return {
    sourceCurrency: srcCode,
    finalCurrency: 'PKR',
    exchangeRateApplied: rate,
    isOriginalCurrencyMode: false,
    baseSubtotal,
    convertedAmountPkr,
    markupPercentUsed: effectiveMarkupPercent,
    markupAmount,
    courierCharges,
    courierChargesPkrEquivalent: courierCharges,
    finalTotal,
    finalTotalPkrEquivalent: finalTotal,
    calculationExplanation: `${formatMoney(baseSubtotal, srcCode)} × ${rate.toFixed(2)} = ${formatMoney(convertedAmountPkr, 'PKR')} + ${effectiveMarkupPercent}% item markup${courierNote} = ${formatMoney(finalTotal, 'PKR')}`,
  };
}

export function computeItemFinalPrice(
  baseSellPrice: number,
  sellCurrency: CurrencyCode,
  profile: Pick<CompanyProfile, 'currencyRates' | 'rmbToPkr' | 'usdToPkr' | 'defaultMarkupPercent'>,
  overrideRate?: number
): {
  convertedAmount: number;
  finalAmount: number;
  finalCurrency: CurrencyCode;
  finalPkrEquivalent: number;
  rate: number;
  isOriginalCurrency: boolean;
} {
  const cleanCur = getCurrencyShortSymbol(sellCurrency);
  const rawPrice = Math.max(0, Number(baseSellPrice) || 0);
  const markupFactor = 1 + (profile.defaultMarkupPercent || 0) / 100;

  if (cleanCur === 'PKR') {
    const finalAmount = rawPrice * markupFactor;
    return {
      convertedAmount: rawPrice,
      finalAmount,
      finalCurrency: 'PKR',
      finalPkrEquivalent: finalAmount,
      rate: 1,
      isOriginalCurrency: false,
    };
  }

  const rate =
    typeof overrideRate === 'number'
      ? Math.max(0, overrideRate)
      : getRateForCurrency(cleanCur, profile);

  if (rate === 0) {
    const finalAmount = rawPrice * markupFactor;
    const refRate = getRateForCurrency(cleanCur, profile);
    return {
      convertedAmount: rawPrice,
      finalAmount,
      finalCurrency: cleanCur,
      finalPkrEquivalent: refRate > 0 ? finalAmount * refRate : finalAmount,
      rate: 0,
      isOriginalCurrency: true,
    };
  }

  const convertedAmount = rawPrice * rate;
  const finalAmount = convertedAmount * markupFactor;
  return {
    convertedAmount,
    finalAmount,
    finalCurrency: 'PKR',
    finalPkrEquivalent: finalAmount,
    rate,
    isOriginalCurrency: false,
  };
}

export function computeItemFinalPkr(
  baseSellPrice: number,
  sellCurrency: CurrencyCode,
  profile: Pick<CompanyProfile, 'currencyRates' | 'rmbToPkr' | 'usdToPkr' | 'defaultMarkupPercent'>,
  overrideRate?: number
): { convertedPkr: number; finalPkr: number; rate: number; finalCurrency: CurrencyCode; finalDisplayAmount: number; isOriginalCurrency: boolean } {
  const res = computeItemFinalPrice(baseSellPrice, sellCurrency, profile, overrideRate);
  return {
    convertedPkr: res.convertedAmount,
    finalPkr: res.finalPkrEquivalent,
    rate: res.rate,
    finalCurrency: res.finalCurrency,
    finalDisplayAmount: res.finalAmount,
    isOriginalCurrency: res.isOriginalCurrency,
  };
}

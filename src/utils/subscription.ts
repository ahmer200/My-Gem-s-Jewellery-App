import { ProFeatureKey, UserSubscription } from '../types/business';

export const MASTER_OWNER_EMAIL = 'ahmer.iqbal.khan@gmail.com';
export const DEFAULT_BRAND_NAME = "N.A GEM'S";

export const MEEZAN_BANK_DETAILS = {
  bankName: 'Meezan Bank',
  accountTitle: 'AHMER IQBAL',
  accountNumber: '16020109874519',
  iban: 'PK54MEZN0016020109874519',
  branch: 'LATIFABAD BRANCH-HYD',
} as const;

export const SUBSCRIPTION_PLANS = {
  monthly: {
    id: 'monthly' as const,
    name: 'Monthly Pro Full Version',
    nameUr: 'ماہانہ پرو فل ورژن',
    pricePkr: 4500,
    durationDays: 30,
    billingLabel: '4,500 PKR / Month',
  },
  annual: {
    id: 'annual' as const,
    name: 'Annual Pro Full Version',
    nameUr: 'سالانہ پرو فل ورژن',
    pricePkr: 35000,
    durationDays: 365,
    billingLabel: '35,000 PKR / Year',
    savingsLabel: 'Save 19,000 PKR vs Monthly',
  },
} as const;

export const FREE_TIER_LIMITS = {
  maxInventoryItems: 25,
  maxSalesInvoices: 15,
} as const;

export const PRO_FEATURE_DESCRIPTIONS: Record<ProFeatureKey, string> = {
  custom_branding: 'Change Company Name, Logo, Address & Invoice Branding',
  daily_movement_report: 'Daily Stock Movement Report (Quantities & Page/Grand Totals)',
  daily_amount_report: 'Daily Amount Wise Stock Report (In-Hand Valuation)',
  profit_report: 'Profit & Margin Analytics Report',
  export_reports: 'Export PDF & Excel (.xlsx) Multi-Page Reports',
  unlimited_inventory: 'Add more than 25 Inventory SKUs (Unlimited Catalog)',
  unlimited_sales: 'Create more than 15 Sales Invoices (Unlimited Billing)',
  multi_user_access: 'Multi-User Staff Roles & Permissions Manager',
};

const KEY_SALT = 'AQSA-MEZN-PK54-9874519-NA-GEMS';

function computeTag(payload: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const full = `${payload}|${KEY_SALT}`;
  for (let i = 0; i < full.length; i++) {
    const c = full.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + ((i + 1) * 31);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const partA = (h1 >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  const partB = (h2 >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  return `${partA}${partB}`;
}

export function generateSignedLicenseKey(
  identifier: string,
  plan: 'monthly' | 'annual',
  expiresAtIso: string
): string {
  const planCode = plan === 'annual' ? 'Y' : 'M';
  const yyyymmdd = expiresAtIso.slice(0, 10).replace(/-/g, '');
  const idSlug = (identifier || 'USER')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10)
    .toUpperCase() || 'USER';
  const body = `${planCode}-${yyyymmdd}-${idSlug}`;
  const sig = computeTag(body).slice(0, 8);
  return `AQSA-${body}-${sig}`;
}

export function verifySignedLicenseKey(rawKey: string): {
  valid: boolean;
  plan?: 'monthly' | 'annual';
  expiresAtIso?: string;
  reason?: string;
} {
  const cleaned = rawKey.trim().toUpperCase();
  const match = cleaned.match(/^AQSA-([MY])-(\d{8})-([A-Z0-9]+)-([A-Z0-9]{8})$/);
  if (!match) {
    return { valid: false, reason: 'Invalid license key format (expected AQSA-M/Y-YYYYMMDD-ID-SIGNATURE).' };
  }
  const [, planCode, dateDigits, idSlug, providedSig] = match;
  const body = `${planCode}-${dateDigits}-${idSlug}`;
  const expectedSig = computeTag(body).slice(0, 8);
  if (providedSig !== expectedSig) {
    return { valid: false, reason: 'License key signature check failed.' };
  }
  const expiresAtIso = `${dateDigits.slice(0, 4)}-${dateDigits.slice(4, 6)}-${dateDigits.slice(6, 8)}T23:59:59.999Z`;
  if (new Date(expiresAtIso).getTime() < Date.now()) {
    return { valid: false, reason: 'This license key has expired. Please renew your plan.' };
  }
  return {
    valid: true,
    plan: planCode === 'Y' ? 'annual' : 'monthly',
    expiresAtIso,
  };
}

export function isSubscriptionActive(sub: UserSubscription | null): boolean {
  if (!sub) return false;
  if (sub.status !== 'active') return false;
  if (sub.plan === 'owner') return true;
  if (!sub.expiresAtIso) return false;
  return new Date(sub.expiresAtIso).getTime() >= Date.now();
}

import { UiLanguage } from '../types/business';

/**
 * Simple bilingual helper returning English or clean English + Urdu text
 * based on active UI language preference.
 */
export function bi(en: string, ur: string, lang: UiLanguage): string {
  return lang === 'ur_en' ? `${en} / ${ur}` : en;
}

export const MODULE_URDU_LABELS: Record<string, string> = {
  dashboard: 'ڈیش بورڈ',
  inventory: 'اسٹاک / انوینٹری',
  categories: 'کیٹیگریز، ذیلی اقسام اور یونٹس',
  sales: 'سیلز اور بل',
  parties: 'گاہک اور سپلائرز',
  scanner: 'کیو آر اسکینر',
  purchases: 'خریداری',
  returns: 'واپسی اور نقصان',
  payments: 'ادائیگیاں اور کھاتہ',
  reminders: 'خودکار یاددہانی',
  reports: 'رپورٹس اور پی ڈی ایف',
  users: 'صارفین',
  subscription: 'سبسکرپشن اور ادائیگی',
  settings: 'سیٹنگز اور اے پی کے',
};

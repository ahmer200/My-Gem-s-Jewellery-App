import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Crown,
  Lock,
  LogOut,
  ShieldCheck,
  Smartphone,
  Unlock,
  XCircle,
} from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { bi } from '../utils/bilingual';
import { ADMIN_EMAIL, PAYMENT_ACCOUNT_DETAILS, SUBSCRIPTION_PLANS } from '../utils/seedData';

export const SubscriptionView: React.FC = () => {
  const {
    profile,
    subscription,
    paymentRequests,
    isOwnerAccount,
    isAdminAccount,
    isProUnlocked,
    previewFreeMode,
    setPreviewFreeMode,
    daysUntilExpiry,
    isExpiringSoon,
    uiLanguage,
    firebaseUser,
    cloudSignIn,
    cloudSignOut,
    submitSubscriptionPayment,
    adminApprovePaymentRequest,
    adminRejectPaymentRequest,
    setActiveModule,
    notify,
  } = useBusiness();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'EasyPaisa' | 'Meezan Bank IBFT / Raast'>(
    'EasyPaisa'
  );
  const [transactionId, setTransactionId] = useState('');
  const [senderAccount, setSenderAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const copyText = async (label: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedField(label);
      notify(`${label} copied: ${val}`, 'info');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      notify(`Copy manually: ${val}`, 'info');
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId.trim()) {
      notify('Please enter your Transaction ID (TID).', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await submitSubscriptionPayment({
        planType: selectedPlan,
        paymentMethod,
        transactionId,
        senderAccount,
      });
      setTransactionId('');
      setSenderAccount('');
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = isOwnerAccount
    ? isProUnlocked
      ? 'OWNER MASTER PRO UNLOCKED'
      : 'FREE PREVIEW MODE'
    : subscription.status === 'active'
      ? isProUnlocked
        ? 'ACTIVE PRO VERSION'
        : 'FREE PREVIEW MODE'
      : subscription.status === 'pending_verification'
        ? 'PENDING ADMIN VERIFICATION'
        : subscription.status === 'expired'
          ? 'SUBSCRIPTION EXPIRED'
          : subscription.status === 'rejected'
            ? 'PAYMENT VERIFICATION REJECTED'
            : 'FREE / BASIC VERSION';

  const statusTextColor = isProUnlocked
    ? 'text-emerald-700 dark:text-emerald-400'
    : subscription.status === 'pending_verification'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-rose-700 dark:text-rose-400';

  const freeFeatures = [
    { label: 'Change Company Name', allowed: true, note: 'Unlocked in Profile Settings' },
    { label: 'Limited Stock Report Preview', allowed: true, note: 'Basic preview (no advanced exports)' },
    { label: 'View Inventory List & Auto-SKU Lookup', allowed: true, note: 'Standard viewing' },
    { label: 'Stock Photo Upload (Camera + Gallery)', allowed: false, note: 'Locked in Basic' },
    { label: 'Complete Daily Stock Movement Report', allowed: false, note: 'Locked in Basic' },
    { label: 'Daily Amount Wise Stock Report', allowed: false, note: 'Locked in Basic' },
    { label: 'Full Category / Sub-Category / Item Unit Management', allowed: false, note: 'Locked in Basic' },
    { label: 'Complete Invoice Functions (Create, Print, PDF, Dispatch)', allowed: false, note: 'Locked in Basic' },
  ];

  const proFeatures = [
    'All Free / Basic features + Unlimited Company Profile customization',
    'Direct Camera Photo Capture & Gallery Upload for every stock item',
    'Full Category, Sub-Category & Custom Item Unit Add / Edit / Delete',
    'Complete Daily Stock Movement Report (Quantities, Page Sums & Grand Totals + PDF)',
    'Complete Daily Amount Wise Stock Report (Original Cost & In-Hand Stock Grand Total + PDF)',
    'Complete Invoicing (Create, Edit, Dispatch Lock, Print & A4 PDF Export)',
    'Cloud Real-Time Sync across Web & Android APK + Automatic Expiry Alerts',
  ];

  return (
    <div className="space-y-6">
      {/* Subscription Status & Expiry Reminder Header */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <h1 className="font-display text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                {bi(
                  'AQSA BMS Subscription, Payment Details & Feature Comparison',
                  'اقصیٰ بزنس مینجمنٹ سسٹم — سبسکرپشن اور ادائیگی',
                  uiLanguage
                )}
              </h1>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Company: <strong className="text-slate-900 dark:text-white">{profile.companyName}</strong>
              {' · '}
              Current Status: <strong className={`font-mono ${statusTextColor}`}>{statusLabel}</strong>
              {!isOwnerAccount && subscription.plan !== 'free' && (
                <>
                  {' · '}
                  Plan: <strong className="font-mono uppercase">{subscription.plan}</strong>
                </>
              )}
              {!isOwnerAccount && subscription.startDate && (
                <>
                  {' · '}
                  Start: <strong className="font-mono tabular-nums">{subscription.startDate}</strong>
                </>
              )}
              {!isOwnerAccount && subscription.expiryDate && (
                <>
                  {' · '}
                  Expiry: <strong className="font-mono tabular-nums">{subscription.expiryDate}</strong>
                  {daysUntilExpiry !== null && (
                    <span> ({daysUntilExpiry >= 0 ? `${daysUntilExpiry}d left` : 'Expired'})</span>
                  )}
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            {isOwnerAccount && (
              <button
                type="button"
                onClick={() => setPreviewFreeMode(!previewFreeMode)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {previewFreeMode ? (
                  <>
                    <Unlock className="w-4 h-4 text-emerald-600" />
                    Restore Owner Pro View
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-amber-600" />
                    Preview Free Basic Locks
                  </>
                )}
              </button>
            )}
            {firebaseUser ? (
              <button
                type="button"
                onClick={cloudSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out ({firebaseUser.email})
              </button>
            ) : (
              <button
                type="button"
                onClick={cloudSignIn}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white"
              >
                <Cloud className="w-4 h-4" />
                Owner / User Google Sign-In
              </button>
            )}
          </div>
        </div>

        {/* Owner-Only Auto-Unlock & Access Notice */}
        <div
          className={`mt-4 rounded-lg border p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs ${
            isOwnerAccount
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {isOwnerAccount ? (
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              {isOwnerAccount ? (
                <span>
                  <strong>Owner Master Access Active ({ADMIN_EMAIL}):</strong> Full Pro modules &amp; Admin payment verification are unlocked exclusively for your account. Other visitors &amp; external installs stay locked on Free / Basic.
                </span>
              ) : firebaseUser ? (
                <span>
                  <strong>Signed in as {firebaseUser.email}:</strong> Automatic Pro unlock is restricted to the owner (<span className="font-mono">{ADMIN_EMAIL}</span>). Other accounts remain on <strong>Free / Basic</strong> until payment is verified by Admin.
                </span>
              ) : (
                <span>
                  <strong>Owner-Only Auto-Unlock:</strong> Are you the owner? Sign in with Google (<span className="font-mono">{ADMIN_EMAIL}</span>) to unlock everything automatically. All other users remain on <strong>Free / Basic</strong> unless paid and verified.
                </span>
              )}
            </div>
          </div>
        </div>

        {(isExpiringSoon || subscription.status === 'expired') && (
          <div className="mt-4 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-3.5 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong>
                {subscription.status === 'expired'
                  ? 'Subscription Expired Reminder:'
                  : 'Subscription Expiry Reminder:'}
              </strong>{' '}
              {subscription.status === 'expired'
                ? 'Your paid plan has expired and advanced modules are locked back to Free Basic. Submit a new EasyPaisa or Meezan Bank payment TID below to renew.'
                : `Your Pro plan expires in ${daysUntilExpiry} day(s) on ${subscription.expiryDate}. Renew early via EasyPaisa or Meezan Bank to avoid interruption.`}
            </div>
          </div>
        )}
      </div>

      {/* Paid Subscription Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['monthly', 'yearly'] as const).map((planKey) => {
          const plan = SUBSCRIPTION_PLANS[planKey];
          const isSelected = selectedPlan === planKey;
          return (
            <button
              key={planKey}
              type="button"
              onClick={() => setSelectedPlan(planKey)}
              className={`text-left rounded-xl p-5 border transition-colors ${
                isSelected
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-700 dark:border-emerald-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    {bi(plan.name, plan.nameUr, uiLanguage)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {plan.durationDays} days full Pro access · All modules &amp; PDF reports unlocked
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {plan.billingLabel}
                  </p>
                  {planKey === 'yearly' && (
                    <p className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
                      Save 19,000 PKR / Year
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Free/Basic vs Full Paid Comparison Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                {bi('Free / Basic Version Limitations', 'مفت / بنیادی ورژن کی حدود', uiLanguage)}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                What stays open vs what is locked until payment verification
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('settings')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
            >
              Edit Company Name →
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {freeFeatures.map((item) => (
              <div key={item.label} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {item.allowed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span
                    className={
                      item.allowed
                        ? 'font-semibold text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }
                  >
                    {item.label}
                  </span>
                </div>
                <span
                  className={`font-mono text-[11px] whitespace-nowrap shrink-0 ${
                    item.allowed
                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {item.note}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 p-5 space-y-3">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="font-display text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-600" />
              {bi('Full Paid Version Unlocked Features', 'مکمل پیڈ ورژن کی تمام سہولیات', uiLanguage)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automatically unlocks all modules &amp; reports after Admin verifies payment
            </p>
          </div>
          <div className="space-y-2.5 pt-1">
            {proFeatures.map((feat) => (
              <div key={feat} className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200">
                <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Account Details + Transaction ID Verification Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Official Payment Details */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {bi('Official Subscription Payment Accounts', 'ادائیگی کے اکاؤنٹس (ایزی پیسہ / میزان بینک)', uiLanguage)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Send {SUBSCRIPTION_PLANS[selectedPlan].billingLabel} via EasyPaisa or Meezan Bank IBFT / Raast, then enter your Transaction ID on the right.
            </p>
          </div>

          {/* EasyPaisa Card */}
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-900 dark:text-emerald-300">
                <Smartphone className="w-4 h-4" />
                EasyPaisa Account
              </div>
              <button
                type="button"
                onClick={() => copyText('EasyPaisa Number', PAYMENT_ACCOUNT_DETAILS.easyPaisaNumber)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:underline"
              >
                <Copy className="w-3 h-3" />
                {copiedField === 'EasyPaisa Number' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-600 dark:text-slate-400">EasyPaisa Number:</span>
              <span className="font-mono text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                {PAYMENT_ACCOUNT_DETAILS.easyPaisaNumber}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Account Title:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {PAYMENT_ACCOUNT_DETAILS.accountTitle}
              </span>
            </div>
          </div>

          {/* Meezan Bank Card */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white pb-1 border-b border-slate-200 dark:border-slate-800">
              <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              Meezan Bank Details (IBFT / Raast)
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Account Title:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {PAYMENT_ACCOUNT_DETAILS.accountTitle}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Account Number:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {PAYMENT_ACCOUNT_DETAILS.accountNumber}
                </span>
                <button
                  type="button"
                  onClick={() => copyText('Account Number', PAYMENT_ACCOUNT_DETAILS.accountNumber)}
                  className="text-emerald-700 dark:text-emerald-400 hover:underline text-[11px]"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">IBAN:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {PAYMENT_ACCOUNT_DETAILS.iban}
                </span>
                <button
                  type="button"
                  onClick={() => copyText('IBAN', PAYMENT_ACCOUNT_DETAILS.iban)}
                  className="text-emerald-700 dark:text-emerald-400 hover:underline text-[11px]"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Branch:</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {PAYMENT_ACCOUNT_DETAILS.branch}
              </span>
            </div>
          </div>
        </div>

        {/* Submit Transaction ID Form */}
        <form
          onSubmit={handleSubmitPayment}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {bi('Submit Transaction ID for Verification', 'ادائیگی کی تصدیق (ٹرانزیکشن آئی ڈی درج کریں)', uiLanguage)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              After sending payment via EasyPaisa or Meezan Bank IBFT/Raast, submit your TID below.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subscription Plan *
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value as 'monthly' | 'yearly')}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 min-h-[38px]"
              >
                <option value="monthly">Monthly Plan — 4500 PKR / Month</option>
                <option value="yearly">Yearly Plan — 35000 PKR / Year</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Channel *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as 'EasyPaisa' | 'Meezan Bank IBFT / Raast')
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 min-h-[38px]"
              >
                <option value="EasyPaisa">EasyPaisa (03320001602)</option>
                <option value="Meezan Bank IBFT / Raast">Meezan Bank IBFT / Raast</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Transaction ID (TID / Reference Number) *
            </label>
            <input
              required
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g. EP-984512304 or RAAST-77819204"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono font-semibold min-h-[38px]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sender Mobile / Bank Account Number
            </label>
            <input
              value={senderAccount}
              onChange={(e) => setSenderAccount(e.target.value)}
              placeholder="e.g. 0300-XXXXXXX or Sender Bank Title"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono min-h-[38px]"
            />
          </div>

          {!firebaseUser && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-amber-950 dark:text-amber-200 font-medium">
                Sign in with Google first to submit a Transaction ID to Admin verification.
              </span>
              <button
                type="button"
                onClick={cloudSignIn}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 hover:bg-amber-700 px-3 py-1.5 font-semibold text-white"
              >
                <Cloud className="w-3.5 h-3.5" />
                Sign In with Google
              </button>
            </div>
          )}

          <div className="pt-1 flex items-center justify-between gap-3">
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
              Payable: {SUBSCRIPTION_PLANS[selectedPlan].billingLabel}
            </span>
            <button
              type="submit"
              disabled={submitting || !firebaseUser}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-60 min-h-[40px]"
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Submit TID for Activation'}
            </button>
          </div>
        </form>
      </div>

      {/* Admin Payment Verification Panel */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              {bi('Admin Payment Verification Console', 'ایڈمن پیمنٹ تصدیق پینل', uiLanguage)} ({paymentRequests.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verify incoming EasyPaisa (03320001602) or Meezan Bank IBFT/Raast transfers to auto-unlock the user&apos;s full Pro version.
            </p>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            Role: {isAdminAccount ? `Owner Admin Enabled (${ADMIN_EMAIL})` : `Locked — Requires Owner Google Sign-In (${ADMIN_EMAIL})`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Submitted</th>
                <th className="py-3 px-4 font-semibold">User / Company</th>
                <th className="py-3 px-4 font-semibold">Plan &amp; Amount</th>
                <th className="py-3 px-4 font-semibold">Method &amp; TID</th>
                <th className="py-3 px-4 font-semibold">Sender</th>
                <th className="py-3 px-4 font-semibold">Status &amp; Validity</th>
                {isAdminAccount && <th className="py-3 px-4 font-semibold text-right">Verify / Reject</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {paymentRequests.length === 0 ? (
                <tr>
                  <td colSpan={isAdminAccount ? 7 : 6} className="py-10 text-center text-slate-500">
                    No subscription payment requests submitted yet. Submit a Transaction ID above to test verification.
                  </td>
                </tr>
              ) : (
                paymentRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono whitespace-nowrap">{req.submittedDate}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{req.userName || 'Merchant User'}</p>
                      <p className="text-[11px] text-slate-500">
                        {req.companyName} {req.userEmail ? `· ${req.userEmail}` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      <span className="uppercase font-semibold">{req.planType}</span>
                      {' · '}
                      <strong className="text-emerald-700 dark:text-emerald-400">
                        {req.amountPkr.toLocaleString()} PKR
                      </strong>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{req.paymentMethod}</p>
                      <p className="font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                        TID: {req.transactionId}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {req.senderAccount || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-mono font-bold uppercase ${
                          req.status === 'verified'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : req.status === 'rejected'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {req.status}
                      </span>
                      {req.expiryDate && (
                        <p className="font-mono text-[11px] text-slate-500">
                          {req.startDate} → {req.expiryDate}
                        </p>
                      )}
                      {req.adminNote && (
                        <p className="text-[11px] text-slate-500 max-w-[200px] truncate">
                          {req.adminNote}
                        </p>
                      )}
                    </td>
                    {isAdminAccount && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {req.status === 'pending' ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              value={adminNotes[req.id] || ''}
                              onChange={(e) =>
                                setAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                              }
                              placeholder="Optional note"
                              className="w-28 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                adminApprovePaymentRequest(req.id, adminNotes[req.id])
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Verify &amp; Activate
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                adminRejectPaymentRequest(req.id, adminNotes[req.id])
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-rose-300 dark:border-rose-800 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-400">Processed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

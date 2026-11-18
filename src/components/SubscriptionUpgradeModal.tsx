import React, { useState } from 'react';
import {
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  ImagePlus,
  KeyRound,
  Lock,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { compressImageFileToDataUrl } from '../utils/localDb';
import {
  MEEZAN_BANK_DETAILS,
  PRO_FEATURE_DESCRIPTIONS,
  SUBSCRIPTION_PLANS,
} from '../utils/subscription';
import { ProFeatureKey } from '../types/business';

export const SubscriptionUpgradeModal: React.FC = () => {
  const {
    upgradeModalOpen,
    upgradeReason,
    closeUpgradeModal,
    isProUnlocked,
    isOwnerAccount,
    subscription,
    mySubscriptionRequests,
    firebaseUser,
    cloudSignIn,
    profile,
    submitMeezanPaymentRequest,
    activateLicenseKey,
    notify,
  } = useBusiness();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [companyName, setCompanyName] = useState(
    profile.companyName !== "N.A GEM'S" ? profile.companyName : ''
  );
  const [transactionId, setTransactionId] = useState('');
  const [senderAccountTitle, setSenderAccountTitle] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [licenseInput, setLicenseInput] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!upgradeModalOpen) return null;

  const activePlanSpec = SUBSCRIPTION_PLANS[selectedPlan];

  const handleCopy = (label: string, val: string) => {
    void navigator.clipboard?.writeText(val);
    setCopiedField(label);
    notify(`Copied ${label}: ${val}`);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleReceiptPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setReceiptUrl(compressed);
      notify('Payment slip screenshot attached.');
    } catch {
      notify('Could not process payment receipt image.', 'error');
    }
    e.target.value = '';
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      notify('Enter your Company / Business Name to license.', 'error');
      return;
    }
    if (!transactionId.trim()) {
      notify('Enter your Meezan Bank Transaction ID / TID reference.', 'error');
      return;
    }
    setSubmitting(true);
    const ok = await submitMeezanPaymentRequest({
      requestedCompanyName: companyName.trim(),
      plan: selectedPlan,
      transactionId: transactionId.trim(),
      senderAccountTitle: senderAccountTitle.trim() || companyName.trim(),
      senderPhone: senderPhone.trim(),
      receiptImageUrl: receiptUrl,
    });
    setSubmitting(false);
    if (ok) {
      setTransactionId('');
      setReceiptUrl(undefined);
    }
  };

  const handleWhatsAppConfirm = () => {
    const ownerWa = (profile.whatsapp || '923008989777').replace(/[^0-9]/g, '');
    const msg = [
      'Assalam-o-Alaikum Ahmer Iqbal,',
      `I have transferred *PKR ${activePlanSpec.pricePkr.toLocaleString()}* (${activePlanSpec.billingLabel}) to Meezan Bank (${MEEZAN_BANK_DETAILS.accountNumber}) for *Aqsa Business Management System Pro*.`,
      `• Company: ${companyName || 'My Business'}`,
      `• Email/Account: ${firebaseUser?.email || 'Not signed in'}`,
      `• TID / Reference: ${transactionId || 'Attached'}`,
      'Please approve my Pro subscription.',
    ].join('\n');
    const url = `https://wa.me/${ownerWa}?text=${encodeURIComponent(msg)}`;
    window.location.href = url;
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold truncate">
                Aqsa Business Management System — Pro Full Version
              </h2>
              <p className="text-xs text-emerald-300 truncate">
                Custom Company Name Branding · Full Daily Reports · Multi-Device Sync (4,500 PKR/mo | 35,000 PKR/yr)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeUpgradeModal}
            className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto text-xs">
          {upgradeReason && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 flex items-start gap-2.5 text-amber-950 dark:text-amber-200">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Pro Full Version Required</p>
                <p>{upgradeReason}</p>
              </div>
            </div>
          )}

          {isProUnlocked && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                <div>
                  <p className="font-bold">
                    {isOwnerAccount ? 'Master Owner Account (Unlimited Lifetime Pro)' : 'Pro Full Version Active'}
                  </p>
                  {subscription?.expiresAtIso && !isOwnerAccount && (
                    <p className="text-[11px] font-mono">
                      Expires: {subscription.expiresAtIso.slice(0, 10)} · Key: {subscription.licenseKey}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Plan Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSelectedPlan('monthly')}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                selectedPlan === 'monthly'
                  ? 'border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Monthly Pro Plan
                </span>
                {selectedPlan === 'monthly' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                )}
              </div>
              <p className="mt-2 font-mono text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
                4,500 PKR <span className="text-xs font-normal text-slate-500">/ Month</span>
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                30-day Full Version unlock across Web & Android APK.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPlan('annual')}
              className={`text-left p-4 rounded-xl border-2 transition-all relative ${
                selectedPlan === 'annual'
                  ? 'border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Yearly Pro Plan (Best Value)
                </span>
                <span className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-400">
                  SAVE 19,000 PKR
                </span>
              </div>
              <p className="mt-2 font-mono text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
                35,000 PKR <span className="text-xs font-normal text-slate-500">/ Year</span>
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                365-day Full Version with priority cloud sync & all updates.
              </p>
            </button>
          </div>

          {/* Meezan Bank Direct Account Box + Feature Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Meezan Bank Details */}
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/25 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <h3 className="font-display font-bold text-sm text-emerald-950 dark:text-emerald-200">
                    Pay First Into Meezan Bank Account
                  </h3>
                </div>
                <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
                  {activePlanSpec.pricePkr.toLocaleString()} PKR
                </span>
              </div>

              <div className="space-y-2 font-mono text-[11.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Bank:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{MEEZAN_BANK_DETAILS.bankName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Account Title:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{MEEZAN_BANK_DETAILS.accountTitle}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Account No:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300">
                      {MEEZAN_BANK_DETAILS.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('Account No', MEEZAN_BANK_DETAILS.accountNumber)}
                      className="p-1 rounded border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100"
                    >
                      {copiedField === 'Account No' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">IBAN:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300">
                      {MEEZAN_BANK_DETAILS.iban}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('IBAN', MEEZAN_BANK_DETAILS.iban)}
                      className="p-1 rounded border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100"
                    >
                      {copiedField === 'IBAN' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Branch:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{MEEZAN_BANK_DETAILS.branch}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                Transfer <strong>{activePlanSpec.billingLabel}</strong> via Meezan App / IBFT / Raast, then submit your TID & slip below. Your Full Version unlocks automatically in real time as soon as payment is verified.
              </p>
            </div>

            {/* Locked vs Unlocked Features */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2.5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  What Unlocks in Pro Full Version
                </h3>
              </div>
              <ul className="space-y-1.5 text-[11.5px] text-slate-700 dark:text-slate-300">
                {(Object.keys(PRO_FEATURE_DESCRIPTIONS) as ProFeatureKey[]).map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{PRO_FEATURE_DESCRIPTIONS[key]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Payment Submission Form */}
          <form
            onSubmit={handleSubmitProof}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                Step 2: Submit Meezan Bank Payment Proof for Instant Cloud Unlock
              </h3>
              {!firebaseUser && (
                <button
                  type="button"
                  onClick={cloudSignIn}
                  className="rounded-lg bg-slate-900 dark:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Sign In with Google First
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Your Company Name *
                </label>
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Royal Gems Trading"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Transaction ID / TID *
                </label>
                <input
                  required
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Meezan TID / Raast Ref"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Sender Account Title
                </label>
                <input
                  value={senderAccountTitle}
                  onChange={(e) => setSenderAccountTitle(e.target.value)}
                  placeholder="Name on bank account"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  WhatsApp / Mobile
                </label>
                <input
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="03XX-XXXXXXX"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {receiptUrl && (
                  <img
                    src={receiptUrl}
                    alt="Payment Slip"
                    className="w-10 h-10 rounded object-cover border border-emerald-400"
                  />
                )}
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 px-3 py-2 font-semibold cursor-pointer">
                  <Camera className="w-3.5 h-3.5" />
                  Capture Slip
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleReceiptPick}
                    className="hidden"
                  />
                </label>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-semibold cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5" />
                  Upload Receipt Screenshot
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptPick}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleWhatsAppConfirm}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3.5 py-2 font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <MessageCircle className="w-4 h-4" />
                  Notify Owner on WhatsApp
                </button>
                <button
                  type="submit"
                  disabled={submitting || !firebaseUser}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Submitting...' : `Submit ${activePlanSpec.pricePkr.toLocaleString()} PKR Payment`}
                </button>
              </div>
            </div>
          </form>

          {/* My Submitted Payment Requests (Live Status) */}
          {mySubscriptionRequests.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
              <p className="font-display font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Your Recent Payment Requests
              </p>
              <div className="space-y-1.5">
                {mySubscriptionRequests.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px]"
                  >
                    <span>
                      {r.requestedCompanyName} · {r.amountPkr.toLocaleString()} PKR · TID: {r.transactionId}
                    </span>
                    <span
                      className={`font-bold ${
                        r.status === 'approved'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : r.status === 'rejected'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                      }`}
                    >
                      {r.status.toUpperCase()}
                      {r.adminNote ? ` — ${r.adminNote}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* License Key Offline/Online Activation */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <KeyRound className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Have an Activation Key?
              </span>
            </div>
            <input
              value={licenseInput}
              onChange={(e) => setLicenseInput(e.target.value)}
              placeholder="AQSA-M-YYYYMMDD-USER-XXXXXXXX"
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono"
            />
            <button
              type="button"
              onClick={() => {
                if (activateLicenseKey(licenseInput)) {
                  setLicenseInput('');
                }
              }}
              className="rounded-lg bg-slate-900 dark:bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-slate-800 shrink-0"
            >
              Activate Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

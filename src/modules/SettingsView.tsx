import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  Crown,
  Download,
  LogOut,
  RefreshCw,
  RotateCcw,
  Save,
  Smartphone,
  Upload,
} from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { useAppUpdater } from '../hooks/useAppUpdater';
import { ADMIN_EMAIL, DEFAULT_LOGO_PATH } from '../utils/seedData';
import { WorldCurrencySelect } from '../components/WorldCurrencySelect';
import { getRateForCurrency } from '../utils/currency';

export const SettingsView: React.FC = () => {
  const {
    profile,
    updateProfile,
    hasPermission,
    isOwnerAccount,
    isProUnlocked,
    subscription,
    setActiveModule,
    firebaseUser,
    isSyncing,
    lastSyncedAt,
    autoSyncEnabled,
    setAutoSyncEnabled,
    liveSyncActive,
    pendingOfflineSync,
    cloudSignIn,
    cloudSignOut,
    syncNowToCloud,
    pullFromCloudBackup,
    exportBackupJson,
    importBackupJson,
    resetDemoData,
    notify,
  } = useBusiness();

  const {
    currentBuildId,
    hasUpdate,
    latestBuildId,
    checking,
    checkNow,
    applyUpdate,
  } = useAppUpdater();

  const isNativeApk = Boolean(window.AqsaAndroidBridge?.isNativeAndroid?.());
  const [liveAppUrl, setLiveAppUrl] = useState<string>(
    () => window.AqsaAndroidBridge?.getLiveAppUrl?.() || 'https://ais-pre-oz3gvlqu3ye6zgyi457vij-605316800459.asia-east1.run.app'
  );
  const [apkLiveEnabled, setApkLiveEnabled] = useState<boolean>(
    () => window.AqsaAndroidBridge?.isLiveSyncEnabled?.() ?? true
  );

  const canEdit = hasPermission('edit_rates_profile');
  const [form, setForm] = useState(profile);
  const [tab, setTab] = useState<'profile' | 'sync' | 'android'>('profile');

  useEffect(() => {
    setForm(profile);
  }, [profile]);

  const activeCurrency = form.defaultCurrency || 'CNY';
  const activeCurrencyRate =
    activeCurrency === 'PKR' ? 1 : getRateForCurrency(activeCurrency, form);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(form);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, logoDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRestoreJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        importBackupJson(reader.result);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Company Profile, Cloud Sync & Android APK Setup
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aqsa Business Management System — N.A GEM'S configuration, Firebase backup, and APK build instructions
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 self-start">
          <button
            onClick={() => setTab('profile')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              tab === 'profile'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Business Profile & FX
          </button>
          <button
            onClick={() => setTab('sync')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              tab === 'sync'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Cloud Sync & Backup
          </button>
          <button
            onClick={() => setTab('android')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              tab === 'android'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Android APK Guide
          </button>
        </div>
      </div>

      {tab === 'profile' && (
        <form
          onSubmit={handleSave}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 text-xs"
        >
          <div className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            {form.logoDataUrl ? (
              <img
                src={form.logoDataUrl}
                alt="Company Logo"
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-emerald-700" />
              </div>
            )}
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-900 dark:text-white">Company Logo</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  disabled={!canEdit}
                  onChange={handleLogoUpload}
                  className="text-xs text-slate-500"
                />
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setForm({ ...form, logoDataUrl: DEFAULT_LOGO_PATH })}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Restore N.A GEM'S Crest
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="flex items-center gap-2 text-xs">
              <Crown className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-white">
                {isOwnerAccount && isProUnlocked
                  ? `Owner Master Pro Unlocked (${ADMIN_EMAIL})`
                  : isProUnlocked
                    ? `Full Pro Plan Active (${subscription.plan.toUpperCase()} · Expires ${subscription.expiryDate || '—'})`
                    : 'Free / Basic Plan — Company Name editing is always unlocked'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('subscription')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
            >
              {isProUnlocked ? 'Manage Subscription →' : 'Upgrade to Pro (4500 PKR/mo) →'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company Name <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400">(Unlocked on Free &amp; Pro)</span>
              </label>
              <input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Merchant Subtitle / Proprietor
              </label>
              <input
                disabled={!canEdit}
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Showroom / Office Address
              </label>
              <input
                disabled={!canEdit}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Contact Phone
              </label>
              <input
                disabled={!canEdit}
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                WhatsApp Number (International digits)
              </label>
              <input
                disabled={!canEdit}
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                disabled={!canEdit}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                NTN / Tax Registration
              </label>
              <input
                disabled={!canEdit}
                value={form.ntn}
                onChange={(e) => setForm({ ...form, ntn: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
          </div>

          {/* World Currency Selection, Conversion Rate & Custom Percentage Markup */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Default World Currency
                </label>
                <WorldCurrencySelect
                  value={activeCurrency}
                  disabled={!canEdit}
                  onChange={(code) => {
                    const nextRate =
                      code === 'PKR' ? 1 : getRateForCurrency(code, form);
                    setForm((prev) => ({
                      ...prev,
                      defaultCurrency: code,
                      currencyRates: {
                        ...(prev.currencyRates || {}),
                        [code]: nextRate,
                      },
                    }));
                  }}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  {activeCurrency} → PKR Rate (0 = Keep in {activeCurrency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!canEdit || activeCurrency === 'PKR'}
                  value={activeCurrency === 'PKR' ? 1 : activeCurrencyRate}
                  onChange={(e) => {
                    const nextVal = Math.max(0, Number(e.target.value) || 0);
                    setForm((prev) => {
                      const nextRates = {
                        ...(prev.currencyRates || {}),
                        [activeCurrency]: nextVal,
                      };
                      if (activeCurrency === 'CNY') nextRates.RMB = nextVal;
                      return {
                        ...prev,
                        currencyRates: nextRates,
                        ...(activeCurrency === 'CNY' ? { rmbToPkr: nextVal } : {}),
                        ...(activeCurrency === 'USD' ? { usdToPkr: nextVal } : {}),
                      };
                    });
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-sm font-bold disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Custom Percentage Markup (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={!canEdit}
                  value={form.defaultMarkupPercent}
                  onChange={(e) =>
                    setForm({ ...form, defaultMarkupPercent: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-sm font-bold"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Select any world currency from the searchable scroll list and set its PKR conversion rate. Setting the conversion rate to <strong className="font-mono">0</strong> keeps invoice and item amounts in the selected currency instead of converting to PKR.
            </p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Invoice Footer Note
            </label>
            <input
              disabled={!canEdit}
              value={form.invoiceFooter}
              onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              <Save className="w-4 h-4" />
              {canEdit ? 'Save Business Profile & Rates' : 'Save Company Name'}
            </button>
          </div>
        </form>
      )}

      {tab === 'sync' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {/* Firebase Real-Time Cloud Sync */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Automatic Real-Time Cloud Sync (Firestore)
                </h2>
              </div>
              {firebaseUser && liveSyncActive && autoSyncEnabled && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Live
                </span>
              )}
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Every sale, dispatch lock, inventory edit, payment, or customer/vendor update syncs automatically in real time across all installed Android APKs and web browsers signed into the same Google account. Offline edits auto-sync once internet returns.
            </p>

            <label className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Auto-Sync All Changes Across Devices
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Automatically push local edits & stream live updates from other devices
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                className="w-4 h-4 accent-emerald-700"
              />
            </label>

            {firebaseUser ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Connected: {firebaseUser.email}
                  </p>
                  {lastSyncedAt && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                      Last synced at {lastSyncedAt}
                      {pendingOfflineSync ? ' (Pending offline changes queued)' : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={isSyncing}
                    onClick={syncNowToCloud}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 min-h-[40px]"
                  >
                    <CloudUpload className="w-4 h-4" />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button
                    disabled={isSyncing}
                    onClick={pullFromCloudBackup}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
                  >
                    <CloudDownload className="w-4 h-4" />
                    Pull Latest
                  </button>
                  <button
                    onClick={cloudSignOut}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900 px-3 py-2 font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 min-h-[40px]"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={cloudSignIn}
                className="flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-slate-800 min-h-[42px]"
              >
                <Cloud className="w-4 h-4" />
                Sign In with Google for Real-Time Sync
              </button>
            )}
          </div>

          {/* Automatic Web & APK App Updates */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Web & APK Automatic App Updates
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Web browsers and installed PWAs auto-check for new builds every minute. Installed Android APKs configured with a Live Web URL automatically fetch new screens and features on launch without reinstalling the APK.
            </p>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Current Build: <span className="font-mono">{currentBuildId}</span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {hasUpdate
                    ? `New build ready (${latestBuildId || 'update available'})`
                    : 'Running latest available build'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={checking}
                  onClick={async () => {
                    const res = await checkNow();
                    if (res.hasUpdate) {
                      notify('A new app update is ready to apply.', 'info');
                    } else {
                      notify('You are already on the latest version.', 'success');
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                  {checking ? 'Checking...' : 'Check Updates'}
                </button>
                {hasUpdate && (
                  <button
                    type="button"
                    onClick={applyUpdate}
                    className="rounded-lg bg-emerald-700 px-3 py-2 font-semibold text-white hover:bg-emerald-800"
                  >
                    Apply Update
                  </button>
                )}
              </div>
            </div>

            {isNativeApk && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Android Live Web Update Mode
                  </span>
                  <input
                    type="checkbox"
                    checked={apkLiveEnabled}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setApkLiveEnabled(next);
                      window.AqsaAndroidBridge?.setLiveSyncEnabled?.(next);
                    }}
                    className="w-4 h-4 accent-emerald-700"
                  />
                </div>
                <input
                  type="url"
                  value={liveAppUrl}
                  onChange={(e) => setLiveAppUrl(e.target.value)}
                  placeholder="https://your-hosted-aqsa-bms-url"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    window.AqsaAndroidBridge?.setLiveAppUrl?.(liveAppUrl);
                    window.AqsaAndroidBridge?.reloadApp?.();
                    notify('Saved Live App URL & reloading...');
                  }}
                  className="rounded-lg bg-slate-900 dark:bg-emerald-700 px-3.5 py-2 font-semibold text-white hover:bg-slate-800"
                >
                  Save Live URL & Reload APK
                </button>
              </div>
            )}
          </div>

          {/* Local JSON Backup & Restore */}
          <div className="lg:col-span-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Offline Local Backup & Restore
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Export your complete database (inventory, sales, purchases, returns, payments, customers/vendors, staff) as a single JSON file or restore from an existing backup.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={exportBackupJson}
                className="flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-800 min-h-[40px]"
              >
                <Download className="w-4 h-4" />
                Download Backup (.json)
              </button>
              <label className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]">
                <Upload className="w-4 h-4" />
                Restore Backup (.json)
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleRestoreJson}
                  className="hidden"
                />
              </label>
              <button
                onClick={resetDemoData}
                className="flex items-center gap-2 rounded-lg border border-amber-300 dark:border-amber-800 px-4 py-2 font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 min-h-[40px]"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Sample Data
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'android' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 text-xs leading-relaxed">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Smartphone className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Android Native APK, Automatic OTA Updates, Firebase & Keystore Guide
            </h2>
          </div>

          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-1.5">
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
              How Automatic Updates Work Across All Installed APKs & Web App:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-emerald-800 dark:text-emerald-300">
              <li>
                <strong>Live Business Data:</strong> Firebase Firestore real-time listeners sync every invoice, inventory edit, payment, rate, and party update across all APKs and web browsers within ~1 second.
              </li>
              <li>
                <strong>Live App UI & Feature Updates:</strong> On launch, <code className="font-mono">MainActivity.kt</code> checks <code className="font-mono">live_app_url/version.json</code>. Whenever you publish an updated web build (e.g. Firebase Hosting or public Shared URL), every installed APK automatically loads the latest web version, falling back seamlessly to offline <code className="font-mono">assets/www/</code> when offline.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-slate-900 dark:text-white">
              Included Native Android Files in <code className="font-mono">/android</code>:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
              <li>android/build.gradle.kts & android/settings.gradle.kts</li>
              <li>android/app/build.gradle.kts (Package: com.nagem.aqsa, Firebase BOM + Print + Camera)</li>
              <li>android/app/src/main/res/values/strings.xml (Default live_app_url for automatic APK OTA updates)</li>
              <li>android/app/src/main/AndroidManifest.xml (Camera, Internet, FileProvider)</li>
              <li>android/app/src/main/java/com/nagem/aqsa/MainActivity.kt (Live Web Sync + Offline Fallback + Print & Auth Bridge)</li>
              <li>android/app/google-services.json (Pre-populated with fourth-xyston-lfx4d)</li>
              <li>android/KEYSTORE_AND_APK_GUIDE.md (Full signing & release checklist)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-slate-900 dark:text-white">
              Step-by-Step Terminal Commands to Build Signed Release APK:
            </p>
            <pre className="p-4 rounded-lg bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto">
{`# 1. Build responsive web bundle & copy into Android offline fallback assets
npm run build:android

# 2. (Optional) Set your permanent public hosting URL in:
#    android/app/src/main/res/values/strings.xml -> live_app_url

# 3. Generate Release Keystore (one-time)
keytool -genkey -v -keystore android/app/aqsa-release.jks \\
  -alias aqsa_bms_key -keyalg RSA -keysize 2048 -validity 10000

# 4. Build Debug APK (instant testing on Android phone)
cd android && ./gradlew assembleDebug

# 5. Build Signed Release APK (for distribution)
cd android && ./gradlew assembleRelease`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

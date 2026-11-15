import React, { useState } from 'react';
import {
  Building2,
  Cloud,
  CloudDownload,
  CloudUpload,
  Download,
  LogOut,
  RotateCcw,
  Save,
  Smartphone,
  Upload,
} from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { DEFAULT_LOGO_PATH } from '../utils/seedData';

export const SettingsView: React.FC = () => {
  const {
    profile,
    updateProfile,
    hasPermission,
    firebaseUser,
    isSyncing,
    lastSyncedAt,
    cloudSignIn,
    cloudSignOut,
    syncNowToCloud,
    pullFromCloudBackup,
    exportBackupJson,
    importBackupJson,
    resetDemoData,
  } = useBusiness();

  const canEdit = hasPermission('edit_rates_profile');
  const [form, setForm] = useState(profile);
  const [tab, setTab] = useState<'profile' | 'sync' | 'android'>('profile');

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company Name
              </label>
              <input
                disabled={!canEdit}
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

          {/* Exchange Rates & Custom Percentage Markup */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Default RMB → PKR Rate
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!canEdit}
                value={form.rmbToPkr}
                onChange={(e) => setForm({ ...form, rmbToPkr: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-sm font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Default USD → PKR Rate
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!canEdit}
                value={form.usdToPkr}
                onChange={(e) => setForm({ ...form, usdToPkr: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-sm font-bold"
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

          {canEdit && (
            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                <Save className="w-4 h-4" />
                Save Business Profile & Rates
              </button>
            </div>
          )}
        </form>
      )}

      {tab === 'sync' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {/* Firebase Cloud Sync */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Firebase Cloud Sync (Firestore)
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              All business records are automatically saved locally on your device for instant offline speed. Sign in with Google to synchronize your N.A GEM'S workspace with Firebase Cloud Firestore across Android, tablet, and laptop.
            </p>

            {firebaseUser ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Connected: {firebaseUser.email}
                  </p>
                  {lastSyncedAt && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                      Last synced at {lastSyncedAt}
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
                    {isSyncing ? 'Syncing...' : 'Push Local Data to Cloud'}
                  </button>
                  <button
                    disabled={isSyncing}
                    onClick={pullFromCloudBackup}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
                  >
                    <CloudDownload className="w-4 h-4" />
                    Pull from Cloud
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
                Sign In with Google for Cloud Sync
              </button>
            )}
          </div>

          {/* Local JSON Backup & Restore */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Offline Local Backup & Restore
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Export your complete database (inventory, sales, purchases, returns, payments, staff) as a single JSON file or restore from an existing backup.
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
              Android Native APK, Gradle, Firebase & Keystore Build Guide
            </h2>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-slate-900 dark:text-white">
              Included Native Android Files in <code className="font-mono">/android</code>:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
              <li>android/build.gradle.kts & android/settings.gradle.kts</li>
              <li>android/app/build.gradle.kts (Package: com.nagem.aqsa, Firebase BOM + Print + Camera)</li>
              <li>android/app/src/main/AndroidManifest.xml (Camera, Internet, FileProvider)</li>
              <li>android/app/src/main/java/com/nagem/aqsa/MainActivity.kt (WebViewAssetLoader + Native Print & Camera Bridge)</li>
              <li>android/app/google-services.json (Pre-populated with fourth-xyston-lfx4d)</li>
              <li>android/KEYSTORE_AND_APK_GUIDE.md (Full signing & release checklist)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-slate-900 dark:text-white">
              Step-by-Step Terminal Commands to Build Signed Release APK:
            </p>
            <pre className="p-4 rounded-lg bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto">
{`# 1. Build responsive web bundle & copy into Android assets
npm run build
mkdir -p android/app/src/main/assets/www
cp -r dist/* android/app/src/main/assets/www/

# 2. Generate Release Keystore (one-time)
keytool -genkey -v -keystore android/app/aqsa-release.jks \\
  -alias aqsa_bms_key -keyalg RSA -keysize 2048 -validity 10000

# 3. Build Debug APK (instant testing on Android phone)
cd android && ./gradlew assembleDebug

# 4. Build Signed Release APK (for distribution)
cd android && ./gradlew assembleRelease`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

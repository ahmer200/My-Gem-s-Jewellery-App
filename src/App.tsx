import React, { useState } from 'react';
import {
  BarChart3,
  BellRing,
  Cloud,
  Contact,
  Gem,
  LayoutDashboard,
  Menu,
  Moon,
  QrCode,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingBag,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { BusinessProvider, useBusiness } from './context/BusinessContext';
import { ModuleId } from './types/business';
import { DashboardView } from './modules/DashboardView';
import { InventoryView } from './modules/InventoryView';
import { PurchasesView } from './modules/PurchasesView';
import { SalesView } from './modules/SalesView';
import { PartiesView } from './modules/PartiesView';
import { ScannerView } from './modules/ScannerView';
import { ReturnsView } from './modules/ReturnsView';
import { PaymentsView } from './modules/PaymentsView';
import { RemindersView } from './modules/RemindersView';
import { ReportsView } from './modules/ReportsView';
import { UsersView } from './modules/UsersView';
import { SettingsView } from './modules/SettingsView';
import { AppUpdateBanner, OfflineIndicator, PWAInstallButton } from './components/PWAControls';
import { getRateForCurrency } from './utils/currency';
import { normalizeCurrencyCode } from './utils/worldCurrencies';

const NAV_ITEMS: { id: ModuleId; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory (22-Col)', shortLabel: 'Stock', icon: Gem },
  { id: 'sales', label: 'Sales & Invoices', shortLabel: 'Sales', icon: Receipt },
  { id: 'parties', label: 'Customers & Vendors', shortLabel: 'Parties', icon: Contact },
  { id: 'scanner', label: 'QR / Barcode Scan', shortLabel: 'Scan', icon: QrCode },
  { id: 'purchases', label: 'Purchases', shortLabel: 'Buy', icon: ShoppingBag },
  { id: 'returns', label: 'Returns & Refunds', shortLabel: 'Returns', icon: RotateCcw },
  { id: 'payments', label: 'Payments & Dues', shortLabel: 'Cash', icon: Wallet },
  { id: 'reminders', label: 'Auto Reminders', shortLabel: 'Remind', icon: BellRing },
  { id: 'reports', label: 'Reports & Export', shortLabel: 'Reports', icon: BarChart3 },
  { id: 'users', label: 'Multi-User Access', shortLabel: 'Users', icon: Users },
  { id: 'settings', label: 'Profile, Sync & APK', shortLabel: 'Setup', icon: Settings },
];

const AppShell: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    profile,
    activeOperator,
    theme,
    toggleTheme,
    toasts,
    firebaseUser,
    isSyncing,
    liveSyncActive,
    syncNowToCloud,
    cloudSignIn,
  } = useBusiness();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeNav = NAV_ITEMS.find((n) => n.id === activeModule) || NAV_ITEMS[0];
  const activeCurrencyCode = normalizeCurrencyCode(profile.defaultCurrency || 'CNY');
  const activeCurrencyRate = getRateForCurrency(activeCurrencyCode, profile);
  const activeRateDisplay =
    activeCurrencyCode === 'PKR'
      ? '1 PKR'
      : activeCurrencyRate === 0
        ? '0 (Own Cur)'
        : `${activeCurrencyRate} PKR`;

  const handleSelectModule = (id: ModuleId) => {
    setActiveModule(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-900 text-slate-100 border-r border-slate-800 z-30">
        <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-3">
          {profile.logoDataUrl ? (
            <img
              src={profile.logoDataUrl}
              alt={profile.companyName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-lg object-cover border border-amber-500/40 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-emerald-800 flex items-center justify-center shrink-0">
              <Gem className="w-5 h-5 text-amber-300" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-white leading-tight truncate">
              Aqsa Business
            </p>
            <p className="text-[11px] text-emerald-300 truncate">
              Management System
            </p>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              {profile.companyName}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectModule(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>Operator:</span>
            <span className="font-semibold text-white truncate max-w-[130px]">
              {activeOperator.name}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono">
            <span>{activeCurrencyCode} → PKR:</span>
            <span className="text-emerald-300">{activeRateDisplay}</span>
          </div>
        </div>
      </aside>

      {/* Tablet / Mobile Slide-Out Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 text-slate-100 h-full flex flex-col shadow-2xl z-10">
            <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-display text-sm font-bold text-white truncate">
                  Aqsa Business Management System
                </p>
                <p className="text-[11px] text-emerald-300 truncate">
                  {profile.companyName}
                </p>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectModule(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-xs font-medium min-h-[44px] ${
                      active
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (Single Row, Clean 3-Zone Contract) */}
        <header className="no-print sticky top-0 z-20 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display text-sm md:text-base font-bold text-slate-900 dark:text-white truncate">
              {activeNav.label}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <span>
              {activeCurrencyCode}→PKR: {activeCurrencyRate === 0 ? '0 (Own Currency)' : activeCurrencyRate}
            </span>
            <span aria-hidden="true">·</span>
            <span>Markup: {profile.defaultMarkupPercent}%</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              onClick={firebaseUser ? syncNowToCloud : cloudSignIn}
              disabled={isSyncing}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap min-h-[38px]"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              {isSyncing
                ? 'Syncing...'
                : firebaseUser
                  ? liveSyncActive
                    ? 'Auto-Sync Live'
                    : 'Sync Cloud'
                  : 'Cloud Sync'}
            </button>
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[38px] min-w-[38px] flex items-center justify-center"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 md:p-6 pb-24 lg:pb-8 max-w-[1600px] w-full mx-auto">
          {activeModule === 'dashboard' && <DashboardView />}
          {activeModule === 'inventory' && <InventoryView />}
          {activeModule === 'purchases' && <PurchasesView />}
          {activeModule === 'sales' && <SalesView />}
          {activeModule === 'parties' && <PartiesView />}
          {activeModule === 'scanner' && <ScannerView />}
          {activeModule === 'returns' && <ReturnsView />}
          {activeModule === 'payments' && <PaymentsView />}
          {activeModule === 'reminders' && <RemindersView />}
          {activeModule === 'reports' && <ReportsView />}
          {activeModule === 'users' && <UsersView />}
          {activeModule === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Thumb Zone, <= 15% Viewport Height) */}
      <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-safe">
        <div className="grid grid-cols-5 h-14 items-center">
          {(
            [
              { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
              { id: 'inventory', label: 'Stock', icon: Gem },
              { id: 'sales', label: 'Sales', icon: Receipt },
              { id: 'scanner', label: 'Scan', icon: QrCode },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectModule(tab.id)}
                className={`flex flex-col items-center justify-center h-full min-h-[44px] ${
                  active
                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center h-full min-h-[44px] text-slate-500 dark:text-slate-400"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">All</span>
          </button>
        </div>
      </nav>

      {/* Toast Stack */}
      <div className="no-print fixed top-16 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg text-xs font-medium shadow-lg border ${
              t.tone === 'error'
                ? 'bg-rose-600 text-white border-rose-700'
                : t.tone === 'info'
                  ? 'bg-slate-900 text-white border-slate-700'
                  : 'bg-emerald-700 text-white border-emerald-800'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      <OfflineIndicator />
      <AppUpdateBanner />
    </div>
  );
};

export default function App() {
  return (
    <BusinessProvider>
      <AppShell />
    </BusinessProvider>
  );
}

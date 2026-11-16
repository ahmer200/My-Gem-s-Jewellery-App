import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Edit3,
  FileSpreadsheet,
  Gem,
  Lock,
  Printer,
  QrCode,
  Receipt,
  Save,
  ShoppingBag,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { computeItemFinalPkr, formatMoney, getRateForCurrency } from '../utils/currency';
import { InvoiceModal } from '../components/InvoiceModal';
import { DeleteActionButton } from '../components/DeleteActionButton';
import { DispatchConfirmModal } from '../components/DispatchConfirmModal';
import { ItemVelocityChart } from '../components/ItemVelocityChart';
import { WorldCurrencySelect } from '../components/WorldCurrencySelect';
import { SalesOrder } from '../types/business';

export const DashboardView: React.FC = () => {
  const {
    profile,
    inventory,
    sales,
    purchases,
    updateProfile,
    dispatchSale,
    openSaleForEdit,
    deleteSale,
    setActiveModule,
    hasPermission,
  } = useBusiness();

  const [selectedCurrency, setSelectedCurrency] = useState<string>(profile.defaultCurrency || 'CNY');
  const [rateInput, setRateInput] = useState<string>(
    String(getRateForCurrency(profile.defaultCurrency || 'CNY', profile))
  );
  const [markupInput, setMarkupInput] = useState(String(profile.defaultMarkupPercent));
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);
  const [dispatchTarget, setDispatchTarget] = useState<SalesOrder | null>(null);

  useEffect(() => {
    const cur = profile.defaultCurrency || 'CNY';
    setSelectedCurrency(cur);
    setRateInput(String(getRateForCurrency(cur, profile)));
    setMarkupInput(String(profile.defaultMarkupPercent));
  }, [profile]);

  const canEditRates = hasPermission('edit_rates_profile');
  const canViewProfit = hasPermission('view_profit');
  const canDeleteSales = hasPermission('create_sales');

  const totalStockValuePkr = inventory.reduce((sum, item) => {
    const { finalPkr } = computeItemFinalPkr(
      item.baseSellPrice,
      item.sellCurrency,
      profile,
      item.sellExchangeRate
    );
    return sum + finalPkr * item.stockQty;
  }, 0);

  const totalPieces = inventory.reduce((sum, item) => sum + item.stockQty, 0);
  const totalSalesPkr = sales.reduce((sum, s) => sum + s.finalTotalPkrEquivalent, 0);
  const totalProfitPkr = sales.reduce((sum, s) => sum + s.profitPkr, 0);
  const pendingCustomerDuesPkr = sales.reduce(
    (sum, s) => sum + Math.max(0, s.finalTotalPkrEquivalent - s.paidAmountPkr),
    0
  );
  const lowStockItems = inventory.filter((i) => i.stockQty <= i.minStockAlert);

  const handleCurrencyChange = (nextCode: string) => {
    setSelectedCurrency(nextCode);
    setRateInput(nextCode === 'PKR' ? '1' : String(getRateForCurrency(nextCode, profile)));
  };

  const handleSaveRates = (e: React.FormEvent) => {
    e.preventDefault();
    const numericRate = selectedCurrency === 'PKR' ? 1 : Math.max(0, Number(rateInput) || 0);
    const nextRates = {
      ...(profile.currencyRates || {}),
      [selectedCurrency]: numericRate,
    };
    if (selectedCurrency === 'CNY') nextRates.RMB = numericRate;
    updateProfile({
      defaultCurrency: selectedCurrency,
      currencyRates: nextRates,
      ...(selectedCurrency === 'CNY' ? { rmbToPkr: numericRate } : {}),
      ...(selectedCurrency === 'USD' ? { usdToPkr: numericRate } : {}),
      defaultMarkupPercent: Math.max(0, Number(markupInput) || 0),
    });
  };

  return (
    <div className="space-y-6">
      {/* Merchant Welcome Header + Live FX Strip */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {profile.logoDataUrl && (
              <img
                src={profile.logoDataUrl}
                alt={profile.companyName}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            )}
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {profile.companyName}
              </h1>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                {profile.subtitle} · {inventory.length} SKUs ({totalPieces} pcs in stock)
              </p>
            </div>
          </div>

          {/* Quick Live World Currency & Markup Controls */}
          <form
            onSubmit={handleSaveRates}
            className="flex flex-wrap items-end gap-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800"
          >
            <div className="w-52">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                World Currency
              </label>
              <WorldCurrencySelect
                value={selectedCurrency}
                onChange={handleCurrencyChange}
                disabled={!canEditRates}
                ariaLabel="Select trade currency"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                {selectedCurrency} → PKR (0 = Own Cur)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!canEditRates || selectedCurrency === 'PKR'}
                value={selectedCurrency === 'PKR' ? '1' : rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="w-28 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 font-mono text-sm text-slate-900 dark:text-white disabled:opacity-60 min-h-[38px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Markup %
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                disabled={!canEditRates}
                value={markupInput}
                onChange={(e) => setMarkupInput(e.target.value)}
                className="w-20 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 font-mono text-sm text-slate-900 dark:text-white disabled:opacity-60 min-h-[38px]"
              />
            </div>
            {canEditRates && (
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
              >
                <Save className="w-3.5 h-3.5" />
                Update Rate
              </button>
            )}
          </form>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Stock Retail Valuation</span>
            <Gem className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {formatMoney(totalStockValuePkr, 'PKR')}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Includes {profile.defaultMarkupPercent}% markup · {totalPieces} pieces
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Total Sales (PKR Eqv.)</span>
            <Receipt className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {formatMoney(totalSalesPkr, 'PKR')}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {sales.length} invoices · {purchases.length} purchases
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Net Sales Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {canViewProfit ? formatMoney(totalProfitPkr, 'PKR') : 'Restricted'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {canViewProfit ? 'After landed purchase costs' : 'Admin permission required'}
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Pending Customer Dues</span>
            <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
            {formatMoney(pendingCustomerDuesPkr, 'PKR')}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {sales.filter((s) => s.paymentStatus !== 'Paid').length} open invoices
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { id: 'sales', label: 'New Invoice', icon: Receipt },
          { id: 'scanner', label: 'Scan QR / Barcode', icon: QrCode },
          { id: 'inventory', label: '22-Col Inventory', icon: Gem },
          { id: 'purchases', label: 'Record Purchase', icon: ShoppingBag },
          { id: 'payments', label: 'Payments & Dues', icon: Wallet },
          { id: 'reports', label: 'Excel / PDF Reports', icon: FileSpreadsheet },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => setActiveModule(action.id as typeof action.id & Parameters<typeof setActiveModule>[0])}
              className="flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3.5 text-left hover:border-emerald-600 dark:hover:border-emerald-500 transition-colors min-h-[48px]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {action.label}
                </span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Recent Sales & Low Stock Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Recent Sales Invoices
            </h2>
            <button
              onClick={() => setActiveModule('sales')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
            >
              Open Sales & Orders
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-medium">Invoice</th>
                  <th className="py-3 px-4 font-medium">Customer</th>
                  <th className="py-3 px-4 font-medium">Currency / Rate</th>
                  <th className="py-3 px-4 font-medium text-right">Final Total</th>
                  <th className="py-3 px-4 font-medium">Payment</th>
                  <th className="py-3 px-4 font-medium">Dispatch</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sales.slice(0, 6).map((sale) => {
                  const isDispatched = sale.dispatchStatus === 'Dispatched';
                  return (
                    <tr
                      key={sale.id}
                      onClick={() => setPreviewOrder(sale)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {sale.invoiceNo}
                      </td>
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">
                        {sale.customerName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {sale.sourceCurrency} ·{' '}
                        {sale.sourceCurrency !== 'PKR' && sale.exchangeRateApplied === 0
                          ? 'Rate=0 (Orig)'
                          : `@${sale.exchangeRateApplied}`}{' '}
                        · {sale.markupPercentUsed}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatMoney(sale.finalTotal, sale.finalCurrency)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            sale.paymentStatus === 'Paid'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {sale.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        {isDispatched ? (
                          <span
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400"
                            title={`Arrives: ${sale.expectedArrivalDate || '—'}`}
                          >
                            <Lock className="w-3 h-3" />
                            Dispatched
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            Pending
                          </span>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          {canDeleteSales && !isDispatched && (
                            <>
                              <button
                                type="button"
                                onClick={() => openSaleForEdit(sale.id)}
                                title={`Edit invoice ${sale.invoiceNo}`}
                                className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDispatchTarget(sale)}
                                title={`Dispatch ${sale.invoiceNo}`}
                                className="p-1.5 rounded-md text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              >
                                <Truck className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setPreviewOrder(sale)}
                            title="Open Invoice Preview"
                            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {canDeleteSales && (
                            <DeleteActionButton
                              onConfirm={() => deleteSale(sale.id)}
                              title={`Delete invoice ${sale.invoiceNo}`}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Low Stock Watchlist
            </h2>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {lowStockItems.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">All gemstone items are above alert thresholds.</p>
            ) : (
              lowStockItems.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      {item.sku} · {item.certLab} {item.certNumber}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                      {item.stockQty} left
                    </p>
                    <p className="text-[11px] text-slate-500">Min: {item.minStockAlert}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Fast-Moving & Slow-Moving Items Chart */}
      <ItemVelocityChart />

      {previewOrder && (
        <InvoiceModal order={previewOrder} onClose={() => setPreviewOrder(null)} />
      )}

      {dispatchTarget && (
        <DispatchConfirmModal
          order={dispatchTarget}
          onClose={() => setDispatchTarget(null)}
          onConfirm={(arrivalDate) => {
            dispatchSale(dispatchTarget.id, arrivalDate);
            setDispatchTarget(null);
          }}
        />
      )}
    </div>
  );
};

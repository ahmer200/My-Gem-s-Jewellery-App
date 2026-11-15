import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { CurrencyCode } from '../types/business';
import { formatMoney, getRateForCurrency } from '../utils/currency';

export const ReturnsView: React.FC = () => {
  const { sales, inventory, returns, profile, addReturn, hasPermission, notify } = useBusiness();
  const canProcess = hasPermission('process_returns');

  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState(sales[0]?.invoiceNo || '');
  const [customerName, setCustomerName] = useState(sales[0]?.customerName || '');
  const [selectedInvId, setSelectedInvId] = useState(inventory[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('Customer exchange / sizing adjustment');
  const [restocked, setRestocked] = useState(true);
  const [refundCurrency, setRefundCurrency] = useState<CurrencyCode>('PKR');
  const [refundAmountOrig, setRefundAmountOrig] = useState<number>(0);
  const [customRate, setCustomRate] = useState<string>('1');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));

  const handleInvoiceSelect = (invNo: string) => {
    setSelectedInvoiceNo(invNo);
    const sale = sales.find((s) => s.invoiceNo === invNo);
    if (sale) {
      setCustomerName(sale.customerName);
      setRefundCurrency(sale.finalCurrency);
      const rate =
        sale.finalCurrency === 'PKR'
          ? 1
          : sale.exchangeRateApplied > 0
            ? sale.exchangeRateApplied
            : getRateForCurrency(sale.finalCurrency, profile.rmbToPkr, profile.usdToPkr);
      setCustomRate(String(rate));
      setRefundAmountOrig(sale.finalTotal);
      if (sale.items[0]) {
        setSelectedInvId(sale.items[0].inventoryId);
      }
    }
  };

  const handleCurrencyChange = (cur: CurrencyCode) => {
    setRefundCurrency(cur);
    const rate = getRateForCurrency(cur, profile.rmbToPkr, profile.usdToPkr);
    setCustomRate(String(rate));
  };

  const activeRate = refundCurrency === 'PKR' ? 1 : Math.max(0, Number(customRate) || 0);
  const refundAmountPkr = useMemo(
    () => (refundCurrency === 'PKR' ? refundAmountOrig : refundAmountOrig * activeRate),
    [refundCurrency, refundAmountOrig, activeRate]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProcess) {
      notify('Permission required to process returns.', 'error');
      return;
    }
    const item = inventory.find((i) => i.id === selectedInvId);
    if (!item) return;

    addReturn({
      returnNo: `RET-2026-${String(returns.length + 1).padStart(3, '0')}`,
      invoiceNo: selectedInvoiceNo || 'DIRECT-RET',
      customerName: customerName.trim() || 'Walk-in Customer',
      inventoryId: item.id,
      sku: item.sku,
      productName: item.name,
      quantity,
      reason,
      restocked,
      refundCurrency,
      exchangeRateApplied: activeRate,
      refundAmountOrig,
      refundAmountPkr,
      returnDate,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Returns & Currency Refund Management
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Process gemstone or jewelry returns, adjust vault stock, and convert refund amounts across RMB / USD / PKR
        </p>
      </div>

      {canProcess && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <RotateCcw className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Record Product Return
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Linked Sales Invoice
              </label>
              <select
                value={selectedInvoiceNo}
                onChange={(e) => handleInvoiceSelect(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              >
                <option value="">Standalone Return</option>
                {sales.map((s) => (
                  <option key={s.id} value={s.invoiceNo}>
                    {s.invoiceNo} — {s.customerName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Customer Name
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Returned Gemstone / Item
              </label>
              <select
                value={selectedInvId}
                onChange={(e) => setSelectedInvId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.sku} — {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Return Date
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Refund Currency
              </label>
              <select
                value={refundCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              >
                <option value="PKR">PKR</option>
                <option value="RMB">RMB</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Exchange Rate → PKR
              </label>
              <input
                type="number"
                step="0.01"
                disabled={refundCurrency === 'PKR'}
                value={refundCurrency === 'PKR' ? '1' : customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Refund Amount ({refundCurrency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={refundAmountOrig}
                onChange={(e) => setRefundAmountOrig(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                PKR Refund Equivalent
              </label>
              <div className="w-full rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 font-mono font-bold text-amber-800 dark:text-amber-300">
                {formatMoney(refundAmountPkr, 'PKR')}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex flex-1 items-center gap-4">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Return reason..."
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
              <label className="inline-flex items-center gap-2 whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={restocked}
                  onChange={(e) => setRestocked(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700"
                />
                <span>Restock to Inventory</span>
              </label>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap min-h-[40px]"
            >
              Process Return & Adjust Stock
            </button>
          </div>
        </form>
      )}

      {/* Return History */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Return History ({returns.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Return No</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Invoice / Customer</th>
                <th className="py-3 px-4 font-semibold">Product</th>
                <th className="py-3 px-4 font-semibold">Reason</th>
                <th className="py-3 px-4 font-semibold">Restocked</th>
                <th className="py-3 px-4 font-semibold text-right">Refund (Orig.)</th>
                <th className="py-3 px-4 font-semibold text-right">Refund (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {returns.map((ret) => (
                <tr key={ret.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    {ret.returnNo}
                  </td>
                  <td className="py-3 px-4 font-mono">{ret.returnDate}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-900 dark:text-white">{ret.customerName}</p>
                    <p className="font-mono text-[11px] text-slate-500">{ret.invoiceNo}</p>
                  </td>
                  <td className="py-3 px-4">
                    {ret.sku} · {ret.productName} (×{ret.quantity})
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{ret.reason}</td>
                  <td className="py-3 px-4 font-semibold">
                    {ret.restocked ? 'Yes (+Stock)' : 'No'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatMoney(ret.refundAmountOrig, ret.refundCurrency)} (@{ret.exchangeRateApplied})
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                    {formatMoney(ret.refundAmountPkr, 'PKR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

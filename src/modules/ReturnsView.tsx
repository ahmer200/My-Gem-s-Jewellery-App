import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { CurrencyCode, ReturnLineItem } from '../types/business';
import { convertToPkr, formatMoney, getRateForCurrency } from '../utils/currency';
import { DeleteActionButton } from '../components/DeleteActionButton';

function convertAmountBetween(
  amount: number,
  fromCur: CurrencyCode,
  toCur: CurrencyCode,
  rmbRate: number,
  usdRate: number
): number {
  if (fromCur === toCur) return Number(amount.toFixed(2));
  const pkr = convertToPkr(amount, fromCur, rmbRate || 1, usdRate || 1);
  if (toCur === 'PKR') return Number(pkr.toFixed(2));
  const targetRate = toCur === 'RMB' ? rmbRate || 1 : usdRate || 1;
  return Number((targetRate > 0 ? pkr / targetRate : pkr).toFixed(2));
}

export const ReturnsView: React.FC = () => {
  const {
    sales,
    inventory,
    returns,
    profile,
    addReturn,
    deleteReturn,
    hasPermission,
    notify,
  } = useBusiness();
  const canProcess = hasPermission('process_returns');

  const initialSale = sales[0];
  const initialCurrency: CurrencyCode = initialSale?.finalCurrency || 'PKR';
  const initialRate =
    initialCurrency === 'PKR'
      ? 1
      : initialSale && initialSale.exchangeRateApplied > 0
        ? initialSale.exchangeRateApplied
        : getRateForCurrency(initialCurrency, profile.rmbToPkr, profile.usdToPkr);

  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState(initialSale?.invoiceNo || '');
  const [customerName, setCustomerName] = useState(initialSale?.customerName || '');
  const [selectedInvId, setSelectedInvId] = useState(inventory[0]?.id || '');
  const [returnItems, setReturnItems] = useState<ReturnLineItem[]>(() => {
    if (initialSale && initialSale.items.length > 0) {
      return initialSale.items.map((item) => {
        const unitInFinal = convertAmountBetween(
          item.unitPriceOrig,
          initialSale.sourceCurrency,
          initialSale.finalCurrency,
          initialSale.rmbRateUsed || profile.rmbToPkr,
          initialSale.usdRateUsed || profile.usdToPkr
        );
        return {
          inventoryId: item.inventoryId,
          sku: item.sku,
          productName: item.productName,
          quantity: item.quantity,
          unitPriceOrig: unitInFinal,
          percentAdjustment:
            typeof item.markupPercent === 'number'
              ? item.markupPercent
              : initialSale.markupPercentUsed,
        };
      });
    }
    if (inventory[0]) {
      return [
        {
          inventoryId: inventory[0].id,
          sku: inventory[0].sku,
          productName: inventory[0].name,
          quantity: 1,
          unitPriceOrig: convertAmountBetween(
            inventory[0].baseSellPrice,
            inventory[0].sellCurrency,
            'PKR',
            profile.rmbToPkr,
            profile.usdToPkr
          ),
          percentAdjustment: profile.defaultMarkupPercent,
        },
      ];
    }
    return [];
  });

  const [reason, setReason] = useState('Customer exchange / sizing adjustment');
  const [restocked, setRestocked] = useState(true);
  const [refundCurrency, setRefundCurrency] = useState<CurrencyCode>(initialCurrency);
  const [customRate, setCustomRate] = useState<string>(String(initialRate));
  const [manualTotalOverride, setManualTotalOverride] = useState<number | null>(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));

  const computedItemsTotalOrig = useMemo(() => {
    return returnItems.reduce((sum, ri) => {
      const line =
        Math.max(0, ri.quantity) *
        Math.max(0, ri.unitPriceOrig) *
        (1 + (Number(ri.percentAdjustment) || 0) / 100);
      return sum + Math.max(0, line);
    }, 0);
  }, [returnItems]);

  const refundAmountOrig =
    manualTotalOverride !== null ? manualTotalOverride : Number(computedItemsTotalOrig.toFixed(2));

  useEffect(() => {
    setManualTotalOverride(null);
  }, [returnItems, refundCurrency]);

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
      setManualTotalOverride(null);

      if (sale.items.length > 0) {
        setReturnItems(
          sale.items.map((item) => {
            const unitInFinal = convertAmountBetween(
              item.unitPriceOrig,
              sale.sourceCurrency,
              sale.finalCurrency,
              sale.rmbRateUsed || profile.rmbToPkr,
              sale.usdRateUsed || profile.usdToPkr
            );
            return {
              inventoryId: item.inventoryId,
              sku: item.sku,
              productName: item.productName,
              quantity: item.quantity,
              unitPriceOrig: unitInFinal,
              percentAdjustment:
                typeof item.markupPercent === 'number'
                  ? item.markupPercent
                  : sale.markupPercentUsed,
            };
          })
        );
        setSelectedInvId(sale.items[0].inventoryId);
      }
    }
  };

  const handleCurrencyChange = (cur: CurrencyCode) => {
    const oldCur = refundCurrency;
    const oldRate = oldCur === 'PKR' ? 1 : Number(customRate) || getRateForCurrency(oldCur, profile.rmbToPkr, profile.usdToPkr);
    const nextRate = getRateForCurrency(cur, profile.rmbToPkr, profile.usdToPkr);
    const rmbForConv = oldCur === 'RMB' ? oldRate : cur === 'RMB' ? nextRate : profile.rmbToPkr;
    const usdForConv = oldCur === 'USD' ? oldRate : cur === 'USD' ? nextRate : profile.usdToPkr;

    setReturnItems((prev) =>
      prev.map((ri) => ({
        ...ri,
        unitPriceOrig: convertAmountBetween(
          ri.unitPriceOrig,
          oldCur,
          cur,
          rmbForConv,
          usdForConv
        ),
      }))
    );
    setRefundCurrency(cur);
    setCustomRate(String(nextRate));
    setManualTotalOverride(null);
  };

  const handleAddReturnItem = () => {
    const item = inventory.find((i) => i.id === selectedInvId);
    if (!item) return;

    const unitOrig = convertAmountBetween(
      item.baseSellPrice,
      item.sellCurrency,
      refundCurrency,
      refundCurrency === 'RMB' ? Number(customRate) || profile.rmbToPkr : profile.rmbToPkr,
      refundCurrency === 'USD' ? Number(customRate) || profile.usdToPkr : profile.usdToPkr
    );

    setReturnItems((prev) => {
      const existing = prev.find((r) => r.inventoryId === item.id);
      if (existing) {
        return prev.map((r) =>
          r.inventoryId === item.id ? { ...r, quantity: r.quantity + 1 } : r
        );
      }
      return [
        ...prev,
        {
          inventoryId: item.id,
          sku: item.sku,
          productName: item.name,
          quantity: 1,
          unitPriceOrig: unitOrig,
          percentAdjustment: profile.defaultMarkupPercent,
        },
      ];
    });
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
    if (returnItems.length === 0) {
      notify('Please add at least one returned gemstone / item.', 'error');
      return;
    }

    const totalQty = returnItems.reduce((sum, ri) => sum + Math.max(1, ri.quantity), 0);
    const primary = returnItems[0];
    const summaryName =
      returnItems.length > 1
        ? `${primary.productName} (+${returnItems.length - 1} more)`
        : primary.productName;

    addReturn({
      returnNo: `RET-2026-${String(returns.length + 1).padStart(3, '0')}`,
      invoiceNo: selectedInvoiceNo || 'DIRECT-RET',
      customerName: customerName.trim() || 'Walk-in Customer',
      inventoryId: primary.inventoryId,
      sku: primary.sku,
      productName: summaryName,
      quantity: totalQty,
      reason,
      restocked,
      refundCurrency,
      exchangeRateApplied: activeRate,
      refundAmountOrig,
      refundAmountPkr,
      items: returnItems,
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
          Process gemstone or jewelry returns with per-item percentage adjustments (+markup / -restocking %), vault restocking, and RMB / USD / PKR conversion
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
                Refund Currency
              </label>
              <select
                value={refundCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono font-semibold"
              >
                <option value="PKR">PKR</option>
                <option value="RMB">RMB</option>
                <option value="USD">USD</option>
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

          {/* Add Returned Item Picker */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedInvId}
              onChange={(e) => setSelectedInvId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            >
              {inventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} — {i.name} ({i.baseSellPrice} {i.sellCurrency})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddReturnItem}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-800 whitespace-nowrap min-h-[38px]"
            >
              <Plus className="w-4 h-4" />
              Add Return Item
            </button>
          </div>

          {/* Per-Item Return Rows with Individual Percentage */}
          {returnItems.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Returned Item</th>
                    <th className="py-2.5 px-3 w-20">Qty</th>
                    <th className="py-2.5 px-3 w-32">Unit Price ({refundCurrency})</th>
                    <th className="py-2.5 px-3 w-32">Item % (+ / -)</th>
                    <th className="py-2.5 px-3 text-right">Line Refund ({refundCurrency})</th>
                    <th className="py-2.5 px-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {returnItems.map((ri, idx) => {
                    const lineTotal = Math.max(
                      0,
                      ri.quantity * ri.unitPriceOrig * (1 + (Number(ri.percentAdjustment) || 0) / 100)
                    );
                    return (
                      <tr key={`${ri.sku}-${idx}`}>
                        <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                          {ri.sku}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          {ri.productName}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="1"
                            value={ri.quantity}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setReturnItems((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r))
                              );
                            }}
                            className="w-18 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={ri.unitPriceOrig}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setReturnItems((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, unitPriceOrig: val } : r))
                              );
                            }}
                            className="w-28 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              min="-100"
                              max="500"
                              value={ri.percentAdjustment}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setReturnItems((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? { ...r, percentAdjustment: Number.isFinite(val) ? val : 0 }
                                      : r
                                  )
                                );
                              }}
                              className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono"
                            />
                            <span className="font-mono text-slate-500">%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                          {formatMoney(lineTotal, refundCurrency)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setReturnItems((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                            aria-label={`Remove ${ri.sku}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                Total Refund ({refundCurrency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={refundAmountOrig}
                onChange={(e) => setManualTotalOverride(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono font-semibold"
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
                <th className="py-3 px-4 font-semibold">Items & Per-Item %</th>
                <th className="py-3 px-4 font-semibold">Reason</th>
                <th className="py-3 px-4 font-semibold">Restocked</th>
                <th className="py-3 px-4 font-semibold text-right">Refund (Orig.)</th>
                <th className="py-3 px-4 font-semibold text-right">Refund (PKR)</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {returns.map((ret) => (
                <tr key={ret.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {ret.returnNo}
                  </td>
                  <td className="py-3 px-4 font-mono whitespace-nowrap">{ret.returnDate}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-900 dark:text-white">{ret.customerName}</p>
                    <p className="font-mono text-[11px] text-slate-500">{ret.invoiceNo}</p>
                  </td>
                  <td className="py-3 px-4">
                    {ret.items && ret.items.length > 0 ? (
                      <div className="space-y-0.5">
                        {ret.items.map((item, idx) => (
                          <p key={`${item.sku}-${idx}`} className="text-[11px]">
                            <span className="font-mono font-semibold">{item.sku}</span> ·{' '}
                            {item.productName} (×{item.quantity} ·{' '}
                            <span className="font-mono text-emerald-700 dark:text-emerald-400">
                              {item.percentAdjustment >= 0 ? `+${item.percentAdjustment}%` : `${item.percentAdjustment}%`}
                            </span>
                            )
                          </p>
                        ))}
                      </div>
                    ) : (
                      <span>
                        {ret.sku} · {ret.productName} (×{ret.quantity})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{ret.reason}</td>
                  <td className="py-3 px-4 font-semibold whitespace-nowrap">
                    {ret.restocked ? 'Yes (+Stock)' : 'No'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                    {formatMoney(ret.refundAmountOrig, ret.refundCurrency)} (@{ret.exchangeRateApplied})
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                    {formatMoney(ret.refundAmountPkr, 'PKR')}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {canProcess && (
                      <DeleteActionButton
                        onConfirm={() => deleteReturn(ret.id)}
                        title={`Delete return ${ret.returnNo}`}
                      />
                    )}
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

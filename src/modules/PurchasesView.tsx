import React, { useMemo, useState } from 'react';
import { CheckCircle2, Plus, ShoppingBag } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { CurrencyCode } from '../types/business';
import { formatMoney, getRateForCurrency } from '../utils/currency';

export const PurchasesView: React.FC = () => {
  const {
    inventory,
    purchases,
    profile,
    addPurchase,
    payPurchaseBalance,
    hasPermission,
    notify,
  } = useBusiness();

  const canRecord = hasPermission('record_purchases');

  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<CurrencyCode>('RMB');
  const [customRate, setCustomRate] = useState<string>(String(profile.rmbToPkr));
  const [selectedItemId, setSelectedItemId] = useState<string>(inventory[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCostOrig, setUnitCostOrig] = useState<number>(0);
  const [importCostOrig, setImportCostOrig] = useState<number>(0);
  const [paidPkrInput, setPaidPkrInput] = useState<string>('');
  const [status, setStatus] = useState<'Paid' | 'Partial' | 'Payable'>('Paid');
  const [notes, setNotes] = useState('');

  const handleCurrencyChange = (nextCur: CurrencyCode) => {
    setCurrency(nextCur);
    const rate = getRateForCurrency(nextCur, profile.rmbToPkr, profile.usdToPkr);
    setCustomRate(String(rate));
  };

  const activeRate = currency === 'PKR' ? 1 : Math.max(0, Number(customRate) || 0);
  const itemCostOrig = quantity * unitCostOrig;
  const totalOrig = itemCostOrig + importCostOrig;
  const totalPkr = useMemo(
    () => (currency === 'PKR' ? totalOrig : totalOrig * activeRate),
    [currency, totalOrig, activeRate]
  );

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRecord) {
      notify('Permission required to record purchases.', 'error');
      return;
    }
    if (!supplierName.trim()) {
      notify('Enter supplier name.', 'error');
      return;
    }

    const linkedItem = inventory.find((i) => i.id === selectedItemId);
    const paidPkr =
      status === 'Paid'
        ? totalPkr
        : status === 'Payable'
          ? 0
          : Math.min(totalPkr, Math.max(0, Number(paidPkrInput) || 0));

    addPurchase({
      referenceNo: `PUR-2026-${String(purchases.length + 1).padStart(3, '0')}`,
      supplierName: supplierName.trim(),
      supplierContact: supplierContact.trim(),
      purchaseDate,
      currency,
      exchangeRateApplied: activeRate,
      itemCostOrig,
      importCostOrig,
      totalOrig,
      totalPkr,
      paidPkr,
      status,
      items: linkedItem
        ? [
            {
              inventoryId: linkedItem.id,
              sku: linkedItem.sku,
              productName: linkedItem.name,
              quantity,
              unitCostOrig,
            },
          ]
        : [],
      notes,
    });

    setSupplierName('');
    setSupplierContact('');
    setUnitCostOrig(0);
    setImportCostOrig(0);
    setPaidPkrInput('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Purchase Management & Import Costing
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Enter supplier purchases in RMB, USD, or PKR with freight/import costs and auto PKR conversion
        </p>
      </div>

      {canRecord && (
        <form
          onSubmit={handleSavePurchase}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <ShoppingBag className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Record New Supplier Purchase
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Supplier Name *
              </label>
              <input
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Shenzhen Gem Co."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Supplier Contact
              </label>
              <input
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
                placeholder="+86 ... / WeChat"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Link Inventory Item (Auto Stock-In)
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.sku} — {i.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cost Currency
              </label>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono font-semibold"
              >
                <option value="RMB">RMB (¥)</option>
                <option value="USD">USD ($)</option>
                <option value="PKR">PKR (Rs)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Rate → PKR
              </label>
              <input
                type="number"
                step="0.01"
                disabled={currency === 'PKR'}
                value={currency === 'PKR' ? '1' : customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono disabled:opacity-60"
              />
            </div>
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
                Unit Cost ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitCostOrig}
                onChange={(e) => setUnitCostOrig(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Import / Duty ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={importCostOrig}
                onChange={(e) => setImportCostOrig(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Converted PKR Total
              </label>
              <div className="w-full rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 font-mono font-bold text-emerald-800 dark:text-emerald-300">
                {formatMoney(totalPkr, 'PKR')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Paid' | 'Partial' | 'Payable')}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="Paid">Paid in Full</option>
                <option value="Partial">Partial Payment</option>
                <option value="Payable">Supplier Payable (Credit)</option>
              </select>
            </div>
            {status === 'Partial' ? (
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Paid Now (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  value={paidPkrInput}
                  onChange={(e) => setPaidPkrInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Airway bill, customs ref..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                />
              </div>
            )}

            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              Save Purchase ({formatMoney(totalOrig, currency)})
            </button>
          </div>
        </form>
      )}

      {/* Purchase History */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Purchase History ({purchases.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Ref No</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Supplier</th>
                <th className="py-3 px-4 font-semibold">Currency & Rate</th>
                <th className="py-3 px-4 font-semibold text-right">Item + Import</th>
                <th className="py-3 px-4 font-semibold text-right">Total (PKR)</th>
                <th className="py-3 px-4 font-semibold text-right">Payable Balance</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Settle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {purchases.map((pur) => {
                const payable = Math.max(0, pur.totalPkr - pur.paidPkr);
                return (
                  <tr key={pur.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {pur.referenceNo}
                    </td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap">{pur.purchaseDate}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-white">{pur.supplierName}</p>
                      <p className="text-[11px] text-slate-500">
                        {pur.items.map((i) => `${i.sku} (×${i.quantity})`).join(', ')}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      {pur.currency} @ {pur.exchangeRateApplied}
                    </td>
                    <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                      {formatMoney(pur.totalOrig, pur.currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                      {formatMoney(pur.totalPkr, 'PKR')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-700 dark:text-amber-400 whitespace-nowrap">
                      {formatMoney(payable, 'PKR')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold">
                      <span
                        className={
                          pur.status === 'Paid'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }
                      >
                        {pur.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {payable > 1 && (
                        <button
                          onClick={() => payPurchaseBalance(pur.id, payable)}
                          className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-800"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

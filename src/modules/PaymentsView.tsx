import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Wallet } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { CurrencyCode, PaymentRecord } from '../types/business';
import { formatMoney, getRateForCurrency } from '../utils/currency';
import { DeleteActionButton } from '../components/DeleteActionButton';

export const PaymentsView: React.FC = () => {
  const {
    payments,
    sales,
    purchases,
    profile,
    addPayment,
    deletePayment,
    recordSalePayment,
    payPurchaseBalance,
    hasPermission,
    notify,
  } = useBusiness();

  const canManage = hasPermission('manage_payments');

  const [type, setType] = useState<'Incoming' | 'Outgoing'>('Incoming');
  const [category, setCategory] = useState('Customer Payment');
  const [partyName, setPartyName] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('PKR');
  const [rate, setRate] = useState('1');
  const [amountOrig, setAmountOrig] = useState('');
  const [method, setMethod] = useState<PaymentRecord['method']>('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const handleCurrencyChange = (cur: CurrencyCode) => {
    setCurrency(cur);
    setRate(String(getRateForCurrency(cur, profile.rmbToPkr, profile.usdToPkr)));
  };

  const activeRate = currency === 'PKR' ? 1 : Math.max(0, Number(rate) || 0);
  const amountNum = Math.max(0, Number(amountOrig) || 0);
  const amountPkr = currency === 'PKR' ? amountNum : amountNum * activeRate;

  const totals = useMemo(() => {
    const incomingPkr = payments
      .filter((p) => p.type === 'Incoming')
      .reduce((s, p) => s + p.amountPkr, 0);
    const outgoingPkr = payments
      .filter((p) => p.type === 'Outgoing')
      .reduce((s, p) => s + p.amountPkr, 0);
    const customerDuesPkr = sales.reduce(
      (s, o) => s + Math.max(0, o.finalTotalPkrEquivalent - o.paidAmountPkr),
      0
    );
    const supplierPayablesPkr = purchases.reduce(
      (s, p) => s + Math.max(0, p.totalPkr - p.paidPkr),
      0
    );
    return {
      incomingPkr,
      outgoingPkr,
      netCashFlowPkr: incomingPkr - outgoingPkr,
      customerDuesPkr,
      supplierPayablesPkr,
    };
  }, [payments, sales, purchases]);

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      notify('Permission required to record payments.', 'error');
      return;
    }
    if (!partyName.trim() || amountNum <= 0) return;

    addPayment({
      type,
      category,
      partyName: partyName.trim(),
      referenceNo: referenceNo.trim() || 'GENERAL',
      currency,
      exchangeRateApplied: activeRate,
      amountOrig: amountNum,
      amountPkr,
      method,
      paymentDate,
      notes,
    });

    setPartyName('');
    setReferenceNo('');
    setAmountOrig('');
    setNotes('');
  };

  const openSalesDues = sales.filter(
    (s) => s.finalTotalPkrEquivalent - s.paidAmountPkr > 1
  );
  const openSupplierPayables = purchases.filter((p) => p.totalPkr - p.paidPkr > 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Payments, Cash Flow & Accounts Ledger
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Track incoming/outgoing payments in RMB, USD, and PKR alongside Customer Dues & Supplier Payables
        </p>
      </div>

      {/* Cash Flow Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs text-slate-500">Total Incoming</p>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
            {formatMoney(totals.incomingPkr, 'PKR')}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs text-slate-500">Total Outgoing</p>
          <p className="mt-1 font-mono text-lg font-bold text-rose-600 dark:text-rose-400">
            {formatMoney(totals.outgoingPkr, 'PKR')}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs text-slate-500">Net Cash Flow</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white">
            {formatMoney(totals.netCashFlowPkr, 'PKR')}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs text-slate-500">Receivable vs Payable</p>
          <p className="mt-1 font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
            Due: {formatMoney(totals.customerDuesPkr, 'PKR')}
          </p>
          <p className="font-mono text-xs text-slate-600 dark:text-slate-400">
            Pay: {formatMoney(totals.supplierPayablesPkr, 'PKR')}
          </p>
        </div>
      </div>

      {/* Record Payment Form */}
      {canManage && (
        <form
          onSubmit={handleAddPayment}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Wallet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Record Incoming / Outgoing Payment (RMB / USD / PKR)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Flow Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'Incoming' | 'Outgoing')}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-semibold"
              >
                <option value="Incoming">Incoming (+ Cash In)</option>
                <option value="Outgoing">Outgoing (- Expense / Payout)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Party / Customer / Supplier *
              </label>
              <input
                required
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="Party name..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Customer Receipt, Shop Rent, Import Duty..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentRecord['method'])}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>JazzCash / EasyPaisa</option>
                <option>WeChat / Alipay</option>
                <option>Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Currency
              </label>
              <select
                value={currency}
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
                Rate → PKR
              </label>
              <input
                type="number"
                step="0.01"
                disabled={currency === 'PKR'}
                value={currency === 'PKR' ? '1' : rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Amount ({currency}) *
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={amountOrig}
                onChange={(e) => setAmountOrig(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 min-h-[40px]"
            >
              Save ({formatMoney(amountPkr, 'PKR')})
            </button>
          </div>
        </form>
      )}

      {/* Customer Dues & Supplier Payables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Pending Customer Dues ({openSalesDues.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {openSalesDues.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">No pending customer dues.</p>
            ) : (
              openSalesDues.map((sale) => {
                const due = Math.max(0, sale.finalTotalPkrEquivalent - sale.paidAmountPkr);
                return (
                  <div key={sale.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {sale.customerName}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {sale.invoiceNo} · {sale.orderDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                        {formatMoney(due, 'PKR')}
                      </span>
                      {canManage && (
                        <button
                          onClick={() => recordSalePayment(sale.id, due, 'Cash')}
                          className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-800"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Collect
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Pending Supplier Payables ({openSupplierPayables.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {openSupplierPayables.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">All supplier invoices settled.</p>
            ) : (
              openSupplierPayables.map((pur) => {
                const due = Math.max(0, pur.totalPkr - pur.paidPkr);
                return (
                  <div key={pur.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {pur.supplierName}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {pur.referenceNo} · {pur.purchaseDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatMoney(due, 'PKR')}
                      </span>
                      {canManage && (
                        <button
                          onClick={() => payPurchaseBalance(pur.id, due)}
                          className="inline-flex items-center gap-1 rounded bg-slate-900 dark:bg-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-white"
                        >
                          Pay Full
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Cash Flow Ledger */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Cash Flow History ({payments.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Party & Category</th>
                <th className="py-3 px-4 font-semibold">Method / Ref</th>
                <th className="py-3 px-4 font-semibold text-right">Original Amount</th>
                <th className="py-3 px-4 font-semibold text-right">PKR Equivalent</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 whitespace-nowrap font-semibold">
                    {p.type === 'Incoming' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        Incoming
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        Outgoing
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono whitespace-nowrap">{p.paymentDate}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-900 dark:text-white">{p.partyName}</p>
                    <p className="text-[11px] text-slate-500">{p.category}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {p.method} · <span className="font-mono">{p.referenceNo}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                    {formatMoney(p.amountOrig, p.currency)} (@{p.exchangeRateApplied})
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                    {formatMoney(p.amountPkr, 'PKR')}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {canManage && (
                      <DeleteActionButton
                        onConfirm={() => deletePayment(p.id)}
                        title={`Delete payment ${p.referenceNo}`}
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

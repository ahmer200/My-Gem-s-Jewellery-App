import React, { useState } from 'react';
import { Calendar, Lock, Truck, X } from 'lucide-react';
import { SalesOrder } from '../types/business';
import { formatMoney } from '../utils/currency';

interface DispatchConfirmModalProps {
  order: SalesOrder;
  onClose: () => void;
  onConfirm: (expectedArrivalDate: string) => void;
}

export const DispatchConfirmModal: React.FC<DispatchConfirmModalProps> = ({
  order,
  onClose,
  onConfirm,
}) => {
  const defaultArrival = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const [arrivalDate, setArrivalDate] = useState<string>(
    order.expectedArrivalDate || defaultArrival
  );
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!arrivalDate) {
      setError('Please select the expected date of parcel arrival to the customer.');
      return;
    }
    onConfirm(arrivalDate);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatch-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h2
              id="dispatch-modal-title"
              className="font-display text-sm font-bold text-slate-900 dark:text-white"
            >
              Confirm Parcel Dispatch
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
            aria-label="Close dispatch dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Invoice Number</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {order.invoiceNo}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Customer</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {order.customerName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Courier Charges</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {formatMoney(order.courierCharges || 0, order.finalCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Final Total</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatMoney(order.finalTotal, order.finalCurrency)}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2.5 text-amber-900 dark:text-amber-300">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Permanent Lock Warning:</strong> Once dispatched, this invoice will be locked
              and can no longer be edited.
            </p>
          </div>

          <div>
            <label
              htmlFor="expected-arrival-date"
              className="block font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              Expected Parcel Arriving Date to Customer *
            </label>
            <input
              id="expected-arrival-date"
              type="date"
              required
              value={arrivalDate}
              onChange={(e) => {
                setArrivalDate(e.target.value);
                setError('');
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 font-mono text-sm text-slate-900 dark:text-white"
            />
            {error && <p className="mt-1 text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors min-h-[38px]"
            >
              <Truck className="w-3.5 h-3.5" />
              Confirm Dispatch & Lock Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { BellRing, Copy, MessageCircle, Save, Smartphone } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { formatMoney } from '../utils/currency';

export const RemindersView: React.FC = () => {
  const {
    sales,
    reminders,
    reminderSettings,
    updateReminderSettings,
    addReminderLog,
    hasPermission,
    notify,
  } = useBusiness();

  const canSend = hasPermission('send_reminders');

  const [days, setDays] = useState(String(reminderSettings.autoRemindDays));
  const [channel, setChannel] = useState<'WhatsApp' | 'SMS'>(reminderSettings.defaultChannel);
  const [template, setTemplate] = useState(reminderSettings.messageTemplate);

  const dueInvoices = useMemo(
    () =>
      sales
        .map((sale) => ({
          sale,
          duePkr: Math.max(0, sale.finalTotalPkrEquivalent - sale.paidAmountPkr),
        }))
        .filter((x) => x.duePkr > 1),
    [sales]
  );

  const buildMessage = (customerName: string, invoiceNo: string, amountLabel: string) =>
    template
      .replace('{customer}', customerName)
      .replace('{invoiceNo}', invoiceNo)
      .replace('{amount}', amountLabel);

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    updateReminderSettings({
      autoRemindDays: Math.max(1, Number(days) || 5),
      defaultChannel: channel,
      messageTemplate: template,
    });
  };

  const dispatchReminder = (
    customerName: string,
    phone: string,
    invoiceNo: string,
    amountLabel: string,
    via: 'WhatsApp' | 'SMS'
  ) => {
    const msg = buildMessage(customerName, invoiceNo, amountLabel);
    const cleanPhone = (phone || '').replace(/[^\d]/g, '');

    addReminderLog({
      customerName,
      customerPhone: phone,
      invoiceNo,
      dueAmountLabel: amountLabel,
      channel: via,
      message: msg,
      sentDate: new Date().toISOString().slice(0, 10),
    });

    if (via === 'WhatsApp') {
      const url = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    } else {
      window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(msg)}`;
    }
    notify(`${via} reminder prepared for ${customerName}.`);
  };

  const copyMessage = (msg: string) => {
    navigator.clipboard?.writeText(msg);
    notify('Reminder message copied to clipboard.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Auto SMS & WhatsApp Payment Reminders
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Automatic pending-due detection and one-tap WhatsApp / SMS customer reminders
        </p>
      </div>

      {/* Auto Reminder Rules & Template */}
      <form
        onSubmit={handleSaveRules}
        className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <BellRing className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Automated Reminder Rules & Message Template
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Auto-Trigger After (Days Overdue)
            </label>
            <input
              type="number"
              min="1"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Preferred Dispatch Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as 'WhatsApp' | 'SMS')}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            >
              <option value="WhatsApp">WhatsApp</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Reminder Template (Placeholders: {'{customer}'}, {'{invoiceNo}'}, {'{amount}'})
          </label>
          <textarea
            rows={3}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Save className="w-3.5 h-3.5" />
            Save Reminder Rules
          </button>
        </div>
      </form>

      {/* Pending Dues Queue */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Customers with Pending Dues ({dueInvoices.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {dueInvoices.length === 0 ? (
            <p className="p-6 text-xs text-slate-500">All customer invoices are fully settled.</p>
          ) : (
            dueInvoices.map(({ sale, duePkr }) => {
              const dueLabel = formatMoney(duePkr, 'PKR');
              const previewMsg = buildMessage(sale.customerName, sale.invoiceNo, dueLabel);
              return (
                <div
                  key={sale.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {sale.customerName}
                      </span>
                      <span className="font-mono text-slate-500">· {sale.invoiceNo}</span>
                      <span className="font-mono text-slate-500">· {sale.orderDate}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      Phone: {sale.customerPhone || 'Not provided'} · Pending Balance:{' '}
                      <strong className="font-mono text-amber-700 dark:text-amber-400">
                        {dueLabel}
                      </strong>
                    </p>
                    <p className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-950 p-2.5 rounded border border-slate-200 dark:border-slate-800 max-w-2xl">
                      {previewMsg}
                    </p>
                  </div>

                  {canSend && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => copyMessage(previewMsg)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                      <button
                        onClick={() =>
                          dispatchReminder(
                            sale.customerName,
                            sale.customerPhone,
                            sale.invoiceNo,
                            dueLabel,
                            'SMS'
                          )
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 px-3.5 py-2 font-semibold text-white hover:bg-slate-800 min-h-[40px]"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        Send SMS
                      </button>
                      <button
                        onClick={() =>
                          dispatchReminder(
                            sale.customerName,
                            sale.customerPhone,
                            sale.invoiceNo,
                            dueLabel,
                            'WhatsApp'
                          )
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 font-semibold text-white hover:bg-emerald-700 min-h-[40px]"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Send WhatsApp
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Sent Log History */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Reminder Dispatch History ({reminders.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Channel</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Invoice</th>
                <th className="py-3 px-4 font-semibold text-right">Due Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {reminders.map((log) => (
                <tr key={log.id}>
                  <td className="py-3 px-4 font-mono whitespace-nowrap">{log.sentDate}</td>
                  <td className="py-3 px-4 font-semibold whitespace-nowrap">{log.channel}</td>
                  <td className="py-3 px-4">{log.customerName}</td>
                  <td className="py-3 px-4 font-mono">{log.invoiceNo}</td>
                  <td className="py-3 px-4 text-right font-mono">{log.dueAmountLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import {
  computeItemFinalPkr,
  convertToPkr,
  formatMoney,
  getRateForCurrency,
} from '../utils/currency';
import {
  exportGenericReportExcel,
  exportGenericReportPdf,
} from '../utils/exporters';

type ReportTab = 'stock' | 'sales' | 'profit' | 'purchase' | 'customer';

export const ReportsView: React.FC = () => {
  const { inventory, sales, purchases, profile, hasPermission } = useBusiness();
  const [activeTab, setActiveTab] = useState<ReportTab>('stock');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const canExport = hasPermission('export_reports');
  const canViewProfit = hasPermission('view_profit');

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (dateFrom && s.orderDate < dateFrom) return false;
      if (dateTo && s.orderDate > dateTo) return false;
      return true;
    });
  }, [sales, dateFrom, dateTo]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (dateFrom && p.purchaseDate < dateFrom) return false;
      if (dateTo && p.purchaseDate > dateTo) return false;
      return true;
    });
  }, [purchases, dateFrom, dateTo]);

  // Report datasets (All include Currency Type, Exchange Rate, and Percentage Used)
  const reportConfig = useMemo(() => {
    if (activeTab === 'stock') {
      const headers = [
        'SKU',
        'Product Name',
        'Stock Qty',
        'Cost Currency',
        'Cost Rate',
        'Sell Currency',
        'Sell Rate',
        'Markup %',
        'Base Sell Price',
        'Final Retail Value (PKR)',
      ];
      const rows = inventory.map((item) => {
        const costRate = getRateForCurrency(
          item.costCurrency,
          profile.rmbToPkr,
          profile.usdToPkr
        );
        const sellCalc = computeItemFinalPkr(item.baseSellPrice, item.sellCurrency, profile);
        return [
          item.sku,
          item.name,
          item.stockQty,
          item.costCurrency,
          costRate,
          item.sellCurrency,
          sellCalc.rate,
          `${profile.defaultMarkupPercent}%`,
          formatMoney(item.baseSellPrice, item.sellCurrency),
          formatMoney(sellCalc.finalPkr * item.stockQty, 'PKR'),
        ];
      });
      return {
        title: 'Stock Valuation Report',
        subtitle: `Total SKUs: ${inventory.length} | Active Rates: RMB=${profile.rmbToPkr}, USD=${profile.usdToPkr}, Markup=${profile.defaultMarkupPercent}%`,
        headers,
        rows,
      };
    }

    if (activeTab === 'sales') {
      const headers = [
        'Invoice No',
        'Date',
        'Customer',
        'Entry Currency',
        'Exchange Rate',
        'Markup %',
        'Final Currency',
        'Final Total',
        'PKR Equivalent',
        'Status',
      ];
      const rows = filteredSales.map((s) => [
        s.invoiceNo,
        s.orderDate,
        s.customerName,
        s.sourceCurrency,
        s.rmbRateUsed === 0 ? '0 (Orig. Mode)' : s.exchangeRateApplied,
        `${s.markupPercentUsed}%`,
        s.finalCurrency,
        formatMoney(s.finalTotal, s.finalCurrency),
        formatMoney(s.finalTotalPkrEquivalent, 'PKR'),
        s.paymentStatus,
      ]);
      return {
        title: 'Sales Report',
        subtitle: `Invoices: ${filteredSales.length} | Shows currency, applied exchange rate & markup percentage`,
        headers,
        rows,
      };
    }

    if (activeTab === 'profit') {
      const headers = [
        'Invoice No',
        'Date',
        'Customer',
        'Currency Type',
        'Exchange Rate',
        'Markup %',
        'Revenue (PKR Eqv.)',
        'Landed Cost (PKR)',
        'Net Profit (PKR)',
        'Margin %',
      ];
      const rows = filteredSales.map((s) => {
        const margin =
          s.finalTotalPkrEquivalent > 0
            ? ((s.profitPkr / s.finalTotalPkrEquivalent) * 100).toFixed(1)
            : '0.0';
        return [
          s.invoiceNo,
          s.orderDate,
          s.customerName,
          `${s.sourceCurrency} -> ${s.finalCurrency}`,
          s.rmbRateUsed === 0 ? '0 (Orig)' : s.exchangeRateApplied,
          `${s.markupPercentUsed}%`,
          formatMoney(s.finalTotalPkrEquivalent, 'PKR'),
          formatMoney(s.totalCostPkr, 'PKR'),
          formatMoney(s.profitPkr, 'PKR'),
          `${margin}%`,
        ];
      });
      return {
        title: 'Profit & Margin Report',
        subtitle: `Total Net Profit: ${formatMoney(
          filteredSales.reduce((sum, s) => sum + s.profitPkr, 0),
          'PKR'
        )}`,
        headers,
        rows,
      };
    }

    if (activeTab === 'purchase') {
      const headers = [
        'Ref No',
        'Date',
        'Supplier',
        'Currency Type',
        'Exchange Rate',
        'Markup Ref %',
        'Item + Import (Orig.)',
        'Total Landed (PKR)',
        'Paid (PKR)',
        'Status',
      ];
      const rows = filteredPurchases.map((p) => [
        p.referenceNo,
        p.purchaseDate,
        p.supplierName,
        p.currency,
        p.exchangeRateApplied,
        `${profile.defaultMarkupPercent}%`,
        formatMoney(p.totalOrig, p.currency),
        formatMoney(p.totalPkr, 'PKR'),
        formatMoney(p.paidPkr, 'PKR'),
        p.status,
      ]);
      return {
        title: 'Supplier Purchase Report',
        subtitle: `Purchases: ${filteredPurchases.length} | Total Cost: ${formatMoney(
          filteredPurchases.reduce((sum, p) => sum + p.totalPkr, 0),
          'PKR'
        )}`,
        headers,
        rows,
      };
    }

    // Customer Report
    const customerMap = new Map<
      string,
      {
        name: string;
        phone: string;
        orders: number;
        currencies: Set<string>;
        rates: Set<string>;
        markups: Set<string>;
        totalPkr: number;
        paidPkr: number;
        lastDate: string;
      }
    >();

    for (const s of filteredSales) {
      const key = s.customerName.trim();
      const existing = customerMap.get(key) || {
        name: key,
        phone: s.customerPhone || '—',
        orders: 0,
        currencies: new Set<string>(),
        rates: new Set<string>(),
        markups: new Set<string>(),
        totalPkr: 0,
        paidPkr: 0,
        lastDate: s.orderDate,
      };
      existing.orders += 1;
      existing.currencies.add(s.finalCurrency);
      existing.rates.add(String(s.exchangeRateApplied));
      existing.markups.add(`${s.markupPercentUsed}%`);
      existing.totalPkr += s.finalTotalPkrEquivalent;
      existing.paidPkr += s.paidAmountPkr;
      if (s.orderDate > existing.lastDate) existing.lastDate = s.orderDate;
      customerMap.set(key, existing);
    }

    const headers = [
      'Customer Name',
      'Contact',
      'Orders',
      'Currencies Used',
      'Rates Applied',
      'Markup % Used',
      'Total Billed (PKR)',
      'Total Paid (PKR)',
      'Pending Due (PKR)',
      'Last Order',
    ];

    const rows = Array.from(customerMap.values()).map((c) => [
      c.name,
      c.phone,
      c.orders,
      Array.from(c.currencies).join(', '),
      Array.from(c.rates).join(', '),
      Array.from(c.markups).join(', '),
      formatMoney(c.totalPkr, 'PKR'),
      formatMoney(c.paidPkr, 'PKR'),
      formatMoney(Math.max(0, c.totalPkr - c.paidPkr), 'PKR'),
      c.lastDate,
    ]);

    return {
      title: 'Customer Ledger Report',
      subtitle: `Unique Customers: ${rows.length} | Active FX: RMB=${profile.rmbToPkr}, USD=${profile.usdToPkr}`,
      headers,
      rows,
    };
  }, [activeTab, inventory, filteredSales, filteredPurchases, profile]);

  const handleExportExcel = () => {
    exportGenericReportExcel(reportConfig.title, reportConfig.headers, reportConfig.rows, [
      ['Merchant', profile.companyName],
      ['RMB -> PKR Rate', String(profile.rmbToPkr)],
      ['USD -> PKR Rate', String(profile.usdToPkr)],
      ['Default Markup %', `${profile.defaultMarkupPercent}%`],
      ['Generated', new Date().toLocaleString()],
    ]);
  };

  const handleExportPdf = () => {
    exportGenericReportPdf(
      reportConfig.title,
      reportConfig.subtitle,
      reportConfig.headers,
      reportConfig.rows,
      profile
    );
  };

  const stockCostTotalPkr = inventory.reduce(
    (s, i) => s + convertToPkr(i.unitCost, i.costCurrency, profile.rmbToPkr, profile.usdToPkr) * i.stockQty,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Business Reports & Excel / PDF Export
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            All 5 reports display Currency Type, Exchange Rate Applied, and Markup Percentage Used
          </p>
        </div>

        {canExport && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              Export Excel (.xlsx)
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 min-h-[40px]"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Report Tabs + Date Filters */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
          {(
            [
              { id: 'stock', label: 'Stock Report' },
              { id: 'sales', label: 'Sales Report' },
              ...(canViewProfit ? [{ id: 'profit', label: 'Profit Report' }] : []),
              { id: 'purchase', label: 'Purchase Report' },
              { id: 'customer', label: 'Customer Report' },
            ] as { id: ReportTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">From:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 font-mono"
          />
          <span className="text-slate-500">To:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 font-mono"
          />
        </div>
      </div>

      {/* Report Data Table */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {reportConfig.title}
            </h2>
            <p className="text-xs text-slate-500">{reportConfig.subtitle}</p>
          </div>
          {activeTab === 'stock' && (
            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
              Total Stock Cost: {formatMoney(stockCostTotalPkr, 'PKR')}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                {reportConfig.headers.map((h) => (
                  <th key={h} className="py-3 px-4 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {reportConfig.rows.length === 0 ? (
                <tr>
                  <td colSpan={reportConfig.headers.length} className="py-10 text-center text-slate-500">
                    No records found for this date range.
                  </td>
                </tr>
              ) : (
                reportConfig.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="py-3 px-4 whitespace-nowrap font-mono text-slate-800 dark:text-slate-200"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

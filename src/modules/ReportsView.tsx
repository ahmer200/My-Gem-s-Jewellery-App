import React, { useMemo, useState } from 'react';
import { Edit3, FileDown, FileSpreadsheet, Lock, Printer, Truck } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { SalesOrder } from '../types/business';
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
import { computeItemVelocity } from '../utils/velocity';
import { ItemVelocityChart } from '../components/ItemVelocityChart';
import { DispatchConfirmModal } from '../components/DispatchConfirmModal';
import { InvoiceModal } from '../components/InvoiceModal';

type ReportTab = 'stock' | 'sales' | 'velocity' | 'profit' | 'purchase' | 'customer';

export const ReportsView: React.FC = () => {
  const {
    inventory,
    sales,
    purchases,
    profile,
    dispatchSale,
    openSaleForEdit,
    hasPermission,
  } = useBusiness();
  const [activeTab, setActiveTab] = useState<ReportTab>('stock');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dispatchTarget, setDispatchTarget] = useState<SalesOrder | null>(null);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);

  const canExport = hasPermission('export_reports');
  const canViewProfit = hasPermission('view_profit');
  const canEditSales = hasPermission('create_sales');

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
    const defCur = profile.defaultCurrency || 'CNY';
    const defRate = getRateForCurrency(defCur, profile);

    if (activeTab === 'stock') {
      const headers = [
        '1. SKU',
        '2. Size (mm)',
        '3. Colour',
        '4. Shape',
        '5. Sub-Category',
        '6. Category',
        '7. Stock Pieces',
        '8. Item Unit',
        '9. 1TP Weight',
        '10. Batch #',
        '11. Stock Quantity',
        '12. Cent',
        '13. Fridge',
        '14. Cost',
        '15. Price',
        '16. Via (By Sea/ By Air)',
        '17. Purchase Date',
        '18. Return/Loss/Damage',
        '19. Gemstone',
        '20. Origin',
        '21. Clarity',
        '22. Treatment',
        '23. Cert Lab',
        '24. Cert No.',
        '25. Min Alert',
        '26. Vault / Box',
        '27. Supplier/ Carrier',
        '28. Remarks',
      ];
      const rows = inventory.map((item) => {
        const costRate =
          item.costCurrency === 'PKR'
            ? 1
            : typeof item.costExchangeRate === 'number'
              ? item.costExchangeRate
              : getRateForCurrency(item.costCurrency, profile);
        const costConverted =
          item.costCurrency !== 'PKR' && costRate === 0
            ? `${formatMoney(item.unitCost, item.costCurrency)} (Rate 0)`
            : `${formatMoney(item.unitCost, item.costCurrency)} (${formatMoney(
                convertToPkr(item.unitCost, item.costCurrency, costRate),
                'PKR'
              )})`;
        const sellCalc = computeItemFinalPkr(
          item.baseSellPrice,
          item.sellCurrency,
          profile,
          item.sellExchangeRate
        );
        return [
          item.sku,
          item.sizeMm || '—',
          item.colour || '—',
          item.shapeCut || '—',
          item.subCategory || '—',
          item.category || '—',
          item.stockPieces ?? 0,
          item.itemUnit || 'Carats',
          item.oneTpWeight ?? item.weightCarats ?? 0,
          item.batchNumber || '—',
          item.stockQty,
          item.cent ?? 0,
          item.fridge || '—',
          costConverted,
          `${formatMoney(sellCalc.finalDisplayAmount, sellCalc.finalCurrency)} (Base: ${formatMoney(
            item.baseSellPrice,
            item.sellCurrency
          )})`,
          item.via || '—',
          item.purchaseDate || '—',
          item.returnLossDamage || '0',
          item.gemstoneType || '—',
          item.origin || '—',
          item.clarity || '—',
          item.treatment || '—',
          item.certLab || '—',
          item.certNumber || '—',
          item.minStockAlert,
          item.vaultLocation || '—',
          item.supplierName || '—',
          item.notes || '—',
        ];
      });
      return {
        title: 'Stock Report',
        subtitle: `Total SKUs: ${inventory.length} | Default Currency: ${defCur}=${defRate} PKR, Markup=${profile.defaultMarkupPercent}%`,
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
        'Courier Charges',
        'Final Currency',
        'Final Total',
        'PKR Equivalent',
        'Payment Status',
        'Dispatch / Arrival',
      ];
      const rows = filteredSales.map((s) => {
        const isOrigMode = s.sourceCurrency !== 'PKR' && s.exchangeRateApplied === 0;
        return [
          s.invoiceNo,
          s.orderDate,
          s.customerName,
          s.sourceCurrency,
          isOrigMode ? `0 (Kept in ${s.finalCurrency})` : s.exchangeRateApplied,
          `${s.markupPercentUsed}%`,
          formatMoney(s.courierCharges || 0, s.finalCurrency),
          s.finalCurrency,
          formatMoney(s.finalTotal, s.finalCurrency),
          isOrigMode ? formatMoney(s.finalTotal, s.finalCurrency) : formatMoney(s.finalTotalPkrEquivalent, 'PKR'),
          s.paymentStatus,
          s.dispatchStatus === 'Dispatched'
            ? `Dispatched (${s.expectedArrivalDate || '—'})`
            : 'Pending Dispatch',
        ];
      });
      return {
        title: 'Sales Report',
        subtitle: `Invoices: ${filteredSales.length} | Shows currency, exchange rate, markup %, courier charges & dispatch status`,
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
        const isOrigMode = s.sourceCurrency !== 'PKR' && s.exchangeRateApplied === 0;
        const margin =
          s.finalTotalPkrEquivalent > 0
            ? ((s.profitPkr / s.finalTotalPkrEquivalent) * 100).toFixed(1)
            : '0.0';
        return [
          s.invoiceNo,
          s.orderDate,
          s.customerName,
          `${s.sourceCurrency} -> ${s.finalCurrency}`,
          isOrigMode ? `0 (${s.finalCurrency})` : s.exchangeRateApplied,
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

    if (activeTab === 'velocity') {
      const velocityRows = computeItemVelocity(inventory, filteredSales, profile).sort((a, b) => {
        if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
        return b.sellThroughPct - a.sellThroughPct;
      });
      const headers = [
        'SKU',
        'Product Name',
        'Category',
        'Velocity Status',
        'Units Sold',
        'Stock Qty',
        'Sell-Through %',
        'Currency Rate Ref',
        'Sales Revenue (PKR)',
        'Stock Retail Value (PKR)',
        'Last Sold Date',
      ];
      const rows = velocityRows.map((v) => [
        v.sku,
        v.name,
        v.category,
        v.classification,
        v.unitsSold,
        v.stockQty,
        `${v.sellThroughPct}%`,
        `${defCur}=${defRate} PKR (+${profile.defaultMarkupPercent}%)`,
        formatMoney(v.revenuePkr, 'PKR'),
        formatMoney(v.stockValuePkr, 'PKR'),
        v.lastSoldDate || 'No sales',
      ]);
      return {
        title: 'Fast-Moving & Slow-Moving Item Velocity Report',
        subtitle: `Tracked SKUs: ${velocityRows.length} | Fast-Moving vs Idle Stock Breakdown`,
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
        pendingDispatch: number;
        dispatched: number;
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
        pendingDispatch: 0,
        dispatched: 0,
        currencies: new Set<string>(),
        rates: new Set<string>(),
        markups: new Set<string>(),
        totalPkr: 0,
        paidPkr: 0,
        lastDate: s.orderDate,
      };
      existing.orders += 1;
      if (s.dispatchStatus === 'Dispatched') existing.dispatched += 1;
      else existing.pendingDispatch += 1;
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
      'Pending Dispatch',
      'Dispatched',
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
      c.pendingDispatch,
      c.dispatched,
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
      subtitle: `Unique Customers: ${rows.length} (Includes both Dispatched & Pending Dispatch invoices) | Default FX: ${defCur}=${defRate} PKR`,
      headers,
      rows,
    };
  }, [activeTab, inventory, filteredSales, filteredPurchases, profile]);

  const handleExportExcel = () => {
    const defCur = profile.defaultCurrency || 'CNY';
    exportGenericReportExcel(reportConfig.title, reportConfig.headers, reportConfig.rows, [
      ['Merchant', profile.companyName],
      ['Default World Currency', defCur],
      ['Default Rate -> PKR', String(getRateForCurrency(defCur, profile))],
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

  const stockCostTotalPkr = inventory.reduce((s, i) => {
    const costRate =
      i.costCurrency === 'PKR'
        ? 1
        : typeof i.costExchangeRate === 'number'
          ? i.costExchangeRate
          : getRateForCurrency(i.costCurrency, profile);
    return s + convertToPkr(i.unitCost, i.costCurrency, costRate) * i.stockQty;
  }, 0);

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
              { id: 'velocity', label: 'Fast / Slow Chart' },
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

      {/* Visual Fast/Slow Moving Item Chart when velocity tab is selected */}
      {activeTab === 'velocity' && (
        <ItemVelocityChart
          salesSource={filteredSales}
          title="Fast-Moving & Slow-Moving Item Velocity Chart"
        />
      )}

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

      {/* Customer Ledger Invoices & Dispatch Tracker (Editable Before Dispatch) */}
      {activeTab === 'customer' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Customer Ledger Invoices & Dispatch Status ({filteredSales.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Un-dispatched invoices appear in customer ledgers and remain editable until dispatched
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Invoice No</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Courier</th>
                  <th className="py-3 px-4 font-semibold text-right">Final Total</th>
                  <th className="py-3 px-4 font-semibold text-right">Due (PKR)</th>
                  <th className="py-3 px-4 font-semibold">Dispatch / Arrival</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No customer ledger invoices found for this date range.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const isDispatched = sale.dispatchStatus === 'Dispatched';
                    const duePkr = Math.max(0, sale.finalTotalPkrEquivalent - sale.paidAmountPkr);
                    return (
                      <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                          {sale.customerName}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {sale.invoiceNo}
                        </td>
                        <td className="py-3 px-4 font-mono whitespace-nowrap">{sale.orderDate}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatMoney(sale.courierCharges || 0, sale.finalCurrency)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          {formatMoney(sale.finalTotal, sale.finalCurrency)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-700 dark:text-amber-400 whitespace-nowrap">
                          {formatMoney(duePkr, 'PKR')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isDispatched ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                                <Lock className="w-3 h-3" />
                                Dispatched
                              </span>
                              <p className="text-[11px] font-mono text-slate-500">
                                Arrives: {sale.expectedArrivalDate || '—'}
                              </p>
                            </div>
                          ) : (
                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                              Pending Dispatch (Editable)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {canEditSales && !isDispatched && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openSaleForEdit(sale.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDispatchTarget(sale)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold text-white"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  Dispatch
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setPreviewOrder(sale)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Invoice
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

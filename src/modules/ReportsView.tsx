import React, { useMemo, useState } from 'react';
import { Crown, Edit3, FileDown, FileSpreadsheet, Lock, Printer, Truck } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { SalesOrder } from '../types/business';
import { bi } from '../utils/bilingual';
import {
  convertToPkr,
  formatMoney,
  getRateForCurrency,
} from '../utils/currency';
import {
  exportGenericReportExcel,
  exportGenericReportPdf,
  GenericReportExportOptions,
} from '../utils/exporters';
import { computeItemVelocity } from '../utils/velocity';
import { ItemVelocityChart } from '../components/ItemVelocityChart';
import { DispatchConfirmModal } from '../components/DispatchConfirmModal';
import { InvoiceModal } from '../components/InvoiceModal';

type ReportTab =
  | 'stock'
  | 'daily_movement'
  | 'daily_amount'
  | 'sales'
  | 'velocity'
  | 'profit'
  | 'purchase'
  | 'customer';

function parseNumericLoss(raw?: string): number {
  if (!raw) return 0;
  const match = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export const ReportsView: React.FC = () => {
  const {
    inventory,
    sales,
    purchases,
    returns,
    profile,
    uiLanguage,
    dispatchSale,
    openSaleForEdit,
    hasPermission,
    isFeatureLocked,
    isProUnlocked,
    setActiveModule,
    notify,
  } = useBusiness();

  const [activeTab, setActiveTab] = useState<ReportTab>('stock');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [stockPageSize, setStockPageSize] = useState<'15' | '25' | '50' | 'all'>('15');
  const [stockPage, setStockPage] = useState(1);
  const [dispatchTarget, setDispatchTarget] = useState<SalesOrder | null>(null);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);

  const canExport = hasPermission('export_reports');
  const canViewProfit = hasPermission('view_profit');
  const canEditSales = hasPermission('create_sales');

  const todayIso = new Date().toISOString().slice(0, 10);

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

  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      if (dateFrom && r.returnDate < dateFrom) return false;
      if (dateTo && r.returnDate > dateTo) return false;
      return true;
    });
  }, [returns, dateFrom, dateTo]);

  const stockCostTotalPkr = useMemo(
    () =>
      inventory.reduce((s, i) => {
        const costRate =
          i.costCurrency === 'PKR'
            ? 1
            : typeof i.costExchangeRate === 'number'
              ? i.costExchangeRate
              : getRateForCurrency(i.costCurrency, profile);
        return s + convertToPkr(i.unitCost, i.costCurrency, costRate) * i.stockQty;
      }, 0),
    [inventory, profile]
  );

  // Map every inventory item (by ID or SKU) to all Sold Invoice Numbers
  const soldInvoicesByItem = useMemo(() => {
    const byId = new Map<string, string[]>();
    const bySku = new Map<string, string[]>();

    for (const sale of sales) {
      for (const li of sale.items) {
        if (li.inventoryId) {
          const arr = byId.get(li.inventoryId) || [];
          if (!arr.includes(sale.invoiceNo)) arr.push(sale.invoiceNo);
          byId.set(li.inventoryId, arr);
        }
        const skuKey = (li.sku || '').trim().toUpperCase();
        if (skuKey) {
          const arr = bySku.get(skuKey) || [];
          if (!arr.includes(sale.invoiceNo)) arr.push(sale.invoiceNo);
          bySku.set(skuKey, arr);
        }
      }
    }

    return { byId, bySku };
  }, [sales]);

  // Pre-aggregate date-filtered movement stats per item
  const movementStatsByKey = useMemo(() => {
    const purchasedByKey = new Map<string, number>();
    const soldQtyByKey = new Map<string, number>();
    const invoicesByKey = new Map<string, Set<string>>();
    const returnLossByKey = new Map<string, number>();

    for (const p of filteredPurchases) {
      for (const li of p.items) {
        const kId = li.inventoryId ? `id:${li.inventoryId}` : '';
        const kSku = li.sku ? `sku:${li.sku.trim().toUpperCase()}` : '';
        if (kId) purchasedByKey.set(kId, (purchasedByKey.get(kId) || 0) + (li.quantity || 0));
        else if (kSku) purchasedByKey.set(kSku, (purchasedByKey.get(kSku) || 0) + (li.quantity || 0));
      }
    }

    for (const s of filteredSales) {
      for (const li of s.items) {
        const kId = li.inventoryId ? `id:${li.inventoryId}` : '';
        const kSku = li.sku ? `sku:${li.sku.trim().toUpperCase()}` : '';
        const targetKey = kId || kSku;
        if (!targetKey) continue;
        soldQtyByKey.set(targetKey, (soldQtyByKey.get(targetKey) || 0) + (li.quantity || 0));
        if (!invoicesByKey.has(targetKey)) invoicesByKey.set(targetKey, new Set());
        invoicesByKey.get(targetKey)!.add(s.invoiceNo);
      }
    }

    for (const r of filteredReturns) {
      const isLossOrDamage = !r.restocked || /loss|damag|broken/i.test(r.reason || '');
      if (!isLossOrDamage) continue;
      if (r.items && r.items.length > 0) {
        for (const li of r.items) {
          const targetKey = li.inventoryId
            ? `id:${li.inventoryId}`
            : li.sku
              ? `sku:${li.sku.trim().toUpperCase()}`
              : '';
          if (targetKey) {
            returnLossByKey.set(targetKey, (returnLossByKey.get(targetKey) || 0) + (li.quantity || 0));
          }
        }
      } else {
        const targetKey = r.inventoryId
          ? `id:${r.inventoryId}`
          : r.sku
            ? `sku:${r.sku.trim().toUpperCase()}`
            : '';
        if (targetKey) {
          returnLossByKey.set(targetKey, (returnLossByKey.get(targetKey) || 0) + (r.quantity || 0));
        }
      }
    }

    return { purchasedByKey, soldQtyByKey, invoicesByKey, returnLossByKey };
  }, [filteredPurchases, filteredSales, filteredReturns]);

  // Report datasets
  const reportConfig = useMemo<{
    title: string;
    subtitle: string;
    headers: string[];
    rows: (string | number)[][];
    sumColumnIndices?: number[];
    sumColumnDecimals?: Record<number, number>;
    exportOptions?: GenericReportExportOptions;
  }>(() => {
    const defCur = profile.defaultCurrency || 'CNY';
    const defRate = getRateForCurrency(defCur, profile);

    if (activeTab === 'stock') {
      const headers = [
        'SKU',
        'Sold Invoice #',
        'Size (mm)',
        'Colour',
        'Shape',
        'Sub-Category',
        'Category',
        'Stock Pieces',
        'Item Unit',
        'Item Weight',
        'Batch #',
        'Stock Quantity',
        'Cent',
        'Fridge',
        'Cost Price',
        'Via (By Sea/ By Air)',
        'Purchase Date',
        'Return/Loss/Damage',
        'Gemstone',
        'Origin',
        'Clarity',
        'Treatment',
        'Cert Lab',
        'Cert No.',
        'Min Alert',
        'Vault / Box',
        'Supplier/ Carrier',
        'Remarks',
      ];
      let grandTotalQty = 0;
      let grandTotalPieces = 0;

      const rows = inventory.map((item) => {
        const costRate =
          item.costCurrency === 'PKR'
            ? 1
            : typeof item.costExchangeRate === 'number'
              ? item.costExchangeRate
              : getRateForCurrency(item.costCurrency, profile);
        const costOnlyLabel =
          item.costCurrency !== 'PKR' && costRate > 0
            ? `${formatMoney(item.unitCost, item.costCurrency)} (${formatMoney(
                convertToPkr(item.unitCost, item.costCurrency, costRate),
                'PKR'
              )})`
            : formatMoney(item.unitCost, item.costCurrency);

        const invById = soldInvoicesByItem.byId.get(item.id) || [];
        const invBySku = soldInvoicesByItem.bySku.get((item.sku || '').trim().toUpperCase()) || [];
        const mergedInvoices = Array.from(new Set([...invById, ...invBySku]));
        const soldInvoicesText = mergedInvoices.length > 0 ? mergedInvoices.join(', ') : '—';

        const pcs = item.stockPieces ?? 0;
        const qty = item.stockQty ?? 0;
        grandTotalPieces += pcs;
        grandTotalQty += qty;

        return [
          item.sku,
          soldInvoicesText,
          item.sizeMm || '—',
          item.colour || '—',
          item.shapeCut || '—',
          item.subCategory || '—',
          item.category || '—',
          pcs,
          item.itemUnit || 'Carats',
          item.oneTpWeight ?? item.weightCarats ?? 0,
          item.batchNumber || '—',
          qty,
          item.cent ?? 0,
          item.fridge || '—',
          costOnlyLabel,
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

      const grandTotalRow: (string | number)[] = new Array(headers.length).fill('');
      grandTotalRow[0] = 'GRAND TOTAL';
      grandTotalRow[7] = grandTotalPieces;
      grandTotalRow[11] = Number(grandTotalQty.toFixed(2));
      grandTotalRow[14] = formatMoney(stockCostTotalPkr, 'PKR');

      return {
        title: bi('Stock Report (Cost Only)', 'اسٹاک رپورٹ (صرف قیمتِ خرید)', uiLanguage),
        subtitle: `Total SKUs: ${inventory.length} | Cost Price Only (NO Markup/Sell Price) | Grand Total Qty: ${Number(
          grandTotalQty.toFixed(2)
        )} | Total Cost: ${formatMoney(stockCostTotalPkr, 'PKR')}`,
        headers,
        rows,
        sumColumnIndices: [7, 11],
        sumColumnDecimals: { 7: 0, 11: 2 } as Record<number, number>,
        exportOptions: {
          sumColumnIndices: [7, 11],
          sumColumnDecimals: { 7: 0, 11: 2 },
          sumColumnLabels: { 7: 'Stock Pcs', 11: 'Stock Qty' },
          hideMarkupInHeader: true,
          grandTotalRow,
          grandTotalText: `GRAND TOTAL (All Pages) — Total Stock Quantity: ${Number(
            grandTotalQty.toFixed(2)
          )}  |  Total Pieces: ${grandTotalPieces}  |  Total Stock Cost (No Markup): ${formatMoney(
            stockCostTotalPkr,
            'PKR'
          )}`,
        } as GenericReportExportOptions,
      };
    }

    if (activeTab === 'daily_movement') {
      const headers = [
        'SKU',
        'Item / Gemstone',
        'Category',
        'Sub-Category',
        'Item Unit',
        'Item Weight',
        'In-Hand Quantity',
        'Received / Purchased Quantity',
        'Loss Quantity',
        'Total Weight',
        'Sold Item Quantity',
        'Sold Pieces',
        'Number of Invoices',
      ];

      let gInHand = 0;
      let gPurchased = 0;
      let gLoss = 0;
      let gWeight = 0;
      let gSoldQty = 0;
      let gSoldPcs = 0;
      let gInvoices = 0;

      const rows = inventory.map((item) => {
        const kId = `id:${item.id}`;
        const kSku = `sku:${(item.sku || '').trim().toUpperCase()}`;

        const inHand = Number((item.stockQty ?? 0).toFixed(2));
        const purchased = Number(
          (
            (movementStatsByKey.purchasedByKey.get(kId) || 0) +
            (movementStatsByKey.purchasedByKey.get(kSku) || 0)
          ).toFixed(2)
        );
        const lossFromField = !dateFrom && !dateTo ? parseNumericLoss(item.returnLossDamage) : 0;
        const lossFromReturns =
          (movementStatsByKey.returnLossByKey.get(kId) || 0) +
          (movementStatsByKey.returnLossByKey.get(kSku) || 0);
        const lossQty = Number((lossFromField + lossFromReturns).toFixed(2));

        const unitWt = item.oneTpWeight ?? item.weightCarats ?? 0;
        const totalWeight = Number((unitWt * Math.max(0, inHand)).toFixed(2));

        const soldQty = Number(
          (
            (movementStatsByKey.soldQtyByKey.get(kId) || 0) +
            (movementStatsByKey.soldQtyByKey.get(kSku) || 0)
          ).toFixed(2)
        );
        const pcsRatio =
          item.stockQty > 0 && (item.stockPieces ?? 0) > 0
            ? (item.stockPieces ?? 0) / item.stockQty
            : 1;
        const soldPieces = Math.round(soldQty * pcsRatio);

        const invSet = new Set<string>([
          ...(movementStatsByKey.invoicesByKey.get(kId) || []),
          ...(movementStatsByKey.invoicesByKey.get(kSku) || []),
        ]);
        const invoiceCount = invSet.size;

        gInHand += inHand;
        gPurchased += purchased;
        gLoss += lossQty;
        gWeight += totalWeight;
        gSoldQty += soldQty;
        gSoldPcs += soldPieces;
        gInvoices += invoiceCount;

        return [
          item.sku,
          item.name || item.gemstoneType || item.subCategory || item.sku,
          item.category || '—',
          item.subCategory || '—',
          item.itemUnit || 'Carats',
          Number(unitWt.toFixed(2)),
          inHand,
          purchased,
          lossQty,
          totalWeight,
          soldQty,
          soldPieces,
          invoiceCount,
        ];
      });

      const grandTotalRow: (string | number)[] = [
        'GRAND TOTAL',
        `${inventory.length} Items`,
        '—',
        '—',
        '—',
        '—',
        Number(gInHand.toFixed(2)),
        Number(gPurchased.toFixed(2)),
        Number(gLoss.toFixed(2)),
        Number(gWeight.toFixed(2)),
        Number(gSoldQty.toFixed(2)),
        gSoldPcs,
        gInvoices,
      ];

      const rangeText =
        dateFrom || dateTo ? `${dateFrom || 'Start'} → ${dateTo || 'Today'}` : 'All Dates';

      return {
        title: bi('Daily Stock Movement Report', 'روزانہ اسٹاک موومنٹ رپورٹ', uiLanguage),
        subtitle: `Quantities Only (No Cost/Price/Amount) | Period: ${rangeText} | SKUs: ${inventory.length}`,
        headers,
        rows,
        sumColumnIndices: [6, 7, 8, 9, 10, 11, 12],
        sumColumnDecimals: { 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 0, 12: 0 } as Record<number, number>,
        exportOptions: {
          sumColumnIndices: [6, 7, 8, 9, 10, 11, 12],
          sumColumnDecimals: { 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 0, 12: 0 },
          sumColumnLabels: {
            6: 'In-Hand',
            7: 'Purchased',
            8: 'Loss',
            9: 'Total Wt',
            10: 'Sold Qty',
            11: 'Sold Pcs',
            12: 'Invoices',
          },
          hideMarkupInHeader: true,
          grandTotalRow,
          grandTotalText: `GRAND TOTAL — In-Hand: ${Number(gInHand.toFixed(2))} | Purchased: ${Number(
            gPurchased.toFixed(2)
          )} | Loss: ${Number(gLoss.toFixed(2))} | Total Weight: ${Number(
            gWeight.toFixed(2)
          )} | Sold Qty: ${Number(gSoldQty.toFixed(2))} | Sold Pcs: ${gSoldPcs} | Invoices: ${gInvoices}`,
        } as GenericReportExportOptions,
      };
    }

    if (activeTab === 'daily_amount') {
      const headers = [
        'SKU',
        'Item / Gemstone',
        'Category',
        'Sub-Category',
        'Item Unit',
        'Item Weight',
        'In-Hand Quantity',
        'Currency',
        'Original Cost Price',
        'FX Rate → PKR',
        'Total Cost (Orig.)',
        'Total Cost Amount (PKR)',
      ];

      let gInHand = 0;
      let gCostPkr = 0;

      const rows = inventory.map((item) => {
        const inHand = Number((item.stockQty ?? 0).toFixed(2));
        const unitWt = item.oneTpWeight ?? item.weightCarats ?? 0;
        const costRate =
          item.costCurrency === 'PKR'
            ? 1
            : typeof item.costExchangeRate === 'number'
              ? item.costExchangeRate
              : getRateForCurrency(item.costCurrency, profile);

        const origCostTotal = Number((item.unitCost * inHand).toFixed(2));
        const pkrUnitCost = convertToPkr(item.unitCost, item.costCurrency, costRate);
        const pkrCostTotal = Number((pkrUnitCost * inHand).toFixed(2));

        gInHand += inHand;
        gCostPkr += pkrCostTotal;

        return [
          item.sku,
          item.name || item.gemstoneType || item.subCategory || item.sku,
          item.category || '—',
          item.subCategory || '—',
          item.itemUnit || 'Carats',
          Number(unitWt.toFixed(2)),
          inHand,
          item.costCurrency,
          formatMoney(item.unitCost, item.costCurrency),
          item.costCurrency === 'PKR' ? '1' : costRate === 0 ? '0 (Own Cur)' : String(costRate),
          formatMoney(origCostTotal, item.costCurrency),
          formatMoney(pkrCostTotal, 'PKR'),
        ];
      });

      const grandTotalRow: (string | number)[] = [
        'GRAND TOTAL',
        `${inventory.length} Items`,
        '—',
        '—',
        '—',
        '—',
        Number(gInHand.toFixed(2)),
        '—',
        '—',
        '—',
        '—',
        formatMoney(gCostPkr, 'PKR'),
      ];

      const rangeText =
        dateFrom || dateTo ? `${dateFrom || 'Start'} → ${dateTo || 'Today'}` : `As of ${todayIso}`;

      return {
        title: bi('Daily Amount Wise Stock Report', 'روزانہ رقم کے حساب سے اسٹاک رپورٹ', uiLanguage),
        subtitle: `Original Cost Price Only (NO Markup) | Date: ${rangeText} | Total In-Hand Cost: ${formatMoney(
          gCostPkr,
          'PKR'
        )}`,
        headers,
        rows,
        sumColumnIndices: [6, 11],
        sumColumnDecimals: { 6: 2, 11: 2 } as Record<number, number>,
        exportOptions: {
          sumColumnIndices: [6, 11],
          sumColumnDecimals: { 6: 2, 11: 2 },
          sumColumnLabels: {
            6: 'In-Hand Qty',
            11: 'Total Cost (PKR)',
          },
          hideMarkupInHeader: true,
          grandTotalRow,
          grandTotalText: `GRAND TOTAL (All Pages) — Total In-Hand Quantity: ${Number(
            gInHand.toFixed(2)
          )}  |  Total In-Hand Stock Cost Amount: ${formatMoney(gCostPkr, 'PKR')}`,
        } as GenericReportExportOptions,
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
        title: bi('Sales Report', 'سیلز رپورٹ', uiLanguage),
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
        title: bi('Profit & Margin Report', 'منافع رپورٹ', uiLanguage),
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
        title: bi('Supplier Purchase Report', 'سپلائر خریداری رپورٹ', uiLanguage),
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
        title: bi('Fast / Slow Moving Velocity Report', 'تیز اور سست رفتار آئٹم رپورٹ', uiLanguage),
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
      title: bi('Customer Ledger Report', 'کسٹمر کھاتہ رپورٹ', uiLanguage),
      subtitle: `Unique Customers: ${rows.length} (Includes both Dispatched & Pending Dispatch invoices) | Default FX: ${defCur}=${defRate} PKR`,
      headers,
      rows,
    };
  }, [
    activeTab,
    inventory,
    filteredSales,
    filteredPurchases,
    movementStatsByKey,
    profile,
    soldInvoicesByItem,
    stockCostTotalPkr,
    dateFrom,
    dateTo,
    todayIso,
    uiLanguage,
  ]);

  const isPaginatedStockTab =
    activeTab === 'stock' || activeTab === 'daily_movement' || activeTab === 'daily_amount';
  const hideMarkupTab = isPaginatedStockTab;

  const stockNumericSize =
    stockPageSize === 'all' ? Math.max(1, reportConfig.rows.length) : Number(stockPageSize);
  const stockTotalPages = isPaginatedStockTab
    ? Math.max(1, Math.ceil(reportConfig.rows.length / stockNumericSize))
    : 1;
  const safeStockPage = Math.min(stockPage, stockTotalPages);

  const displayedRows = useMemo(() => {
    if (!isPaginatedStockTab || stockPageSize === 'all') {
      return reportConfig.rows;
    }
    const start = (safeStockPage - 1) * stockNumericSize;
    return reportConfig.rows.slice(start, start + stockNumericSize);
  }, [isPaginatedStockTab, stockPageSize, safeStockPage, stockNumericSize, reportConfig.rows]);

  const parseNumeric = (val: unknown): number => {
    const cleaned = String(val ?? '')
      .trim()
      .replace(/,/g, '')
      .replace(/[^0-9.-]/g, ' ')
      .trim()
      .split(/\s+/)[0];
    const n = Number(cleaned || 0);
    return Number.isFinite(n) ? n : 0;
  };

  const sumColumnsForRows = (rowsSubset: (string | number)[][]) => {
    const cols = reportConfig.sumColumnIndices || [];
    const decimalsMap = reportConfig.sumColumnDecimals || {};
    const out: Record<number, number> = {};
    for (const cIdx of cols) {
      const sum = rowsSubset.reduce((acc, r) => acc + parseNumeric(r[cIdx]), 0);
      const dec = decimalsMap[cIdx] ?? 2;
      out[cIdx] = Number(sum.toFixed(dec));
    }
    return out;
  };

  const pageSums = useMemo(
    () => (isPaginatedStockTab ? sumColumnsForRows(displayedRows) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPaginatedStockTab, displayedRows, reportConfig.sumColumnIndices]
  );

  const grandSums = useMemo(
    () => (isPaginatedStockTab ? sumColumnsForRows(reportConfig.rows) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPaginatedStockTab, reportConfig.rows, reportConfig.sumColumnIndices]
  );

  const isActiveTabLocked =
    (activeTab === 'daily_movement' && isFeatureLocked('daily_movement_report')) ||
    (activeTab === 'daily_amount' && isFeatureLocked('daily_amount_report')) ||
    (activeTab === 'profit' && !isProUnlocked);

  const handleExportExcel = () => {
    if (isActiveTabLocked) {
      notify('Upgrade to Pro (4500 PKR/mo) to export complete reports.', 'error');
      setActiveModule('subscription');
      return;
    }
    const defCur = profile.defaultCurrency || 'CNY';
    exportGenericReportExcel(
      reportConfig.title,
      reportConfig.headers,
      reportConfig.rows,
      [
        ['Merchant', profile.companyName],
        ['Default World Currency', defCur],
        ['Default Rate -> PKR', String(getRateForCurrency(defCur, profile))],
        ...(!hideMarkupTab
          ? ([['Default Markup %', `${profile.defaultMarkupPercent}%`]] as [string, string][])
          : []),
        ['Generated', new Date().toLocaleString()],
      ],
      reportConfig.exportOptions
    );
  };

  const handleExportPdf = () => {
    if (isActiveTabLocked) {
      notify('Upgrade to Pro (4500 PKR/mo) to export complete PDF reports.', 'error');
      setActiveModule('subscription');
      return;
    }
    exportGenericReportPdf(
      reportConfig.title,
      reportConfig.subtitle,
      reportConfig.headers,
      reportConfig.rows,
      profile,
      reportConfig.exportOptions
    );
  };

  const formatFooterCell = (colIdx: number, val: number) => {
    if (activeTab === 'daily_amount' && colIdx === 11) {
      return formatMoney(val, 'PKR');
    }
    const dec = reportConfig.sumColumnDecimals?.[colIdx] ?? 2;
    return Number(val.toFixed(dec));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {bi('Business Reports & Excel / PDF Export', 'کاروباری رپورٹس اور پی ڈی ایف ایکسپورٹ', uiLanguage)}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {bi(
              'Includes Cost-Only Stock Report, Daily Stock Movement Report & Daily Amount Wise Stock Report with page-wise & Grand Totals',
              'قیمتِ خرید اسٹاک، روزانہ موومنٹ اور روزانہ رقم کے حساب سے اسٹاک رپورٹس صفحہ وار اور گرینڈ ٹوٹل کے ساتھ',
              uiLanguage
            )}
          </p>
        </div>

        {canExport && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              {bi('Export Excel (.xlsx)', 'ایکسسل', uiLanguage)}
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 min-h-[40px]"
            >
              <FileDown className="w-4 h-4" />
              {bi('Export PDF', 'پی ڈی ایف', uiLanguage)}
            </button>
          </div>
        )}
      </div>

      {/* Report Tabs + Date Filters */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
          {(
            [
              { id: 'stock', label: bi('Stock Report (Cost)', 'اسٹاک (قیمتِ خرید)', uiLanguage), locked: false },
              {
                id: 'daily_movement',
                label: bi('Daily Stock Movement', 'روزانہ موومنٹ رپورٹ', uiLanguage),
                locked: isFeatureLocked('daily_movement_report'),
              },
              {
                id: 'daily_amount',
                label: bi('Daily Amount Wise Stock', 'روزانہ رقم اسٹاک', uiLanguage),
                locked: isFeatureLocked('daily_amount_report'),
              },
              { id: 'sales', label: bi('Sales Report', 'سیلز', uiLanguage), locked: false },
              { id: 'velocity', label: bi('Fast / Slow Chart', 'رفتار چارٹ', uiLanguage), locked: false },
              ...(canViewProfit
                ? [{ id: 'profit' as ReportTab, label: bi('Profit Report', 'منافع', uiLanguage), locked: !isProUnlocked }]
                : []),
              { id: 'purchase', label: bi('Purchase Report', 'خریداری', uiLanguage), locked: false },
              { id: 'customer', label: bi('Customer Report', 'کسٹمر', uiLanguage), locked: false },
            ] as { id: ReportTab; label: string; locked: boolean }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setStockPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab.locked && <Lock className="w-3 h-3 text-amber-600 shrink-0" />}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setDateFrom(todayIso);
              setDateTo(todayIso);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-semibold hover:bg-emerald-100"
          >
            {bi('Today', 'آج', uiLanguage)}
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {bi('All Dates', 'تمام تاریخیں', uiLanguage)}
          </button>
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

      {!isProUnlocked && !isActiveTabLocked && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-amber-950 dark:text-amber-200">
            Free / Basic Limited Reports Mode · Upgrade via EasyPaisa (03320001602) or Meezan Bank to unlock Daily Stock Movement Report &amp; Daily Amount Wise Stock Report.
          </span>
          <button
            type="button"
            onClick={() => setActiveModule('subscription')}
            className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
          >
            View Plans (4500 PKR / mo) →
          </button>
        </div>
      )}

      {/* Visual Fast/Slow Moving Item Chart when velocity tab is selected */}
      {activeTab === 'velocity' && (
        <ItemVelocityChart
          salesSource={filteredSales}
          title="Fast-Moving & Slow-Moving Item Velocity Chart"
        />
      )}

      {/* Locked Pro Report Gate */}
      {isActiveTabLocked ? (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="max-w-lg mx-auto space-y-1.5">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {bi(
                `${reportConfig.title} is Locked in Free / Basic Version`,
                'یہ مکمل رپورٹ مفت ورژن میں لاک ہے',
                uiLanguage
              )}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Basic users can access limited stock previews and company name customization. Upgrade to <strong>Monthly (4500 PKR / Month)</strong> or <strong>Yearly (35000 PKR / Year)</strong> to unlock the complete Daily Stock Movement Report, Daily Amount Wise Stock Report, PDF exports with page totals &amp; Grand Totals, and full invoicing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('subscription')}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-5 py-2.5 text-xs font-semibold text-white min-h-[42px]"
          >
            <Crown className="w-4 h-4" />
            Upgrade via EasyPaisa / Meezan Bank
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {reportConfig.title}
            </h2>
            <p className="text-xs text-slate-500">{reportConfig.subtitle}</p>
          </div>
          {isPaginatedStockTab && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {activeTab !== 'daily_movement' && (
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  Total Stock Cost: {formatMoney(stockCostTotalPkr, 'PKR')}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Rows/Page:</span>
                <select
                  value={stockPageSize}
                  onChange={(e) => {
                    setStockPageSize(e.target.value as '15' | '25' | '50' | 'all');
                    setStockPage(1);
                  }}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                >
                  <option value="15">15</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="all">All</option>
                </select>
                {stockTotalPages > 1 && (
                  <div className="flex items-center gap-1 ml-1">
                    <button
                      type="button"
                      disabled={safeStockPage <= 1}
                      onClick={() => setStockPage((p) => Math.max(1, p - 1))}
                      className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="font-mono px-1">
                      {safeStockPage}/{stockTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeStockPage >= stockTotalPages}
                      onClick={() => setStockPage((p) => Math.min(stockTotalPages, p + 1))}
                      className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
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
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={reportConfig.headers.length} className="py-10 text-center text-slate-500">
                    No records found for this date range.
                  </td>
                </tr>
              ) : (
                displayedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`py-3 px-4 whitespace-nowrap font-mono tabular-nums ${
                          activeTab === 'stock' && cIdx === 1 && cell !== '—'
                            ? 'font-bold text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>

            {/* Page-wise Total Row (Every Page) + Grand Total Row (Final Page) */}
            {isPaginatedStockTab && displayedRows.length > 0 && reportConfig.sumColumnIndices && (
              <tfoot className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs tabular-nums">
                <tr>
                  {reportConfig.headers.map((_, colIdx) => {
                    if (colIdx === 0) {
                      return (
                        <td
                          key={colIdx}
                          colSpan={2}
                          className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap"
                        >
                          Page {safeStockPage}/{stockTotalPages} Total ({displayedRows.length} items)
                        </td>
                      );
                    }
                    if (colIdx === 1) return null;
                    if (reportConfig.sumColumnIndices!.includes(colIdx)) {
                      return (
                        <td
                          key={colIdx}
                          className="py-2.5 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap"
                        >
                          {formatFooterCell(colIdx, pageSums[colIdx] ?? 0)}
                        </td>
                      );
                    }
                    return <td key={colIdx} className="py-2.5 px-4" />;
                  })}
                </tr>

                {safeStockPage === stockTotalPages && (
                  <tr className="border-t border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/35">
                    {reportConfig.headers.map((_, colIdx) => {
                      if (colIdx === 0) {
                        return (
                          <td
                            key={colIdx}
                            colSpan={2}
                            className="py-3 px-4 font-extrabold text-emerald-900 dark:text-emerald-300 whitespace-nowrap"
                          >
                            GRAND TOTAL (All {reportConfig.rows.length} Items)
                          </td>
                        );
                      }
                      if (colIdx === 1) return null;
                      if (reportConfig.sumColumnIndices!.includes(colIdx)) {
                        return (
                          <td
                            key={colIdx}
                            className="py-3 px-4 font-extrabold text-emerald-900 dark:text-emerald-300 whitespace-nowrap"
                          >
                            {formatFooterCell(colIdx, grandSums[colIdx] ?? 0)}
                          </td>
                        );
                      }
                      if (activeTab === 'stock' && colIdx === 14) {
                        return (
                          <td
                            key={colIdx}
                            className="py-3 px-4 font-extrabold text-emerald-900 dark:text-emerald-300 whitespace-nowrap"
                          >
                            {formatMoney(stockCostTotalPkr, 'PKR')}
                          </td>
                        );
                      }
                      return <td key={colIdx} className="py-3 px-4" />;
                    })}
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      </div>
      )}

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

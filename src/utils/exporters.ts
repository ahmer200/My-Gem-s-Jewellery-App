import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CompanyProfile,
  InventoryItem,
  SalesOrder,
} from '../types/business';
import {
  computeItemFinalPkr,
  convertToPkr,
  formatMoney,
  getLineItemAmounts,
  getRateForCurrency,
} from './currency';

export function buildInventoryRows(items: InventoryItem[], profile: CompanyProfile) {
  return items.map((item) => {
    const costRate =
      item.costCurrency === 'PKR'
        ? 1
        : typeof item.costExchangeRate === 'number'
          ? item.costExchangeRate
          : getRateForCurrency(item.costCurrency, profile);
    const costConverted =
      item.costCurrency !== 'PKR' && costRate === 0
        ? formatMoney(item.unitCost, item.costCurrency)
        : formatMoney(convertToPkr(item.unitCost, item.costCurrency, costRate), 'PKR');
    const sellCalc = computeItemFinalPkr(
      item.baseSellPrice,
      item.sellCurrency,
      profile,
      item.sellExchangeRate
    );
    return {
      '1. SKU': item.sku,
      '2. Size (mm)': item.sizeMm || '—',
      '3. Colour': item.colour || '—',
      '4. Shape': item.shapeCut || '—',
      '5. Sub-Category': item.subCategory || '—',
      '6. Category': item.category || '—',
      '7. Stock Pieces': item.stockPieces ?? 0,
      '8. Item Unit': item.itemUnit || 'Carats',
      '9. 1TP Weight': item.oneTpWeight ?? item.weightCarats ?? 0,
      '10. Batch #': item.batchNumber || '—',
      '11. Stock Quantity': item.stockQty,
      '12. Cent': item.cent ?? 0,
      '13. Fridge': item.fridge || '—',
      '14. Cost': `${formatMoney(item.unitCost, item.costCurrency)} (${costConverted})`,
      '15. Price': `${formatMoney(sellCalc.finalDisplayAmount, sellCalc.finalCurrency)} (Base: ${formatMoney(item.baseSellPrice, item.sellCurrency)})`,
      '16. Via (By Sea/ By Air)': item.via || '—',
      '17. Purchase Date': item.purchaseDate || '—',
      '18. Return/Loss/Damage': item.returnLossDamage || '0',
      '19. Gemstone': item.gemstoneType || '—',
      '20. Origin': item.origin || '—',
      '21. Clarity': item.clarity || '—',
      '22. Treatment': item.treatment || '—',
      '23. Cert Lab': item.certLab || '—',
      '24. Cert No.': item.certNumber || '—',
      '25. Min Alert': item.minStockAlert,
      '26. Vault / Box': item.vaultLocation || '—',
      '27. Supplier/ Carrier': item.supplierName || '—',
      '28. Remarks': item.notes || '—',
    };
  });
}

export function exportInventoryExcel(items: InventoryItem[], profile: CompanyProfile) {
  const rows = buildInventoryRows(items, profile);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  XLSX.writeFile(wb, `NA_GEMS_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportInventoryCsv(items: InventoryItem[], profile: CompanyProfile) {
  const rows = buildInventoryRows(items, profile);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `NA_GEMS_Inventory_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportInventoryPdf(items: InventoryItem[], profile: CompanyProfile) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(13);
  doc.text(`Aqsa Business Management System — ${profile.companyName}`, 10, 12);
  doc.setFontSize(8.5);
  const defaultCur = profile.defaultCurrency || 'CNY';
  const defaultRate = getRateForCurrency(defaultCur, profile);
  doc.text(
    `Inventory & Stock Report | Active FX (${defaultCur}→PKR): ${defaultRate} | Markup: ${profile.defaultMarkupPercent}% | Generated: ${new Date().toLocaleDateString()}`,
    10,
    18
  );

  const head = [
    [
      '1.SKU',
      '2.Size',
      '3.Colour',
      '4.Shape',
      '5.Sub-Cat',
      '6.Category',
      '7.Pcs',
      '8.Unit',
      '9.1TP Wt',
      '10.Batch#',
      '11.Qty',
      '12.Cent',
      '13.Fridge',
      '14.Cost',
      '15.Price',
      '16.Via',
      '17.PurDate',
      '18.Ret/Dmg',
      '19.Gem',
      '20.Origin',
      '21.Clarity',
      '22.Treat',
      '23.Lab',
      '24.Cert#',
      '25.Min',
      '26.Vault',
      '27.Supplier',
      '28.Remarks',
    ],
  ];

  const body = items.map((i) => {
    const sellCalc = computeItemFinalPkr(i.baseSellPrice, i.sellCurrency, profile, i.sellExchangeRate);
    return [
      i.sku,
      i.sizeMm || '—',
      i.colour || '—',
      i.shapeCut || '—',
      i.subCategory || '—',
      i.category || '—',
      String(i.stockPieces ?? 0),
      i.itemUnit || '—',
      String(i.oneTpWeight ?? i.weightCarats ?? 0),
      i.batchNumber || '—',
      String(i.stockQty),
      String(i.cent ?? 0),
      i.fridge || '—',
      `${i.unitCost} ${i.costCurrency}`,
      `${sellCalc.finalDisplayAmount.toFixed(0)} ${sellCalc.finalCurrency}`,
      i.via || '—',
      i.purchaseDate || '—',
      i.returnLossDamage || '0',
      i.gemstoneType || '—',
      i.origin || '—',
      i.clarity || '—',
      i.treatment || '—',
      i.certLab || '—',
      i.certNumber || '—',
      String(i.minStockAlert),
      i.vaultLocation || '—',
      i.supplierName || '—',
      i.notes || '—',
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: 22,
    margin: { left: 8, right: 8 },
    styles: { fontSize: 4.8, cellPadding: 0.9, overflow: 'linebreak' },
    headStyles: { fillColor: [6, 78, 59], textColor: 255, fontSize: 4.8 },
  });

  doc.save(`NA_GEMS_Inventory_28Col_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function buildInvoicePdfDoc(
  order: SalesOrder,
  profile: CompanyProfile,
  withAutoPrint = false
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text(profile.companyName, 14, 14);
  doc.setFontSize(9.5);
  doc.text(profile.subtitle, 14, 20);
  doc.setFontSize(8.5);
  doc.text(`${profile.address} | ${profile.contact}`, 14, 26);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.text(`INVOICE: ${order.invoiceNo}`, 14, 43);
  doc.setFontSize(9.5);
  doc.text(`Date: ${order.orderDate}`, 150, 43);

  doc.text(`Customer: ${order.customerName}`, 14, 51);
  doc.text(`Contact: ${order.customerPhone || 'N/A'}`, 14, 56);
  doc.text(`Address: ${order.customerAddress || 'N/A'}`, 14, 61);
  doc.text(`Payment Status: ${order.paymentStatus}`, 150, 51);
  doc.text('Ahmer Iqbal', 150, 56);
  doc.text(
    order.dispatchStatus === 'Dispatched'
      ? `Dispatch: Dispatched (Arrives: ${order.expectedArrivalDate || 'N/A'})`
      : 'Dispatch: Pending Dispatch',
    14,
    66
  );

  const rateFactor =
    order.sourceCurrency !== order.finalCurrency && order.exchangeRateApplied > 0
      ? order.exchangeRateApplied
      : 1;

  autoTable(doc, {
    startY: 72,
    head: [
      [
        'SKU',
        'Product & Gemstone Details',
        'Cert #',
        'Qty',
        `Unit (${order.finalCurrency})`,
        `Total (${order.finalCurrency})`,
      ],
    ],
    body: order.items.map((item) => {
      const { percentUsed, lineTotalOrig } = getLineItemAmounts(
        item,
        order.markupPercentUsed
      );
      const finalUnitPrice =
        item.unitPriceOrig * (1 + percentUsed / 100) * rateFactor;
      const finalLineTotal = lineTotalOrig * rateFactor;
      return [
        item.sku,
        `${item.productName}\n${item.gemstoneDetails}`,
        item.certNumber || '—',
        String(item.quantity),
        formatMoney(finalUnitPrice, order.finalCurrency),
        formatMoney(finalLineTotal, order.finalCurrency),
      ];
    }),
    styles: { fontSize: 8.2, cellPadding: 2.3 },
    headStyles: { fillColor: [6, 78, 59], textColor: 255 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 125;
  const boxY = Math.min(finalY + 8, 232);

  doc.setDrawColor(167, 243, 208);
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(112, boxY, 84, 38, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Courier Charges: + ${formatMoney(order.courierCharges || 0, order.finalCurrency)}`,
    116,
    boxY + 8
  );
  doc.text(`Paid (PKR Eqv): ${formatMoney(order.paidAmountPkr, 'PKR')}`, 116, boxY + 15);
  const duePkr = Math.max(0, order.finalTotalPkrEquivalent - order.paidAmountPkr);
  doc.text(`Balance Due (PKR Eqv): ${formatMoney(duePkr, 'PKR')}`, 116, boxY + 22);
  doc.setFontSize(11.5);
  doc.setTextColor(6, 78, 59);
  doc.text(`FINAL TOTAL: ${formatMoney(order.finalTotal, order.finalCurrency)}`, 116, boxY + 32);

  if (order.notes) {
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Note: ${order.notes}`, 14, Math.min(boxY + 46, 272));
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(profile.invoiceFooter, 14, 280);
  doc.text('Computer generated invoice — no signature required.', 14, 285);

  if (withAutoPrint) {
    doc.autoPrint();
  }
  return doc;
}

export function exportInvoicePdf(order: SalesOrder, profile: CompanyProfile) {
  const doc = buildInvoicePdfDoc(order, profile, false);
  doc.save(`${order.invoiceNo}_${profile.companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

export function getInvoicePdfPreviewUrl(
  order: SalesOrder,
  profile: CompanyProfile,
  withAutoPrint = false
): string {
  const doc = buildInvoicePdfDoc(order, profile, withAutoPrint);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

export function exportGenericReportExcel(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  metaRows: [string, string][]
) {
  const wb = XLSX.utils.book_new();
  const sheetData: (string | number)[][] = [
    [title],
    ...metaRows.map(([k, v]) => [k, v]),
    [],
    headers,
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  const safeName = title.replace(/[^a-zA-Z0-9]+/g, '_');
  XLSX.writeFile(wb, `${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportGenericReportPdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  profile: CompanyProfile
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.setTextColor(6, 78, 59);
  doc.text(`${profile.companyName} — ${title}`, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(subtitle, 14, 20);
  const defaultCur = profile.defaultCurrency || 'CNY';
  const defaultRate = getRateForCurrency(defaultCur, profile);
  doc.text(
    `Active FX: ${defaultCur}→PKR ${defaultRate} | Default Markup: ${profile.defaultMarkupPercent}% | Aqsa Business Management System`,
    14,
    25
  );

  const isWide = headers.length > 18;
  autoTable(doc, {
    startY: 30,
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c))),
    margin: isWide ? { left: 8, right: 8 } : undefined,
    styles: {
      fontSize: isWide ? 4.8 : 7.5,
      cellPadding: isWide ? 0.9 : 2,
      overflow: 'linebreak',
    },
    headStyles: { fillColor: [6, 78, 59], textColor: 255, fontSize: isWide ? 4.8 : 7.5 },
  });

  const safeName = title.replace(/[^a-zA-Z0-9]+/g, '_');
  doc.save(`${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

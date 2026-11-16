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
    const costRate = getRateForCurrency(item.costCurrency, profile.rmbToPkr, profile.usdToPkr);
    const costPkr = convertToPkr(item.unitCost, item.costCurrency, profile.rmbToPkr, profile.usdToPkr);
    const sellCalc = computeItemFinalPkr(item.baseSellPrice, item.sellCurrency, profile);
    return {
      '1. SKU / Barcode': item.sku,
      '2. Product Name': item.name,
      '3. Category': item.category,
      '4. Gemstone Type': item.gemstoneType,
      '5. Origin': item.origin,
      '6. Shape / Cut': item.shapeCut,
      '7. Colour': item.colour,
      '8. Clarity': item.clarity,
      '9. Weight (ct)': item.weightCarats,
      '10. Size (mm)': item.sizeMm,
      '11. Treatment': item.treatment,
      '12. Cert Lab': item.certLab,
      '13. Cert Number': item.certNumber,
      '14. Stock Qty': item.stockQty,
      '15. Min Alert': item.minStockAlert,
      '16. Box / Vault': item.vaultLocation,
      '17. Supplier': item.supplierName,
      '18. Cost Currency': item.costCurrency,
      '19. Unit Cost (Orig.)': `${item.unitCost.toFixed(2)} ${item.costCurrency} (@${costRate})`,
      '20. Cost (PKR)': Number(costPkr.toFixed(2)),
      '21. Base Sell Price': `${item.baseSellPrice.toFixed(2)} ${item.sellCurrency}`,
      '22. Final PKR (w/ Markup)': `${sellCalc.finalPkr.toFixed(2)} PKR (${profile.defaultMarkupPercent}%)`,
    };
  });
}

export function exportInventoryExcel(items: InventoryItem[], profile: CompanyProfile) {
  const rows = buildInventoryRows(items, profile);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory 22-Col');
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
  doc.setFontSize(14);
  doc.text(`Aqsa Business Management System — ${profile.companyName}`, 14, 14);
  doc.setFontSize(9);
  doc.text(
    `22-Column Inventory Report | RMB->PKR: ${profile.rmbToPkr} | USD->PKR: ${profile.usdToPkr} | Markup: ${profile.defaultMarkupPercent}% | Generated: ${new Date().toLocaleDateString()}`,
    14,
    20
  );

  const head = [
    [
      'SKU',
      'Name',
      'Category',
      'Gem',
      'Origin',
      'Cut',
      'Colour',
      'Clarity',
      'Wt(ct)',
      'Size',
      'Treat.',
      'Lab',
      'Cert#',
      'Qty',
      'Min',
      'Vault',
      'Supplier',
      'CostCur',
      'Cost',
      'SellCur',
      'BaseSell',
      'Final PKR',
    ],
  ];

  const body = items.map((i) => {
    const sellCalc = computeItemFinalPkr(i.baseSellPrice, i.sellCurrency, profile);
    return [
      i.sku,
      i.name,
      i.category,
      i.gemstoneType,
      i.origin,
      i.shapeCut,
      i.colour,
      i.clarity,
      i.weightCarats.toFixed(2),
      i.sizeMm,
      i.treatment,
      i.certLab,
      i.certNumber,
      String(i.stockQty),
      String(i.minStockAlert),
      i.vaultLocation,
      i.supplierName,
      i.costCurrency,
      `${i.unitCost}`,
      i.sellCurrency,
      `${i.baseSellPrice}`,
      `${sellCalc.finalPkr.toFixed(0)}`,
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: 25,
    styles: { fontSize: 5.8, cellPadding: 1.2 },
    headStyles: { fillColor: [6, 78, 59], textColor: 255 },
  });

  doc.save(`NA_GEMS_Inventory_22Col_${new Date().toISOString().slice(0, 10)}.pdf`);
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
  doc.text(`Prepared By: ${order.createdBy}`, 150, 56);

  autoTable(doc, {
    startY: 68,
    head: [
      [
        'SKU',
        'Product & Gemstone Details',
        'Cert #',
        'Qty',
        `Unit (${order.sourceCurrency})`,
        'Item %',
        `Total w/ % (${order.sourceCurrency})`,
      ],
    ],
    body: order.items.map((item) => {
      const { percentUsed, lineTotalOrig } = getLineItemAmounts(
        item,
        order.markupPercentUsed
      );
      return [
        item.sku,
        `${item.productName}\n${item.gemstoneDetails}`,
        item.certNumber || '—',
        String(item.quantity),
        formatMoney(item.unitPriceOrig, order.sourceCurrency),
        `+${percentUsed}%`,
        formatMoney(lineTotalOrig, order.sourceCurrency),
      ];
    }),
    styles: { fontSize: 8.2, cellPadding: 2.3 },
    headStyles: { fillColor: [6, 78, 59], textColor: 255 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 125;
  const boxY = finalY + 8;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, boxY, 182, 46, 2, 2, 'FD');

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Currency & Percentage Calculation Breakdown', 18, boxY + 7);
  doc.setFontSize(8.5);
  doc.text(`Currency Used: ${order.sourceCurrency}`, 18, boxY + 14);
  doc.text(
    order.rmbRateUsed === 0
      ? `Exchange Rate Applied: RMB Rate = 0 (Original Currency Mode — ${order.finalCurrency})`
      : `Exchange Rate Applied: 1 ${order.sourceCurrency} = ${order.exchangeRateApplied.toFixed(2)} PKR`,
    18,
    boxY + 20
  );
  doc.text(`Percentage Markup Applied: ${order.markupPercentUsed}%`, 18, boxY + 26);
  doc.text(`Base Amount: ${formatMoney(order.baseSubtotal, order.sourceCurrency)}`, 18, boxY + 32);
  doc.text(
    `Converted Amount: ${order.rmbRateUsed === 0 && order.sourceCurrency !== 'PKR' ? `Original Currency (${order.finalCurrency})` : formatMoney(order.convertedAmountPkr, 'PKR')}`,
    18,
    boxY + 38
  );

  doc.setFontSize(12);
  doc.setTextColor(6, 78, 59);
  doc.text(`FINAL TOTAL: ${formatMoney(order.finalTotal, order.finalCurrency)}`, 122, boxY + 26);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Paid (PKR Eqv): ${formatMoney(order.paidAmountPkr, 'PKR')}`, 122, boxY + 34);
  const duePkr = Math.max(0, order.finalTotalPkrEquivalent - order.paidAmountPkr);
  doc.text(`Balance Due (PKR Eqv): ${formatMoney(duePkr, 'PKR')}`, 122, boxY + 40);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(profile.invoiceFooter, 14, 282);

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
  doc.text(
    `Saved FX: RMB->PKR ${profile.rmbToPkr} | USD->PKR ${profile.usdToPkr} | Default Markup: ${profile.defaultMarkupPercent}% | Aqsa Business Management System`,
    14,
    25
  );

  autoTable(doc, {
    startY: 30,
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [6, 78, 59], textColor: 255 },
  });

  const safeName = title.replace(/[^a-zA-Z0-9]+/g, '_');
  doc.save(`${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

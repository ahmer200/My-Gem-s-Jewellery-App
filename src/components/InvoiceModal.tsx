import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Eye, FileDown, MessageCircle, Printer, X } from 'lucide-react';
import { SalesOrder } from '../types/business';
import { useBusiness } from '../context/BusinessContext';
import { formatMoney } from '../utils/currency';
import { exportInvoicePdf, getInvoicePdfPreviewUrl } from '../utils/exporters';

interface InvoiceModalProps {
  order: SalesOrder;
  onClose: () => void;
}

declare global {
  interface Window {
    AqsaAndroidBridge?: {
      printCurrentPage?: (jobTitle: string) => void;
    };
  }
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, onClose }) => {
  const { profile, notify } = useBusiness();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [viewMode, setViewMode] = useState<'sheet' | 'pdfPreview'>('sheet');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const verifyPayload = `${profile.companyName} | ${order.invoiceNo} | ${order.orderDate} | Total: ${formatMoney(order.finalTotal, order.finalCurrency)}`;
    QRCode.toDataURL(verifyPayload, { width: 120, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [order, profile.companyName]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  const duePkr = Math.max(0, order.finalTotalPkrEquivalent - order.paidAmountPkr);

  const shareWhatsApp = () => {
    const cleanPhone = (order.customerPhone || '').replace(/[^\d]/g, '');
    const msg = encodeURIComponent(
      `Assalam-o-Alaikum ${order.customerName},\n\nInvoice from *${profile.companyName}* (${profile.subtitle})\nInvoice No: ${order.invoiceNo}\nDate: ${order.orderDate}\nCurrency Used: ${order.sourceCurrency}\nExchange Rate Applied: ${order.rmbRateUsed === 0 ? 'RMB=0 (Original Currency Mode)' : `1 ${order.sourceCurrency} = ${order.exchangeRateApplied} PKR`}\nMarkup Applied: ${order.markupPercentUsed}%\n*Final Total: ${formatMoney(order.finalTotal, order.finalCurrency)}*\nStatus: ${order.paymentStatus}\n\nThank you for your business!`
    );
    window.open(cleanPhone ? `https://wa.me/${cleanPhone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
  };

  const openPdfPrintPreview = (autoPrintFlag = false) => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    const url = getInvoicePdfPreviewUrl(order, profile, autoPrintFlag);
    setPdfPreviewUrl(url);
    setViewMode('pdfPreview');
  };

  const triggerIframePrint = () => {
    if (!sheetRef.current) return false;
    try {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const doc = printFrame.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(printFrame);
        return false;
      }

      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((el) => el.outerHTML)
        .join('\n');

      doc.open();
      doc.write(`<!doctype html><html><head><title>${order.invoiceNo} - ${profile.companyName}</title>${styles}<style>@page{margin:12mm;size:A4 portrait;}body{background:#fff !important;color:#0f172a !important;padding:0;margin:0;}</style></head><body>${sheetRef.current.outerHTML}</body></html>`);
      doc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch {
          // Ignore print dialog failure in restricted frames
        } finally {
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
          }, 1500);
        }
      }, 250);
      return true;
    } catch {
      return false;
    }
  };

  const handlePrintInvoice = () => {
    // 1. Native Android APK PrintManager bridge
    if (window.AqsaAndroidBridge?.printCurrentPage) {
      window.AqsaAndroidBridge.printCurrentPage(`${order.invoiceNo}_${profile.companyName}`);
      return;
    }

    // 2. Always generate & display the live A4 PDF Print Preview (works even in sandboxed iframes)
    openPdfPrintPreview(true);

    // 3. Also attempt isolated iframe print + window.print() for standard desktop/mobile browsers
    const framed = triggerIframePrint();
    if (!framed) {
      try {
        window.print();
      } catch {
        // Ignore if blocked by sandbox
      }
    }
    notify('A4 Print Preview opened. Use the print button in the preview or Save PDF.', 'info');
  };

  return (
    <div className="print-modal-root fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 md:p-6 overflow-y-auto">
      <div className="print-modal-card w-full max-w-3xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl my-auto overflow-hidden">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              {viewMode === 'pdfPreview' ? 'A4 Print Preview (PDF)' : 'Official Invoice Preview'}
            </span>
            <span className="text-xs text-slate-500 font-mono">{order.invoiceNo}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                viewMode === 'sheet' ? openPdfPrintPreview(false) : setViewMode('sheet')
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[38px]"
            >
              <Eye className="w-3.5 h-3.5" />
              {viewMode === 'sheet' ? 'A4 Print Preview' : 'Invoice View'}
            </button>
            <button
              type="button"
              onClick={shareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700 whitespace-nowrap shrink-0 min-h-[38px]"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp Bill
            </button>
            <button
              type="button"
              onClick={() => exportInvoicePdf(order, profile)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[38px]"
            >
              <FileDown className="w-3.5 h-3.5" />
              Save PDF
            </button>
            <button
              type="button"
              onClick={handlePrintInvoice}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-emerald-700 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[38px]"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Invoice
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
              aria-label="Close invoice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live A4 PDF Print Preview */}
        {viewMode === 'pdfPreview' && pdfPreviewUrl && (
          <div className="no-print bg-slate-200 dark:bg-slate-950 p-3 md:p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 px-1">
              <span>
                Use the print icon inside the A4 preview toolbar below, or click <strong>Save PDF</strong> to print from your device.
              </span>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.print();
                  } catch {
                    // Ignore if blocked
                  }
                }}
                className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
              >
                Browser System Print
              </button>
            </div>
            <iframe
              src={pdfPreviewUrl}
              title={`Print preview for ${order.invoiceNo}`}
              className="w-full h-[70vh] rounded-lg border border-slate-300 dark:border-slate-800 bg-white"
            />
          </div>
        )}

        {/* Printable Invoice Sheet */}
        <div
          ref={sheetRef}
          className={`print-sheet p-6 md:p-8 bg-white text-slate-900 space-y-6 ${
            viewMode === 'pdfPreview' ? 'hidden print:block' : ''
          }`}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div className="flex items-start gap-4">
              {profile.logoDataUrl && (
                <img
                  src={profile.logoDataUrl}
                  alt={profile.companyName}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                />
              )}
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-emerald-900">
                  {profile.companyName}
                </h2>
                <p className="text-xs font-medium text-amber-800">{profile.subtitle}</p>
                <p className="text-xs text-slate-600 mt-1 max-w-md">{profile.address}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Tel: {profile.contact} · Email: {profile.email} · {profile.ntn}
                </p>
              </div>
            </div>

            <div className="flex sm:flex-col items-end justify-between gap-2 text-right">
              <div>
                <p className="text-xs font-semibold text-slate-500">TAX / TRADE INVOICE</p>
                <p className="font-mono text-lg font-bold text-slate-900">{order.invoiceNo}</p>
                <p className="text-xs text-slate-600">Date: {order.orderDate}</p>
                <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                  Status: {order.paymentStatus}
                </p>
              </div>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="Invoice verification QR" className="w-16 h-16 border border-slate-200 rounded" />
              )}
            </div>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <p className="font-semibold text-slate-500">BILL TO CUSTOMER</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{order.customerName}</p>
              <p className="text-slate-600">Phone: {order.customerPhone || '—'}</p>
              <p className="text-slate-600">Address: {order.customerAddress || '—'}</p>
            </div>
            <div className="sm:text-right">
              <p className="font-semibold text-slate-500">SYSTEM & OPERATOR</p>
              <p className="text-slate-800 font-medium mt-1">Aqsa Business Management System</p>
              <p className="text-slate-600">Prepared by: {order.createdBy}</p>
              <p className="text-slate-600">
                Bill Currency: <strong className="text-slate-900">{order.finalCurrency}</strong>
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-emerald-800 text-slate-700">
                  <th className="py-2.5 pr-3 font-semibold">SKU</th>
                  <th className="py-2.5 pr-3 font-semibold">Gemstone / Jewelry Description</th>
                  <th className="py-2.5 pr-3 font-semibold">Cert #</th>
                  <th className="py-2.5 pr-3 font-semibold text-right">Qty</th>
                  <th className="py-2.5 pr-3 font-semibold text-right">
                    Unit ({order.sourceCurrency})
                  </th>
                  <th className="py-2.5 font-semibold text-right">
                    Subtotal ({order.sourceCurrency})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {order.items.map((item, idx) => (
                  <tr key={`${item.inventoryId}-${idx}`}>
                    <td className="py-2.5 pr-3 font-mono text-slate-700 whitespace-nowrap">
                      {item.sku}
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-slate-900">{item.productName}</p>
                      <p className="text-[11px] text-slate-500">{item.gemstoneDetails}</p>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-slate-600 whitespace-nowrap">
                      {item.certNumber || '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono">{item.quantity}</td>
                    <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap">
                      {formatMoney(item.unitPriceOrig, order.sourceCurrency)}
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold whitespace-nowrap">
                      {formatMoney(item.unitPriceOrig * item.quantity, order.sourceCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mandatory Currency & Percentage Calculation Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1.5">
              <p className="font-semibold text-slate-900">
                Currency & Percentage Calculation Details
              </p>
              <div className="flex justify-between">
                <span className="text-slate-600">Currency Used for Entry:</span>
                <span className="font-mono font-semibold">{order.sourceCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Exchange Rate Applied:</span>
                <span className="font-mono font-semibold">
                  {order.rmbRateUsed === 0 && order.sourceCurrency !== 'PKR'
                    ? `RMB = 0 (Original ${order.finalCurrency})`
                    : `1 ${order.sourceCurrency} = ${order.exchangeRateApplied.toFixed(2)} PKR`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Percentage Markup Used:</span>
                <span className="font-mono font-semibold">{order.markupPercentUsed}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Base Subtotal:</span>
                <span className="font-mono">{formatMoney(order.baseSubtotal, order.sourceCurrency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Converted Amount:</span>
                <span className="font-mono">
                  {order.rmbRateUsed === 0 && order.sourceCurrency !== 'PKR'
                    ? `No PKR Conversion (${order.finalCurrency})`
                    : formatMoney(order.convertedAmountPkr, 'PKR')}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 text-xs space-y-2 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    Markup ({order.markupPercentUsed}%):
                  </span>
                  <span className="font-mono">
                    + {formatMoney(order.markupAmount, order.finalCurrency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Paid (PKR Equivalent):</span>
                  <span className="font-mono">{formatMoney(order.paidAmountPkr, 'PKR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Balance Due (PKR Equivalent):</span>
                  <span className="font-mono font-semibold text-amber-700">
                    {formatMoney(duePkr, 'PKR')}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200 flex items-baseline justify-between">
                <span className="text-sm font-bold text-emerald-950">FINAL BILL TOTAL</span>
                <span className="font-mono text-xl font-extrabold text-emerald-800">
                  {formatMoney(order.finalTotal, order.finalCurrency)}
                </span>
              </div>
            </div>
          </div>

          {order.notes && (
            <p className="text-xs text-slate-600 italic">Note: {order.notes}</p>
          )}

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>{profile.invoiceFooter}</span>
            <span>Authorized Signature: ______________________</span>
          </div>
        </div>
      </div>
    </div>
  );
};

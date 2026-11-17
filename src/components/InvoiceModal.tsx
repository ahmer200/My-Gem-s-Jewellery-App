import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Edit3, Eye, FileDown, Lock, MessageCircle, Printer, Truck, X } from 'lucide-react';
import { SalesOrder } from '../types/business';
import { useBusiness } from '../context/BusinessContext';
import { formatMoney, getLineItemAmounts } from '../utils/currency';
import { exportInvoicePdf, getInvoicePdfPreviewUrl } from '../utils/exporters';
import { DispatchConfirmModal } from './DispatchConfirmModal';

interface InvoiceModalProps {
  order: SalesOrder;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, onClose }) => {
  const {
    profile,
    sales,
    dispatchSale,
    openSaleForEdit,
    hasPermission,
    notify,
  } = useBusiness();
  const currentOrder = sales.find((s) => s.id === order.id) || order;
  const isDispatched = currentOrder.dispatchStatus === 'Dispatched';
  const canEditSales = hasPermission('create_sales');

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [viewMode, setViewMode] = useState<'sheet' | 'pdfPreview'>('sheet');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const verifyPayload = `${profile.companyName} | ${currentOrder.invoiceNo} | ${currentOrder.orderDate} | Total: ${formatMoney(currentOrder.finalTotal, currentOrder.finalCurrency)}`;
    QRCode.toDataURL(verifyPayload, { width: 120, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [currentOrder, profile.companyName]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  const duePkr = Math.max(0, currentOrder.finalTotalPkrEquivalent - currentOrder.paidAmountPkr);

  const shareWhatsApp = () => {
    const cleanPhone = (currentOrder.customerPhone || '').replace(/[^\d]/g, '');
    const dispatchLine = isDispatched
      ? `\nDispatch: Dispatched (Expected Arrival: ${currentOrder.expectedArrivalDate || 'N/A'})`
      : '\nDispatch: Pending Dispatch';
    const msg = encodeURIComponent(
      `Assalam-o-Alaikum ${currentOrder.customerName},\n\nInvoice from *${profile.companyName}* (${profile.subtitle})\nInvoice No: ${currentOrder.invoiceNo}\nDate: ${currentOrder.orderDate}\nCourier Charges: ${formatMoney(currentOrder.courierCharges || 0, currentOrder.finalCurrency)}\n*Final Total: ${formatMoney(currentOrder.finalTotal, currentOrder.finalCurrency)}*\nStatus: ${currentOrder.paymentStatus}${dispatchLine}\n\nThank you for your business!`
    );
    window.open(cleanPhone ? `https://wa.me/${cleanPhone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
  };

  const openPdfPrintPreview = (autoPrintFlag = false) => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    const url = getInvoicePdfPreviewUrl(currentOrder, profile, autoPrintFlag);
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
      doc.write(`<!doctype html><html><head><title>${currentOrder.invoiceNo} - ${profile.companyName}</title>${styles}<style>@page{margin:12mm;size:A4 portrait;}body{background:#fff !important;color:#0f172a !important;padding:0;margin:0;}</style></head><body>${sheetRef.current.outerHTML}</body></html>`);
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
      window.AqsaAndroidBridge.printCurrentPage(`${currentOrder.invoiceNo}_${profile.companyName}`);
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
            <span className="text-xs text-slate-500 font-mono">{currentOrder.invoiceNo}</span>
            {isDispatched && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEditSales && !isDispatched && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    openSaleForEdit(currentOrder.id);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[38px]"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0 min-h-[38px]"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Dispatch
                </button>
              </>
            )}
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
              onClick={() => exportInvoicePdf(currentOrder, profile)}
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
              title={`Print preview for ${currentOrder.invoiceNo}`}
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
                <p className="font-mono text-lg font-bold text-slate-900">{currentOrder.invoiceNo}</p>
                <p className="text-xs text-slate-600">Date: {currentOrder.orderDate}</p>
                <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                  Payment: {currentOrder.paymentStatus}
                </p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">
                  Dispatch:{' '}
                  {isDispatched
                    ? `Dispatched (Arrives: ${currentOrder.expectedArrivalDate || '—'})`
                    : 'Pending Dispatch (Editable)'}
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
              <p className="text-sm font-bold text-slate-900 mt-1">{currentOrder.customerName}</p>
              <p className="text-slate-600">Phone: {currentOrder.customerPhone || '—'}</p>
              <p className="text-slate-600">Address: {currentOrder.customerAddress || '—'}</p>
            </div>
            <div className="sm:text-right">
              <p className="font-semibold text-slate-500">SYSTEM & DISPATCH</p>
              <p className="text-slate-800 font-medium mt-1">Aqsa Business Management System</p>
              <p className="text-slate-700 font-medium">Ahmer Iqbal</p>
              <p className="text-slate-600">
                Bill Currency: <strong className="text-slate-900">{currentOrder.finalCurrency}</strong>
              </p>
              {isDispatched && currentOrder.expectedArrivalDate && (
                <p className="text-emerald-800 font-medium">
                  Parcel Arrival Date: <span className="font-mono">{currentOrder.expectedArrivalDate}</span>
                </p>
              )}
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
                    Unit ({currentOrder.finalCurrency})
                  </th>
                  <th className="py-2.5 font-semibold text-right">
                    Total ({currentOrder.finalCurrency})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentOrder.items.map((item, idx) => {
                  const { percentUsed, lineTotalOrig } = getLineItemAmounts(
                    item,
                    currentOrder.markupPercentUsed
                  );
                  const rateFactor =
                    currentOrder.sourceCurrency !== currentOrder.finalCurrency &&
                    currentOrder.exchangeRateApplied > 0
                      ? currentOrder.exchangeRateApplied
                      : 1;
                  const finalUnitPrice =
                    item.unitPriceOrig * (1 + percentUsed / 100) * rateFactor;
                  const finalLineTotal = lineTotalOrig * rateFactor;

                  return (
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
                        {formatMoney(finalUnitPrice, currentOrder.finalCurrency)}
                      </td>
                      <td className="py-2.5 text-right font-mono whitespace-nowrap font-semibold text-slate-900">
                        {formatMoney(finalLineTotal, currentOrder.finalCurrency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end pt-2">
            <div className="w-full md:w-1/2 p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 text-xs space-y-2 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Courier Charges:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    + {formatMoney(currentOrder.courierCharges || 0, currentOrder.finalCurrency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Paid (PKR Equivalent):</span>
                  <span className="font-mono">{formatMoney(currentOrder.paidAmountPkr, 'PKR')}</span>
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
                  {formatMoney(currentOrder.finalTotal, currentOrder.finalCurrency)}
                </span>
              </div>
            </div>
          </div>

          {currentOrder.notes && (
            <p className="text-xs text-slate-600 italic">Note: {currentOrder.notes}</p>
          )}

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>{profile.invoiceFooter}</span>
            <span>Computer generated invoice — no signature required.</span>
          </div>
        </div>
      </div>

      {showDispatchModal && (
        <DispatchConfirmModal
          order={currentOrder}
          onClose={() => setShowDispatchModal(false)}
          onConfirm={(arrivalDate) => {
            dispatchSale(currentOrder.id, arrivalDate);
            setShowDispatchModal(false);
          }}
        />
      )}
    </div>
  );
};

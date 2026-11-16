import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, X } from 'lucide-react';
import { InventoryItem } from '../types/business';
import { useBusiness } from '../context/BusinessContext';
import { computeItemFinalPkr, formatMoney } from '../utils/currency';

interface QrTagModalProps {
  item: InventoryItem;
  onClose: () => void;
}

export const QrTagModal: React.FC<QrTagModalProps> = ({ item, onClose }) => {
  const { profile } = useBusiness();
  const [qrUrl, setQrUrl] = useState<string>('');
  const calc = computeItemFinalPkr(
    item.baseSellPrice,
    item.sellCurrency,
    profile,
    item.sellExchangeRate
  );

  useEffect(() => {
    const payload = JSON.stringify({
      sku: item.sku,
      name: item.name,
      cert: item.certNumber,
      wt: item.weightCarats,
      merchant: profile.companyName,
    });
    QRCode.toDataURL(payload, { width: 220, margin: 1 })
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
  }, [item, profile.companyName]);

  const handleDownload = () => {
    if (!qrUrl) return;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `${item.sku}_QR_Tag.png`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Gemstone QR Label — {item.sku}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center">
          <div className="print-sheet border border-slate-300 dark:border-slate-700 rounded-lg p-5 bg-white text-slate-900 w-full max-w-xs">
            <p className="text-xs font-bold tracking-wide text-emerald-800">{profile.companyName}</p>
            <p className="text-[11px] text-slate-500 mb-3">Certified Gemstone Tag</p>
            {qrUrl ? (
              <img src={qrUrl} alt={`QR code for ${item.sku}`} className="w-40 h-40 mx-auto" />
            ) : (
              <div className="w-40 h-40 mx-auto bg-slate-100 animate-pulse rounded" />
            )}
            <p className="mt-3 font-mono text-sm font-bold">{item.sku}</p>
            <p className="text-xs font-semibold truncate">{item.name}</p>
            <p className="text-[11px] text-slate-600 mt-1">
              {item.weightCarats} ct · {item.colour} · {item.certLab} {item.certNumber}
            </p>
            <p className="mt-2 font-mono text-xs font-bold text-emerald-800">
              {formatMoney(calc.finalDisplayAmount, calc.finalCurrency)}
            </p>
          </div>
        </div>

        <div className="no-print flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px]"
          >
            <Download className="w-4 h-4" />
            Save PNG
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.AqsaAndroidBridge?.printCurrentPage) {
                window.AqsaAndroidBridge.printCurrentPage(`${item.sku}_QR_Label`);
                return;
              }
              window.print();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-xs font-medium text-white hover:bg-emerald-800 min-h-[40px]"
          >
            <Printer className="w-4 h-4" />
            Print Label
          </button>
        </div>
      </div>
    </div>
  );
};

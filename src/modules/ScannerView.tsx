import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Gem, Plus, QrCode, Search, ShoppingCart } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { computeItemFinalPkr, formatMoney } from '../utils/currency';

export const ScannerView: React.FC = () => {
  const {
    inventory,
    profile,
    updateInventoryItem,
    setPosQueuedSku,
    setActiveModule,
    notify,
  } = useBusiness();

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scannedSku, setScannedSku] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const isMountedRef = useRef(true);

  const matchedItem = inventory.find(
    (i) => i.sku.toLowerCase() === (scannedSku || '').toLowerCase()
  );

  const handleDecodedText = (decoded: string) => {
    let extractedSku = decoded.trim();
    try {
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed.sku === 'string') {
        extractedSku = parsed.sku;
      }
    } catch {
      // Raw barcode / SKU string
    }
    setScannedSku(extractedSku);
    const found = inventory.find(
      (i) => i.sku.toLowerCase() === extractedSku.toLowerCase()
    );
    if (found) {
      notify(`Scanned ${found.sku} — ${found.name}`);
    } else {
      notify(`Scanned code "${extractedSku}" (not in catalog yet)`, 'info');
    }
  };

  const stopCamera = async () => {
    const qr = scannerRef.current;
    const wasRunning = isRunningRef.current;
    isRunningRef.current = false;
    scannerRef.current = null;

    if (qr) {
      try {
        if (wasRunning && qr.isScanning) {
          await qr.stop();
        }
      } catch {
        // Ignore stop error if scanner already stopped or failed to start
      }
      try {
        qr.clear();
      } catch {
        // Ignore clear error
      }
    }

    if (isMountedRef.current) {
      setScanning(false);
    }
  };

  const startCamera = async () => {
    if (isRunningRef.current || scanning) return;
    setCameraError(null);
    try {
      const html5Qr = new Html5Qrcode('aqsa-qr-reader');
      scannerRef.current = html5Qr;
      setScanning(true);
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decodedText) => {
          handleDecodedText(decodedText);
          void stopCamera();
        },
        () => {}
      );
      if (!isMountedRef.current) {
        try {
          if (html5Qr.isScanning) await html5Qr.stop();
          html5Qr.clear();
        } catch {
          // Ignore unmount race
        }
        return;
      }
      isRunningRef.current = true;
    } catch (err) {
      isRunningRef.current = false;
      scannerRef.current = null;
      if (isMountedRef.current) {
        setScanning(false);
        setCameraError(
          err instanceof Error
            ? err.message
            : 'Camera permission unavailable in this browser. Use manual SKU/Barcode lookup below.'
        );
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const qr = scannerRef.current;
      const wasRunning = isRunningRef.current;
      isRunningRef.current = false;
      scannerRef.current = null;
      if (qr && wasRunning) {
        try {
          if (qr.isScanning) {
            Promise.resolve(qr.stop())
              .then(() => {
                try {
                  qr.clear();
                } catch {
                  // Ignore clear error
                }
              })
              .catch(() => {});
          }
        } catch {
          // Catch synchronous Html5Qrcode.stop() throws
        }
      }
    };
  }, []);

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDecodedText(manualCode);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          QR & Barcode Scanner
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Scan gemstone tags using your Android, tablet, or laptop camera to adjust stock or make an instant sale
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Scanner Box */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              Camera Scanner
            </h2>
            {!scanning ? (
              <button
                onClick={startCamera}
                className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 min-h-[40px]"
              >
                <Camera className="w-4 h-4" />
                Start Camera Scan
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 min-h-[40px]"
              >
                <CameraOff className="w-4 h-4" />
                Stop Camera
              </button>
            )}
          </div>

          <div className="relative w-full min-h-[260px] rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <div
              id="aqsa-qr-reader"
              className={scanning ? 'w-full min-h-[260px]' : 'hidden'}
            />
            {!scanning && (
              <div className="min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-2">
                <QrCode className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500">
                  Tap "Start Camera Scan" to scan any N.A GEM'S QR label or barcode.
                </p>
              </div>
            )}
          </div>

          {cameraError && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
              {cameraError}
            </p>
          )}

          {/* Manual Barcode / USB Scanner Input */}
          <form onSubmit={handleManualLookup} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or enter / scan barcode SKU (e.g. NAG-RB-101)"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-xs font-mono"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 min-h-[40px]"
            >
              Lookup
            </button>
          </form>

          {/* Quick test sample tags */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <p className="text-[11px] text-slate-500 mb-2">Quick Tap to Simulate Scan:</p>
            <div className="flex flex-wrap gap-2">
              {inventory.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleDecodedText(item.sku)}
                  className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-mono hover:border-emerald-600"
                >
                  {item.sku}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scanned Result & Quick Actions */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between">
          {matchedItem ? (
            <div className="space-y-4">
              <div className="flex items-start gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                {matchedItem.imageUrl ? (
                  <img
                    src={matchedItem.imageUrl}
                    alt={matchedItem.name}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                    <Gem className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
                  </div>
                )}
                <div>
                  <p className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {matchedItem.sku}
                  </p>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {matchedItem.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {matchedItem.weightCarats} ct · {matchedItem.colour} · {matchedItem.certLab}{' '}
                    {matchedItem.certNumber}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-slate-500">Available Stock</p>
                  <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                    {matchedItem.stockQty} pcs
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-slate-500">Final Selling Price</p>
                  <p className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {formatMoney(
                      computeItemFinalPkr(
                        matchedItem.baseSellPrice,
                        matchedItem.sellCurrency,
                        profile
                      ).finalPkr,
                      'PKR'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={() => {
                    setPosQueuedSku(matchedItem.sku);
                    setActiveModule('sales');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 min-h-[44px]"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Make Sale (Add to Invoice)
                </button>
                <button
                  onClick={() =>
                    updateInventoryItem(matchedItem.id, {
                      stockQty: matchedItem.stockQty + 1,
                    })
                  }
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  Quick Stock +1
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-3">
              <Gem className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {scannedSku
                    ? `No inventory match for "${scannedSku}"`
                    : 'Ready to Scan Gemstone Tag'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Scan a QR code or enter a SKU to view certificate details, adjust stock, or open a new sales invoice.
                </p>
              </div>
              {scannedSku && (
                <button
                  onClick={() => setActiveModule('inventory')}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Add New Product in Inventory
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

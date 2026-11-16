import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  FileDown,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Trash2,
} from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { CurrencyCode, SalesLineItem, SalesOrder } from '../types/business';
import {
  calculateInvoiceTotals,
  convertToPkr,
  formatMoney,
  getLineItemAmounts,
} from '../utils/currency';
import { exportInvoicePdf } from '../utils/exporters';
import { InvoiceModal } from '../components/InvoiceModal';
import { DeleteActionButton } from '../components/DeleteActionButton';

export const SalesView: React.FC = () => {
  const {
    inventory,
    sales,
    profile,
    activeOperator,
    addSale,
    deleteSale,
    hasPermission,
    posQueuedSku,
    setPosQueuedSku,
    setActiveModule,
    notify,
  } = useBusiness();

  const canCreate = hasPermission('create_sales');
  const canViewProfit = hasPermission('view_profit');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Currency & Percentage Calculation System State
  const [sourceCurrency, setSourceCurrency] = useState<CurrencyCode>('RMB');
  const [rmbRate, setRmbRate] = useState<string>(String(profile.rmbToPkr));
  const [usdRate, setUsdRate] = useState<string>(String(profile.usdToPkr));
  const [markupPercent, setMarkupPercent] = useState<string>(
    String(profile.defaultMarkupPercent)
  );
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Partial' | 'Pending'>('Paid');

  const [selectedSkuId, setSelectedSkuId] = useState<string>(inventory[0]?.id || '');
  const [cart, setCart] = useState<SalesLineItem[]>([]);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);

  // Sync default rates if profile changes & cart is empty
  useEffect(() => {
    setRmbRate(String(profile.rmbToPkr));
    setUsdRate(String(profile.usdToPkr));
    setMarkupPercent(String(profile.defaultMarkupPercent));
  }, [profile.rmbToPkr, profile.usdToPkr, profile.defaultMarkupPercent]);

  // Handle scanned SKU pushed from ScannerView
  useEffect(() => {
    if (!posQueuedSku) return;
    const matched = inventory.find(
      (i) => i.sku.toLowerCase() === posQueuedSku.toLowerCase()
    );
    if (matched) {
      addInventoryToCart(matched.id);
    }
    setPosQueuedSku(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posQueuedSku]);

  const addInventoryToCart = (itemId: string) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;
    if (item.stockQty <= 0) {
      notify(`${item.sku} is currently out of stock.`, 'error');
      return;
    }

    const rmbNum = Number(rmbRate) || profile.rmbToPkr || 1;
    const usdNum = Number(usdRate) || profile.usdToPkr || 1;

    // Convert item's base sell price into selected invoice sourceCurrency if needed
    let unitInSource = item.baseSellPrice;
    if (item.sellCurrency !== sourceCurrency) {
      const pkrVal = convertToPkr(item.baseSellPrice, item.sellCurrency, rmbNum, usdNum);
      if (sourceCurrency === 'PKR') unitInSource = pkrVal;
      else if (sourceCurrency === 'RMB') unitInSource = rmbNum > 0 ? pkrVal / rmbNum : pkrVal;
      else if (sourceCurrency === 'USD') unitInSource = usdNum > 0 ? pkrVal / usdNum : pkrVal;
    }

    const unitCostPkr = convertToPkr(
      item.unitCost,
      item.costCurrency,
      profile.rmbToPkr,
      profile.usdToPkr
    );

    setCart((prev) => {
      const existing = prev.find((c) => c.inventoryId === item.id);
      if (existing) {
        if (existing.quantity >= item.stockQty) {
          notify(`Max stock (${item.stockQty}) reached for ${item.sku}.`, 'info');
          return prev;
        }
        return prev.map((c) =>
          c.inventoryId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          inventoryId: item.id,
          sku: item.sku,
          productName: item.name,
          gemstoneDetails: `${item.weightCarats} ct · ${item.colour} · ${item.shapeCut}`,
          certNumber: item.certNumber,
          quantity: 1,
          unitPriceOrig: Number(unitInSource.toFixed(2)),
          unitCostPkr,
          markupPercent: Math.max(0, Number(markupPercent) || 0),
        },
      ];
    });
  };

  const applyGlobalPercentToCart = () => {
    const pct = Math.max(0, Number(markupPercent) || 0);
    setCart((prev) => prev.map((li) => ({ ...li, markupPercent: pct })));
    notify(`Applied ${pct}% markup to all ${cart.length} invoice items.`, 'info');
  };

  const baseSubtotal = useMemo(
    () => cart.reduce((sum, li) => sum + li.unitPriceOrig * li.quantity, 0),
    [cart]
  );

  const totalCostPkr = useMemo(
    () => cart.reduce((sum, li) => sum + li.unitCostPkr * li.quantity, 0),
    [cart]
  );

  const calc = useMemo(
    () =>
      calculateInvoiceTotals(
        {
          baseSubtotal,
          sourceCurrency,
          rmbRateUsed: Number(rmbRate) || 0,
          usdRateUsed: Number(usdRate) || 0,
          markupPercentUsed: Number(markupPercent) || 0,
          items: cart,
        },
        profile
      ),
    [baseSubtotal, sourceCurrency, rmbRate, usdRate, markupPercent, cart, profile]
  );

  const profitPkr = calc.finalTotalPkrEquivalent - totalCostPkr;

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) {
      notify('You do not have permission to create sales invoices.', 'error');
      return;
    }
    if (!customerName.trim()) {
      notify('Please enter customer name.', 'error');
      return;
    }
    if (cart.length === 0) {
      notify('Please add at least one product to the invoice.', 'error');
      return;
    }

    const paidPkr =
      paymentStatus === 'Paid'
        ? calc.finalTotalPkrEquivalent
        : paymentStatus === 'Pending'
          ? 0
          : Math.max(0, Number(paidAmountInput) || 0);

    const created = addSale({
      invoiceNo: `INV-NAG-${1003 + sales.length}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      orderDate,
      sourceCurrency,
      rmbRateUsed: Number(rmbRate) || 0,
      usdRateUsed: Number(usdRate) || 0,
      markupPercentUsed: calc.markupPercentUsed,
      finalCurrency: calc.finalCurrency,
      exchangeRateApplied: calc.exchangeRateApplied,
      baseSubtotal: calc.baseSubtotal,
      convertedAmountPkr: calc.convertedAmountPkr,
      markupAmount: calc.markupAmount,
      finalTotal: calc.finalTotal,
      finalTotalPkrEquivalent: calc.finalTotalPkrEquivalent,
      totalCostPkr,
      profitPkr,
      paidAmountPkr: paidPkr,
      paymentStatus,
      items: cart,
      notes,
      createdBy: activeOperator.name,
    });

    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setPaidAmountInput('');
    setNotes('');
    setPreviewOrder(created);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Sales, Orders & Multi-Currency Invoicing
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Auto-converts RMB / USD → PKR + Custom % Markup, or Original Currency when RMB Rate = 0
          </p>
        </div>
        <button
          onClick={() => setActiveModule('scanner')}
          className="flex items-center gap-2 rounded-lg border border-emerald-700 text-emerald-700 dark:text-emerald-400 px-3.5 py-2 text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <QrCode className="w-4 h-4" />
          Scan QR to Add to Sale
        </button>
      </div>

      {/* New Sales Order Builder */}
      {canCreate && (
        <form
          onSubmit={handleCreateInvoice}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              Create New Sales Invoice
            </h2>
            <span className="text-xs font-mono text-slate-500">
              Operator: {activeOperator.name}
            </span>
          </div>

          {/* Customer & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Customer Name *
              </label>
              <input
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Haji Tariq Jewellers"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                WhatsApp / Phone
              </label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="923001234567"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Address / City
              </label>
              <input
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Rawalpindi / Lahore / Dubai"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Order Date
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
          </div>

          {/* Currency & Percentage Calculation Settings for this Invoice */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Currency & Percentage Calculation Controls
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Product Entry Currency
                </label>
                <select
                  value={sourceCurrency}
                  onChange={(e) => setSourceCurrency(e.target.value as CurrencyCode)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono font-semibold"
                >
                  <option value="RMB">RMB (¥)</option>
                  <option value="USD">USD ($)</option>
                  <option value="PKR">PKR (Rs)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  RMB → PKR Rate (0 = Orig. Currency)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={rmbRate}
                  onChange={(e) => setRmbRate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  USD → PKR Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={usdRate}
                  onChange={(e) => setUsdRate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Default Item Markup %
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={markupPercent}
                    onChange={(e) => setMarkupPercent(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono"
                  />
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={applyGlobalPercentToCart}
                      title="Apply this % to every item in the cart"
                      className="rounded-lg border border-emerald-700 px-2.5 py-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 whitespace-nowrap shrink-0"
                    >
                      Apply All
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] font-mono text-emerald-800 dark:text-emerald-400">
              Live Formula: {calc.calculationExplanation}
            </p>
          </div>

          {/* Product Picker */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedSkuId}
              onChange={(e) => setSelectedSkuId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
            >
              {inventory.map((item) => (
                <option key={item.id} value={item.id} disabled={item.stockQty <= 0}>
                  {item.sku} — {item.name} ({item.weightCarats}ct · Stock: {item.stockQty} · Base:{' '}
                  {item.baseSellPrice} {item.sellCurrency})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => addInventoryToCart(selectedSkuId)}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>

          {/* Cart Items */}
          {cart.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 w-20">Qty</th>
                    <th className="py-2.5 px-3 w-32">Unit ({sourceCurrency})</th>
                    <th className="py-2.5 px-3 w-28">Item %</th>
                    <th className="py-2.5 px-3 text-right">Base</th>
                    <th className="py-2.5 px-3 text-right">Line Total (w/ %)</th>
                    <th className="py-2.5 px-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {cart.map((li) => {
                    const fallbackPct = Math.max(0, Number(markupPercent) || 0);
                    const { lineBaseOrig, percentUsed, lineTotalOrig } = getLineItemAmounts(
                      li,
                      fallbackPct
                    );
                    const linePkrTotal =
                      !calc.isOriginalCurrencyMode && calc.finalCurrency === 'PKR'
                        ? lineTotalOrig * calc.exchangeRateApplied
                        : null;

                    return (
                      <tr key={li.inventoryId}>
                        <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                          {li.sku}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {li.productName}
                          </p>
                          <p className="text-[11px] text-slate-500">{li.gemstoneDetails}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="1"
                            value={li.quantity}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setCart((prev) =>
                                prev.map((c) =>
                                  c.inventoryId === li.inventoryId ? { ...c, quantity: val } : c
                                )
                              );
                            }}
                            className="w-18 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={li.unitPriceOrig}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setCart((prev) =>
                                prev.map((c) =>
                                  c.inventoryId === li.inventoryId
                                    ? { ...c, unitPriceOrig: val }
                                    : c
                                )
                              );
                            }}
                            className="w-28 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={percentUsed}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                setCart((prev) =>
                                  prev.map((c) =>
                                    c.inventoryId === li.inventoryId
                                      ? { ...c, markupPercent: val }
                                      : c
                                  )
                                );
                              }}
                              className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono"
                            />
                            <span className="text-slate-500 font-mono">%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatMoney(lineBaseOrig, sourceCurrency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatMoney(lineTotalOrig, sourceCurrency)}
                          </p>
                          {linePkrTotal !== null && sourceCurrency !== 'PKR' && (
                            <p className="text-[10px] text-slate-500">
                              = {formatMoney(linePkrTotal, 'PKR')}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setCart((prev) =>
                                prev.filter((c) => c.inventoryId !== li.inventoryId)
                              )
                            }
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                            aria-label={`Remove ${li.sku}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Invoice Calculation Summary & Payment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) =>
                      setPaymentStatus(e.target.value as 'Paid' | 'Partial' | 'Pending')
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  >
                    <option value="Paid">Paid in Full</option>
                    <option value="Partial">Partial Payment</option>
                    <option value="Pending">Pending Due (Credit)</option>
                  </select>
                </div>
                {paymentStatus === 'Partial' && (
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Paid Amount (PKR Eqv.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Notes
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery terms, certificate notes, payment schedule..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                />
              </div>
            </div>

            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Currency Entered:</span>
                <span className="font-mono font-semibold">{calc.sourceCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Exchange Rate Applied:</span>
                <span className="font-mono font-semibold">
                  {calc.isOriginalCurrencyMode
                    ? `RMB=0 (Original ${calc.finalCurrency})`
                    : `1 ${calc.sourceCurrency} = ${calc.exchangeRateApplied.toFixed(2)} PKR`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Base Subtotal:</span>
                <span className="font-mono">{formatMoney(calc.baseSubtotal, calc.sourceCurrency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  Markup ({calc.markupPercentUsed}%):
                </span>
                <span className="font-mono">+ {formatMoney(calc.markupAmount, calc.finalCurrency)}</span>
              </div>
              {canViewProfit && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Estimated Profit:</span>
                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatMoney(profitPkr, 'PKR')}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 flex items-baseline justify-between">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  FINAL BILL TOTAL
                </span>
                <span className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                  {formatMoney(calc.finalTotal, calc.finalCurrency)}
                </span>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors min-h-[42px]"
                >
                  Save Order & Generate Invoice
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Sales Order History */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Sales Order & Invoice History ({sales.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Invoice No</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Currency / Rate / %</th>
                <th className="py-3 px-4 font-semibold text-right">Final Total</th>
                {canViewProfit && <th className="py-3 px-4 font-semibold text-right">Profit (PKR)</th>}
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {sale.invoiceNo}
                  </td>
                  <td className="py-3 px-4 font-mono whitespace-nowrap">{sale.orderDate}</td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                    {sale.customerName}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {sale.sourceCurrency} ·{' '}
                    {sale.rmbRateUsed === 0 ? 'RMB=0 (Orig)' : `@${sale.exchangeRateApplied}`} ·{' '}
                    {sale.markupPercentUsed}%
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                    {formatMoney(sale.finalTotal, sale.finalCurrency)}
                  </td>
                  {canViewProfit && (
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {formatMoney(sale.profitPkr, 'PKR')}
                    </td>
                  )}
                  <td className="py-3 px-4 whitespace-nowrap font-semibold">
                    <span
                      className={
                        sale.paymentStatus === 'Paid'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }
                    >
                      {sale.paymentStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setPreviewOrder(sale)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Invoice
                      </button>
                      <button
                        onClick={() => exportInvoicePdf(sale, profile)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        PDF
                      </button>
                      {canCreate && (
                        <DeleteActionButton
                          onConfirm={() => deleteSale(sale.id)}
                          title={`Delete invoice ${sale.invoiceNo}`}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previewOrder && (
        <InvoiceModal order={previewOrder} onClose={() => setPreviewOrder(null)} />
      )}
    </div>
  );
};

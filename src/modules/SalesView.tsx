import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Crown,
  Edit3,
  FileDown,
  Lock,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { bi } from '../utils/bilingual';
import { useBusiness } from '../context/BusinessContext';
import { CurrencyCode, SalesLineItem, SalesOrder } from '../types/business';
import {
  calculateInvoiceTotals,
  convertAmountBetweenCurrencies,
  convertToPkr,
  formatMoney,
  getLineItemAmounts,
  getRateForCurrency,
} from '../utils/currency';
import { exportInvoicePdf } from '../utils/exporters';
import { InvoiceModal } from '../components/InvoiceModal';
import { DeleteActionButton } from '../components/DeleteActionButton';
import { DispatchConfirmModal } from '../components/DispatchConfirmModal';
import { WorldCurrencySelect } from '../components/WorldCurrencySelect';

export const SalesView: React.FC = () => {
  const {
    inventory,
    sales,
    parties,
    profile,
    activeOperator,
    addSale,
    updateSale,
    dispatchSale,
    deleteSale,
    hasPermission,
    isFeatureLocked,
    uiLanguage,
    posQueuedSku,
    setPosQueuedSku,
    queuedEditSaleId,
    setQueuedEditSaleId,
    setActiveModule,
    notify,
  } = useBusiness();

  const canCreate = hasPermission('create_sales');
  const canViewProfit = hasPermission('view_profit');
  const isInvoicingLocked = isFeatureLocked('full_invoicing');

  const promptUpgradeInvoicing = () => {
    notify(
      'Full Invoicing & PDF export are locked on Free/Basic plan. Pay via EasyPaisa (03320001602) or Meezan Bank to unlock.',
      'info'
    );
    setActiveModule('subscription');
  };

  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // World Currency & Percentage Calculation System State
  const defaultCur = profile.defaultCurrency || 'CNY';
  const [sourceCurrency, setSourceCurrency] = useState<CurrencyCode>(defaultCur);
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(
    String(getRateForCurrency(defaultCur, profile))
  );
  const [markupPercent, setMarkupPercent] = useState<string>(
    String(profile.defaultMarkupPercent)
  );
  const [courierChargesInput, setCourierChargesInput] = useState<string>('0');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Partial' | 'Pending'>('Paid');

  const [selectedSkuId, setSelectedSkuId] = useState<string>(inventory[0]?.id || '');
  const [cart, setCart] = useState<SalesLineItem[]>([]);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);
  const [dispatchTarget, setDispatchTarget] = useState<SalesOrder | null>(null);

  const editingOrder = useMemo(
    () => (editingSaleId ? sales.find((s) => s.id === editingSaleId) || null : null),
    [editingSaleId, sales]
  );

  const handleSourceCurrencyChange = (nextCur: CurrencyCode) => {
    setSourceCurrency(nextCur);
    setExchangeRateInput(nextCur === 'PKR' ? '1' : String(getRateForCurrency(nextCur, profile)));
  };

  const resetEditor = () => {
    const cur = profile.defaultCurrency || 'CNY';
    setEditingSaleId(null);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setSourceCurrency(cur);
    setExchangeRateInput(cur === 'PKR' ? '1' : String(getRateForCurrency(cur, profile)));
    setMarkupPercent(String(profile.defaultMarkupPercent));
    setCourierChargesInput('0');
    setPaymentStatus('Paid');
    setPaidAmountInput('');
    setNotes('');
  };

  const loadSaleIntoEditor = (sale: SalesOrder) => {
    if (sale.dispatchStatus === 'Dispatched') {
      notify(`Invoice ${sale.invoiceNo} has already been dispatched and cannot be edited.`, 'error');
      return;
    }
    const loadedRate =
      sale.sourceCurrency === 'PKR'
        ? 1
        : typeof sale.exchangeRateApplied === 'number'
          ? sale.exchangeRateApplied
          : sale.rmbRateUsed === 0
            ? 0
            : sale.sourceCurrency === 'RMB'
              ? (sale.rmbRateUsed ?? getRateForCurrency('RMB', profile))
              : (sale.usdRateUsed ?? getRateForCurrency(sale.sourceCurrency, profile));
    setEditingSaleId(sale.id);
    setCustomerName(sale.customerName);
    setCustomerPhone(sale.customerPhone || '');
    setCustomerAddress(sale.customerAddress || '');
    setOrderDate(sale.orderDate);
    setSourceCurrency(sale.sourceCurrency);
    setExchangeRateInput(String(loadedRate));
    setMarkupPercent(String(sale.markupPercentUsed));
    setCourierChargesInput(String(sale.courierCharges ?? 0));
    setPaymentStatus(sale.paymentStatus);
    setPaidAmountInput(String(sale.paidAmountPkr || 0));
    setNotes(sale.notes || '');
    setCart(
      sale.items.map((item) => ({
        ...item,
        markupPercent:
          typeof item.markupPercent === 'number'
            ? item.markupPercent
            : sale.markupPercentUsed,
      }))
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync default rates if profile changes & not editing an existing invoice
  useEffect(() => {
    if (editingSaleId) return;
    setExchangeRateInput(
      sourceCurrency === 'PKR' ? '1' : String(getRateForCurrency(sourceCurrency, profile))
    );
    setMarkupPercent(String(profile.defaultMarkupPercent));
  }, [profile, sourceCurrency, editingSaleId]);

  // Handle edit request queued from Customer Ledger, Dashboard, or Invoice Modal
  useEffect(() => {
    if (!queuedEditSaleId) return;
    const found = sales.find((s) => s.id === queuedEditSaleId);
    if (found) {
      loadSaleIntoEditor(found);
    }
    setQueuedEditSaleId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedEditSaleId, sales]);

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
    const existingQtyInEditedInvoice =
      editingOrder?.items
        .filter((li) => li.inventoryId === item.id || li.sku.toLowerCase() === item.sku.toLowerCase())
        .reduce((sum, li) => sum + li.quantity, 0) || 0;
    const maxAllowedQty = item.stockQty + existingQtyInEditedInvoice;

    if (maxAllowedQty <= 0) {
      notify(`${item.sku} is currently out of stock.`, 'error');
      return;
    }

    const activeExchangeRate =
      sourceCurrency === 'PKR'
        ? 1
        : Math.max(0, Number(exchangeRateInput) || getRateForCurrency(sourceCurrency, profile) || 1);
    const itemSellRate =
      item.sellCurrency === 'PKR'
        ? 1
        : typeof item.sellExchangeRate === 'number' && item.sellExchangeRate > 0
          ? item.sellExchangeRate
          : getRateForCurrency(item.sellCurrency, profile);

    const unitInSource = convertAmountBetweenCurrencies(
      item.baseSellPrice,
      item.sellCurrency,
      sourceCurrency,
      itemSellRate,
      activeExchangeRate
    );

    const itemCostRate =
      item.costCurrency === 'PKR'
        ? 1
        : typeof item.costExchangeRate === 'number' && item.costExchangeRate > 0
          ? item.costExchangeRate
          : getRateForCurrency(item.costCurrency, profile);
    const unitCostPkr = convertToPkr(item.unitCost, item.costCurrency, itemCostRate);

    setCart((prev) => {
      const existing = prev.find((c) => c.inventoryId === item.id);
      if (existing) {
        if (existing.quantity >= maxAllowedQty) {
          notify(`Max stock (${maxAllowedQty}) reached for ${item.sku}.`, 'info');
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
          exchangeRateUsed: sourceCurrency === 'PKR' ? 1 : Math.max(0, Number(exchangeRateInput) || 0),
          markupPercentUsed: Number(markupPercent) || 0,
          courierCharges: Math.max(0, Number(courierChargesInput) || 0),
          items: cart,
        },
        profile
      ),
    [baseSubtotal, sourceCurrency, exchangeRateInput, markupPercent, courierChargesInput, cart, profile]
  );

  // Exclude pass-through courier charges from product net profit margin
  const profitPkr = calc.finalTotalPkrEquivalent - calc.courierChargesPkrEquivalent - totalCostPkr;

  const handleCreateOrUpdateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) {
      notify('You do not have permission to create or edit sales invoices.', 'error');
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

    const nextNumber = sales.reduce((max, s) => {
      const m = s.invoiceNo.match(/(\d+)$/);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 1002);

    const payload: Omit<SalesOrder, 'id' | 'createdAt'> = {
      invoiceNo: editingOrder ? editingOrder.invoiceNo : `INV-NAG-${nextNumber + 1}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      orderDate,
      sourceCurrency,
      rmbRateUsed: calc.exchangeRateApplied,
      usdRateUsed: getRateForCurrency('USD', profile),
      markupPercentUsed: calc.markupPercentUsed,
      finalCurrency: calc.finalCurrency,
      exchangeRateApplied: calc.exchangeRateApplied,
      baseSubtotal: calc.baseSubtotal,
      convertedAmountPkr: calc.convertedAmountPkr,
      markupAmount: calc.markupAmount,
      courierCharges: calc.courierCharges,
      finalTotal: calc.finalTotal,
      finalTotalPkrEquivalent: calc.finalTotalPkrEquivalent,
      totalCostPkr,
      profitPkr,
      paidAmountPkr: paidPkr,
      paymentStatus,
      dispatchStatus: editingOrder?.dispatchStatus || 'Pending',
      items: cart,
      notes,
      createdBy: editingOrder?.createdBy || activeOperator.name,
    };

    if (editingSaleId) {
      const updated = updateSale(editingSaleId, payload);
      if (updated) {
        resetEditor();
        setPreviewOrder(updated);
      }
      return;
    }

    const created = addSale(payload);
    resetEditor();
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
            Select any world currency with PKR conversion rate (0 = keep amount in selected currency) + per-item % markup
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

      {/* Free Plan Lock Gate or New / Edit Sales Order Builder */}
      {isInvoicingLocked ? (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                {bi(
                  'Complete Invoice Builder, Editing, Dispatch & PDF Export Locked (Free / Basic)',
                  'مکمل انوائس سسٹم مفت ورژن میں لاک ہے',
                  uiLanguage
                )}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                Free users can view historical sales summaries below and edit the Company Name in Settings. Upgrade to{' '}
                <strong>Monthly (4500 PKR / Month)</strong> or <strong>Yearly (35000 PKR / Year)</strong> via EasyPaisa (
                <span className="font-mono">03320001602</span>) or Meezan Bank to unlock invoice creation, WhatsApp billing, dispatch locking, and A4 PDF export.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('subscription')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <Crown className="w-4 h-4" />
            Unlock Full Version
          </button>
        </div>
      ) : canCreate && (
        <form
          onSubmit={handleCreateOrUpdateInvoice}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              {editingOrder
                ? `Edit Un-dispatched Invoice (${editingOrder.invoiceNo})`
                : 'Create New Sales Invoice'}
            </h2>
            <div className="flex items-center gap-3">
              {editingOrder && (
                <button
                  type="button"
                  onClick={resetEditor}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel Edit
                </button>
              )}
              <span className="text-xs font-mono text-slate-500">
                Operator: {activeOperator.name}
              </span>
            </div>
          </div>

          {editingOrder && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
              <span>
                Editing un-dispatched invoice <strong className="font-mono">{editingOrder.invoiceNo}</strong>. Update items, courier charges, or customer details — it remains editable until you click <strong>Dispatch</strong>.
              </span>
            </div>
          )}

          {/* Saved Customer Quick-Pick + Customer & Date Row */}
          {(() => {
            const customerParties = parties.filter(
              (p) => p.partyType === 'Customer' || p.partyType === 'Both'
            );
            const matchedCustomer = customerParties.find(
              (p) => p.name.trim().toLowerCase() === customerName.trim().toLowerCase()
            );
            const creditLimitPkr = matchedCustomer
              ? convertToPkr(
                  matchedCustomer.creditLimit,
                  matchedCustomer.creditCurrency,
                  matchedCustomer.creditExchangeRate ?? getRateForCurrency(matchedCustomer.creditCurrency, profile)
                )
              : 0;
            return (
              <div className="space-y-2">
                {customerParties.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <label className="font-medium text-slate-600 dark:text-slate-400">
                        Quick-Fill Customer:
                      </label>
                      <select
                        value={matchedCustomer?.id || ''}
                        onChange={(e) => {
                          const picked = customerParties.find((p) => p.id === e.target.value);
                          if (!picked) return;
                          setCustomerName(picked.name);
                          setCustomerPhone(picked.contactNumber);
                          setCustomerAddress(
                            [picked.address, picked.city].filter(Boolean).join(', ')
                          );
                        }}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                      >
                        <option value="">-- Select from Customer Directory --</option>
                        {customerParties.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.city || 'No city'}) — Limit:{' '}
                            {formatMoney(c.creditLimit, c.creditCurrency)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {matchedCustomer && (
                      <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                        City: {matchedCustomer.city || '—'} · Credit Limit:{' '}
                        {formatMoney(matchedCustomer.creditLimit, matchedCustomer.creditCurrency)}{' '}
                        {matchedCustomer.creditCurrency !== 'PKR'
                          ? `(${formatMoney(creditLimitPkr, 'PKR')})`
                          : ''}
                      </span>
                    )}
                  </div>
                )}
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
              </div>
            );
          })()}

          {/* World Currency & Percentage Calculation Settings for this Invoice */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                World Currency & Percentage Calculation Controls
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Product Entry Currency (All World Currencies)
                </label>
                <WorldCurrencySelect
                  value={sourceCurrency}
                  onChange={handleSourceCurrencyChange}
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Conversion Rate → PKR (0 = Keep in {sourceCurrency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={sourceCurrency === 'PKR'}
                  value={sourceCurrency === 'PKR' ? '1' : exchangeRateInput}
                  onChange={(e) => setExchangeRateInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono disabled:opacity-60 min-h-[38px]"
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
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono min-h-[38px]"
                  />
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={applyGlobalPercentToCart}
                      title="Apply this % to every item in the cart"
                      className="rounded-lg border border-emerald-700 px-2.5 py-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 whitespace-nowrap shrink-0 min-h-[38px]"
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
                    ? `Rate = 0 (Original ${calc.finalCurrency})`
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

              {/* Courier Charges Section Before Total */}
              <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-emerald-200/70 dark:border-emerald-900/60">
                <label
                  htmlFor="courier-charges-input"
                  className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  Courier Charges ({calc.finalCurrency}):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="courier-charges-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={courierChargesInput}
                    onChange={(e) => setCourierChargesInput(e.target.value)}
                    placeholder="0"
                    className="w-28 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-right font-mono font-semibold text-slate-900 dark:text-white"
                  />
                  <span className="font-mono text-slate-500 w-9 text-right">
                    {calc.finalCurrency}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 flex items-baseline justify-between">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  FINAL BILL TOTAL
                </span>
                <span className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                  {formatMoney(calc.finalTotal, calc.finalCurrency)}
                </span>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                {editingOrder && (
                  <button
                    type="button"
                    onClick={resetEditor}
                    className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[42px]"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors min-h-[42px]"
                >
                  {editingOrder
                    ? `Update Invoice (${editingOrder.invoiceNo})`
                    : 'Save Order & Generate Invoice'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Sales Order History */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Sales Order & Invoice History ({sales.length})
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Un-dispatched invoices stay editable here and in Customer Ledger until Dispatched
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Invoice No</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Currency / Rate / %</th>
                <th className="py-3 px-4 font-semibold text-right">Courier</th>
                <th className="py-3 px-4 font-semibold text-right">Final Total</th>
                {canViewProfit && <th className="py-3 px-4 font-semibold text-right">Profit (PKR)</th>}
                <th className="py-3 px-4 font-semibold">Payment</th>
                <th className="py-3 px-4 font-semibold">Dispatch & Arrival</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sales.map((sale) => {
                const isDispatched = sale.dispatchStatus === 'Dispatched';
                return (
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
                      {sale.sourceCurrency !== 'PKR' && sale.exchangeRateApplied === 0
                        ? 'Rate=0 (Orig)'
                        : `@${sale.exchangeRateApplied}`}{' '}
                      · {sale.markupPercentUsed}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatMoney(sale.courierCharges || 0, sale.finalCurrency)}
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
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isDispatched ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                            <Lock className="w-3 h-3" />
                            Dispatched
                          </span>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            Arrives: {sale.expectedArrivalDate || '—'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            Pending Dispatch
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Editable
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {!isInvoicingLocked && canCreate && !isDispatched && (
                          <>
                            <button
                              type="button"
                              onClick={() => loadSaleIntoEditor(sale)}
                              title={`Edit invoice ${sale.invoiceNo}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDispatchTarget(sale)}
                              title={`Dispatch parcel for ${sale.invoiceNo}`}
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
                        <button
                          type="button"
                          onClick={() =>
                            isInvoicingLocked ? promptUpgradeInvoicing() : exportInvoicePdf(sale, profile)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
                        >
                          {isInvoicingLocked ? (
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <FileDown className="w-3.5 h-3.5" />
                          )}
                          PDF
                        </button>
                        {!isInvoicingLocked && canCreate && (
                          <DeleteActionButton
                            onConfirm={() => deleteSale(sale.id)}
                            title={`Delete invoice ${sale.invoiceNo}`}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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

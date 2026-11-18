import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  Edit3,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Layers,
  Lock,
  PackagePlus,
  Plane,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Ship,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { CurrencyCode, InventoryItem } from '../types/business';
import {
  computeItemFinalPkr,
  convertToPkr,
  formatMoney,
  getRateForCurrency,
} from '../utils/currency';
import { generateInventorySku } from '../utils/sku';
import { bi } from '../utils/bilingual';
import { compressImageFileToDataUrl } from '../utils/localDb';
import {
  exportInventoryCsv,
  exportInventoryExcel,
  exportInventoryPdf,
} from '../utils/exporters';
import { QrTagModal } from '../components/QrTagModal';
import { DeleteActionButton } from '../components/DeleteActionButton';
import { WorldCurrencySelect } from '../components/WorldCurrencySelect';

interface InventoryFormState {
  sku: string; // 1
  sizeMm: string; // 2
  colour: string; // 3
  shapeCut: string; // 4
  subCategory: string; // 5
  category: string; // 6
  stockPieces: string; // 7
  itemUnit: string; // 8
  oneTpWeight: string; // 9
  batchNumber: string; // 10
  stockQty: string; // 11
  cent: string; // 12
  fridge: string; // 13
  costCurrency: CurrencyCode; // 14 cur
  costExchangeRate: string; // 14 rate
  unitCost: string; // 14 amt
  sellCurrency: CurrencyCode; // 15 cur
  sellExchangeRate: string; // 15 rate
  baseSellPrice: string; // 15 amt
  via: string; // 16
  purchaseDate: string; // 17
  returnLossDamage: string; // 18
  gemstoneType: string; // 19
  origin: string; // 20
  clarity: string; // 21
  treatment: string; // 22
  certLab: string; // 23
  certNumber: string; // 24
  minStockAlert: string; // 25
  vaultLocation: string; // 26
  supplierName: string; // 27
  notes: string; // 28. Remarks
  name: string;
  imageUrl: string;
}

const CATEGORY_OPTIONS = [
  'Loose Gemstone',
  'Lot / Parcel',
  'Rough Stone',
  'Jewelry Ring',
  'Necklace',
  'Bracelet',
  'Earrings',
];

const UNIT_OPTIONS = ['Carats', 'Pieces', 'Grams', 'Parcel', 'Lot', 'Ratti', 'Box'];
const VIA_OPTIONS = ['By Air', 'By Sea', 'By Land', 'Hand Carry'];

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

function createEmptyForm(
  defaultCurrency: CurrencyCode,
  defaultRate: number
): InventoryFormState {
  const initialSubCategory = 'Faceted';
  const initialSize = '8 x 6 mm';
  const initialPcs = '1';
  const initialBatch = `B-${new Date().getFullYear().toString().slice(-2)}01`;

  return {
    sku: generateInventorySku({
      sizeMm: initialSize,
      subCategory: initialSubCategory,
      stockPieces: Number(initialPcs),
      batchNumber: initialBatch,
    }),
    sizeMm: initialSize,
    colour: '',
    shapeCut: 'Oval',
    subCategory: initialSubCategory,
    category: 'Loose Gemstone',
    stockPieces: initialPcs,
    itemUnit: 'Carats',
    oneTpWeight: '1.00',
    batchNumber: initialBatch,
    stockQty: '1',
    cent: '100',
    fridge: '',
    costCurrency: defaultCurrency,
    costExchangeRate: String(defaultRate),
    unitCost: '0',
    sellCurrency: defaultCurrency,
    sellExchangeRate: String(defaultRate),
    baseSellPrice: '0',
    via: 'By Air',
    purchaseDate: TODAY_ISO(),
    returnLossDamage: '0',
    gemstoneType: '',
    origin: '',
    clarity: '',
    treatment: 'Natural / Unheated',
    certLab: 'GRS',
    certNumber: '',
    minStockAlert: '1',
    vaultLocation: '',
    supplierName: '',
    notes: '',
    name: '',
    imageUrl: '',
  };
}

export const InventoryView: React.FC = () => {
  const {
    inventory,
    customCategories,
    customUnits,
    profile,
    uiLanguage,
    setActiveModule,
    hasPermission,
    isFeatureLocked,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    notify,
  } = useBusiness();

  const canEdit = hasPermission('edit_inventory');
  const canViewCost = hasPermission('view_profit');
  const isPhotoLocked = isFeatureLocked('stock_photo_upload');

  const defaultCur = profile.defaultCurrency || 'CNY';
  const defaultRate = getRateForCurrency(defaultCur, profile);

  const [showEntryForm, setShowEntryForm] = useState<boolean>(canEdit);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [autoSkuEnabled, setAutoSkuEnabled] = useState<boolean>(true);
  const [form, setForm] = useState<InventoryFormState>(() =>
    createEmptyForm(defaultCur, defaultRate)
  );

  // Filters & search
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [currencyFilter, setCurrencyFilter] = useState('All');
  const [viaFilter, setViaFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'Low' | 'Out' | 'In'>('All');
  const [qrItem, setQrItem] = useState<InventoryItem | null>(null);

  const entrySectionRef = useRef<HTMLDivElement | null>(null);

  // Live Auto-SKU calculation from Size (mm), Sub-Category, Stock Pieces, and Batch #
  useEffect(() => {
    if (!autoSkuEnabled) return;
    const generated = generateInventorySku({
      sizeMm: form.sizeMm,
      subCategory: form.subCategory,
      stockPieces: Number(form.stockPieces) || 0,
      batchNumber: form.batchNumber,
    });
    setForm((prev) => (prev.sku === generated ? prev : { ...prev, sku: generated }));
  }, [autoSkuEnabled, form.sizeMm, form.subCategory, form.stockPieces, form.batchNumber]);

  const categoryNames = useMemo(
    () =>
      Array.from(
        new Set([
          ...customCategories.map((c) => c.name),
          ...CATEGORY_OPTIONS,
          ...inventory.map((i) => i.category).filter(Boolean),
        ])
      ),
    [customCategories, inventory]
  );

  const categories = useMemo(() => ['All', ...categoryNames], [categoryNames]);

  const unitOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...customUnits,
          ...UNIT_OPTIONS,
          ...inventory.map((i) => i.itemUnit).filter(Boolean),
          form.itemUnit,
        ].filter(Boolean))
      ),
    [customUnits, inventory, form.itemUnit]
  );

  const activeCategorySubList = useMemo(() => {
    const matched = customCategories.find(
      (c) => c.name.toLowerCase() === (form.category || '').trim().toLowerCase()
    );
    const fromInventory = inventory
      .filter((i) => i.category === form.category && i.subCategory)
      .map((i) => i.subCategory);
    return Array.from(new Set([...(matched?.subCategories || []), ...fromInventory]));
  }, [customCategories, form.category, inventory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((item) => {
      const matchQuery =
        !q ||
        [
          item.sku,
          item.name,
          item.sizeMm,
          item.colour,
          item.shapeCut,
          item.subCategory,
          item.category,
          item.batchNumber,
          item.fridge,
          item.via,
          item.gemstoneType,
          item.origin,
          item.clarity,
          item.treatment,
          item.certLab,
          item.certNumber,
          item.vaultLocation,
          item.supplierName,
          item.notes,
        ]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(q));

      const matchCat = categoryFilter === 'All' || item.category === categoryFilter;
      const itemSellNormalized = item.sellCurrency === 'RMB' ? 'CNY' : item.sellCurrency;
      const filterNormalized = currencyFilter === 'RMB' ? 'CNY' : currencyFilter;
      const matchCur = currencyFilter === 'All' || itemSellNormalized === filterNormalized;
      const matchVia = viaFilter === 'All' || (item.via || '').toLowerCase() === viaFilter.toLowerCase();

      const matchStock =
        stockFilter === 'All'
          ? true
          : stockFilter === 'Out'
            ? item.stockQty === 0
            : stockFilter === 'Low'
              ? item.stockQty > 0 && item.stockQty <= item.minStockAlert
              : item.stockQty > item.minStockAlert;

      return matchQuery && matchCat && matchCur && matchVia && matchStock;
    });
  }, [inventory, search, categoryFilter, currencyFilter, viaFilter, stockFilter]);

  const stats = useMemo(() => {
    const totalPieces = inventory.reduce((s, i) => s + (i.stockPieces ?? 0), 0);
    const totalQty = inventory.reduce((s, i) => s + (i.stockQty || 0), 0);
    const byAir = inventory.filter((i) => (i.via || '').toLowerCase().includes('air')).length;
    const bySea = inventory.filter((i) => (i.via || '').toLowerCase().includes('sea')).length;
    const lowOrOut = inventory.filter((i) => i.stockQty <= i.minStockAlert).length;
    return { totalSkus: inventory.length, totalPieces, totalQty, byAir, bySea, lowOrOut };
  }, [inventory]);

  const resetForm = () => {
    const cur = profile.defaultCurrency || 'CNY';
    setEditingItemId(null);
    setAutoSkuEnabled(true);
    setForm(createEmptyForm(cur, getRateForCurrency(cur, profile)));
  };

  const startNewEntry = () => {
    resetForm();
    setShowEntryForm(true);
    setTimeout(() => {
      entrySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const startEditItem = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setAutoSkuEnabled(false);
    setShowEntryForm(true);
    setForm({
      sku: item.sku,
      sizeMm: item.sizeMm || '',
      colour: item.colour || '',
      shapeCut: item.shapeCut || '',
      subCategory: item.subCategory || '',
      category: item.category || 'Loose Gemstone',
      stockPieces: String(item.stockPieces ?? 0),
      itemUnit: item.itemUnit || 'Carats',
      oneTpWeight: String(item.oneTpWeight ?? item.weightCarats ?? 0),
      batchNumber: item.batchNumber || '',
      stockQty: String(item.stockQty ?? 0),
      cent: String(item.cent ?? 0),
      fridge: item.fridge || '',
      costCurrency: item.costCurrency || defaultCur,
      costExchangeRate: String(
        typeof item.costExchangeRate === 'number'
          ? item.costExchangeRate
          : getRateForCurrency(item.costCurrency, profile)
      ),
      unitCost: String(item.unitCost ?? 0),
      sellCurrency: item.sellCurrency || defaultCur,
      sellExchangeRate: String(
        typeof item.sellExchangeRate === 'number'
          ? item.sellExchangeRate
          : getRateForCurrency(item.sellCurrency, profile)
      ),
      baseSellPrice: String(item.baseSellPrice ?? 0),
      via: item.via || 'By Air',
      purchaseDate: item.purchaseDate || TODAY_ISO(),
      returnLossDamage: item.returnLossDamage || '0',
      gemstoneType: item.gemstoneType || '',
      origin: item.origin || '',
      clarity: item.clarity || '',
      treatment: item.treatment || '',
      certLab: item.certLab || '',
      certNumber: item.certNumber || '',
      minStockAlert: String(item.minStockAlert ?? 1),
      vaultLocation: item.vaultLocation || '',
      supplierName: item.supplierName || '',
      notes: item.notes || '',
      name: item.name || '',
      imageUrl: item.imageUrl || '',
    });
    setTimeout(() => {
      entrySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPhotoLocked) {
      notify('Stock photo upload requires Full Pro subscription.', 'error');
      e.target.value = '';
      setActiveModule('subscription');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 12) {
      notify('Image should be smaller than 12 MB.', 'error');
      return;
    }
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setForm((prev) => ({ ...prev, imageUrl: compressed }));
      notify('Photo attached and compressed for stock item.', 'success');
    } catch {
      notify('Unable to process selected image.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleCostCurrencyChange = (nextCur: string) => {
    const rate = nextCur === 'PKR' ? 1 : getRateForCurrency(nextCur, profile);
    setForm((prev) => ({
      ...prev,
      costCurrency: nextCur,
      costExchangeRate: String(rate),
    }));
  };

  const handleSellCurrencyChange = (nextCur: string) => {
    const rate = nextCur === 'PKR' ? 1 : getRateForCurrency(nextCur, profile);
    setForm((prev) => ({
      ...prev,
      sellCurrency: nextCur,
      sellExchangeRate: String(rate),
    }));
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const finalSku =
      form.sku.trim().toUpperCase() ||
      generateInventorySku({
        sizeMm: form.sizeMm,
        subCategory: form.subCategory,
        stockPieces: Number(form.stockPieces) || 0,
        batchNumber: form.batchNumber,
      });

    const autoComposedName = [
      form.gemstoneType.trim(),
      form.colour.trim(),
      form.subCategory.trim() || form.category.trim(),
      form.sizeMm.trim() ? `(${form.sizeMm.trim()})` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const finalName = form.name.trim() || autoComposedName || finalSku;

    const oneTpVal = Math.max(0, Number(form.oneTpWeight) || 0);
    const parsedCent = Number(form.cent);
    const finalCent = Number.isFinite(parsedCent)
      ? Math.max(0, parsedCent)
      : Math.round(oneTpVal * 100);

    const payload: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
      sku: finalSku,
      name: finalName,
      sizeMm: form.sizeMm.trim(),
      colour: form.colour.trim(),
      shapeCut: form.shapeCut.trim(),
      subCategory: form.subCategory.trim(),
      category: form.category.trim() || 'Loose Gemstone',
      stockPieces: Math.max(0, Number(form.stockPieces) || 0),
      itemUnit: form.itemUnit.trim() || 'Carats',
      oneTpWeight: oneTpVal,
      batchNumber: form.batchNumber.trim(),
      stockQty: Math.max(0, Number(form.stockQty) || 0),
      cent: finalCent,
      fridge: form.fridge.trim(),
      costCurrency: form.costCurrency,
      costExchangeRate:
        form.costCurrency === 'PKR'
          ? 1
          : Math.max(0, Number(form.costExchangeRate) || 0),
      unitCost: Math.max(0, Number(form.unitCost) || 0),
      sellCurrency: form.sellCurrency,
      sellExchangeRate:
        form.sellCurrency === 'PKR'
          ? 1
          : Math.max(0, Number(form.sellExchangeRate) || 0),
      baseSellPrice: Math.max(0, Number(form.baseSellPrice) || 0),
      via: form.via.trim() || 'By Air',
      purchaseDate: form.purchaseDate || TODAY_ISO(),
      returnLossDamage: form.returnLossDamage.trim() || '0',
      gemstoneType: form.gemstoneType.trim(),
      origin: form.origin.trim(),
      clarity: form.clarity.trim(),
      treatment: form.treatment.trim(),
      certLab: form.certLab.trim(),
      certNumber: form.certNumber.trim(),
      minStockAlert: Math.max(0, Number(form.minStockAlert) || 0),
      vaultLocation: form.vaultLocation.trim(),
      supplierName: form.supplierName.trim(),
      weightCarats: oneTpVal,
      notes: form.notes.trim(),
      imageUrl: form.imageUrl || undefined,
    };

    if (editingItemId) {
      updateInventoryItem(editingItemId, payload);
      resetForm();
    } else {
      addInventoryItem(payload);
      resetForm();
    }
  };

  // Live currency calculation previews for Entry Form boxes 14 & 15
  const previewCostRate =
    form.costCurrency === 'PKR' ? 1 : Math.max(0, Number(form.costExchangeRate) || 0);
  const previewCostPkr =
    form.costCurrency !== 'PKR' && previewCostRate === 0
      ? formatMoney(Number(form.unitCost) || 0, form.costCurrency)
      : formatMoney(
          convertToPkr(Number(form.unitCost) || 0, form.costCurrency, previewCostRate),
          'PKR'
        );

  const previewSellRate =
    form.sellCurrency === 'PKR' ? 1 : Math.max(0, Number(form.sellExchangeRate) || 0);
  const previewSellCalc = computeItemFinalPkr(
    Number(form.baseSellPrice) || 0,
    form.sellCurrency,
    profile,
    previewSellRate
  );

  const inputClass =
    'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[38px]';
  const labelClass =
    'block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 truncate';

  return (
    <div className="space-y-4">
      {/* Top Action & Summary Header */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {bi('Inventory', 'انوینٹری / اسٹاک', uiLanguage)}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono tabular-nums">
                SKUs: <strong className="text-slate-900 dark:text-slate-100">{stats.totalSkus}</strong>
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">
                Pieces: <strong className="text-slate-900 dark:text-slate-100">{stats.totalPieces}</strong>
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">
                Qty: <strong className="text-slate-900 dark:text-slate-100">{stats.totalQty}</strong>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Plane className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                By Air: <strong className="text-slate-900 dark:text-slate-100">{stats.byAir}</strong>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Ship className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                By Sea: <strong className="text-slate-900 dark:text-slate-100">{stats.bySea}</strong>
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">
                Low/Out:{' '}
                <strong
                  className={
                    stats.lowOrOut > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }
                >
                  {stats.lowOrOut}
                </strong>
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasPermission('export_reports') && (
              <>
                <button
                  type="button"
                  onClick={() => exportInventoryExcel(filtered, profile)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px]"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => exportInventoryCsv(filtered, profile)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px]"
                >
                  <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => exportInventoryPdf(filtered, profile)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px]"
                >
                  <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  PDF
                </button>
              </>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  if (showEntryForm && editingItemId) {
                    resetForm();
                  } else {
                    setShowEntryForm((prev) => !prev);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <PackagePlus className="w-4 h-4" />
                {showEntryForm ? 'Hide Entry Form' : '+ New Product Entry'}
                {showEntryForm ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* NEW PRODUCT ENTRY FORM (28 Sequence Boxes + Auto-SKU + FX Rate Controls) */}
      {canEdit && showEntryForm && (
        <div
          ref={entrySectionRef}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingItemId
                    ? `Edit Product Entry — ${form.sku}`
                    : 'New Product Entry Form'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  SKU auto-generates from Size (mm), Sub-Category, Stock Pieces &amp; Batch #. Enter Cost/Price in any World Currency (Rate 0 keeps own currency).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {editingItemId && (
                <button
                  type="button"
                  onClick={startNewEntry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[36px]"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  Switch to New Entry
                </button>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[36px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Boxes
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveEntry} className="p-4 space-y-4">
            {/* Sequential Grid: 1 -> 13 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {/* 1. SKU (Auto-Generated from Size + Sub-Cat + Pcs + Batch #) */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    1. SKU *{' '}
                    <span className="font-normal text-emerald-700 dark:text-emerald-400">
                      ({autoSkuEnabled ? 'Auto-Sync ON' : 'Manual Override'})
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextSku = generateInventorySku({
                        sizeMm: form.sizeMm,
                        subCategory: form.subCategory,
                        stockPieces: Number(form.stockPieces) || 0,
                        batchNumber: form.batchNumber,
                      });
                      setAutoSkuEnabled(true);
                      setForm((prev) => ({ ...prev, sku: nextSku }));
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                    title="Auto-generate SKU from Size, Sub-Category, Stock Pieces, and Batch #"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Auto-Generate
                  </button>
                </div>
                <input
                  required
                  value={form.sku}
                  onChange={(e) => {
                    setAutoSkuEnabled(false);
                    setForm({ ...form, sku: e.target.value.toUpperCase() });
                  }}
                  placeholder="SUB-SIZE-PCS-BATCH"
                  className={`${inputClass} font-mono font-bold tracking-wide bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800`}
                />
              </div>

              {/* 2. Size (mm) */}
              <div>
                <label className={labelClass}>2. Size (mm)</label>
                <input
                  value={form.sizeMm}
                  onChange={(e) => setForm({ ...form, sizeMm: e.target.value })}
                  placeholder="e.g. 8 x 6 mm"
                  className={`${inputClass} font-mono`}
                />
              </div>

              {/* 3. Colour */}
              <div>
                <label className={labelClass}>3. Colour</label>
                <input
                  value={form.colour}
                  onChange={(e) => setForm({ ...form, colour: e.target.value })}
                  placeholder="e.g. Pigeon Blood Red"
                  className={inputClass}
                />
              </div>

              {/* 4. Shape */}
              <div>
                <label className={labelClass}>4. Shape</label>
                <input
                  value={form.shapeCut}
                  onChange={(e) => setForm({ ...form, shapeCut: e.target.value })}
                  placeholder="e.g. Oval Mixed Cut"
                  className={inputClass}
                />
              </div>

              {/* 5. Sub-Category */}
              <div>
                <label className={labelClass}>
                  5. {bi('Sub-Category', 'ذیلی کیٹیگری', uiLanguage)}
                </label>
                <input
                  list="inventory-subcategory-list"
                  value={form.subCategory}
                  onChange={(e) => setForm({ ...form, subCategory: e.target.value })}
                  placeholder="Select or type sub-category"
                  className={inputClass}
                />
                <datalist id="inventory-subcategory-list">
                  {activeCategorySubList.map((sub) => (
                    <option key={sub} value={sub} />
                  ))}
                </datalist>
              </div>

              {/* 6. Category */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                    6. {bi('Category', 'کیٹیگری', uiLanguage)}
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveModule('categories')}
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                    title="Manage custom categories & sub-categories"
                  >
                    <Settings2 className="w-3 h-3" />
                    {bi('Manage', 'ترتیب', uiLanguage)}
                  </button>
                </div>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputClass}
                >
                  {Array.from(new Set([...categoryNames, form.category].filter(Boolean))).map(
                    (c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* 7. Stock Pieces */}
              <div>
                <label className={labelClass}>7. Stock Pieces</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={form.stockPieces}
                  onChange={(e) => setForm({ ...form, stockPieces: e.target.value })}
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </div>

              {/* 8. Item Unit */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                    8. {bi('Item Unit', 'آئٹم یونٹ', uiLanguage)}
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveModule('categories')}
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                    title="Manage custom item units"
                  >
                    <Settings2 className="w-3 h-3" />
                    {bi('Manage', 'ترتیب', uiLanguage)}
                  </button>
                </div>
                <select
                  value={form.itemUnit}
                  onChange={(e) => setForm({ ...form, itemUnit: e.target.value })}
                  className={inputClass}
                >
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* 9. Item Weight */}
              <div>
                <label className={labelClass}>
                  9. {bi('Item Weight', 'آئٹم وزن', uiLanguage)}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.oneTpWeight}
                  onChange={(e) => {
                    const wtStr = e.target.value;
                    const wtNum = Number(wtStr);
                    setForm((prev) => ({
                      ...prev,
                      oneTpWeight: wtStr,
                      cent: Number.isFinite(wtNum)
                        ? String(Math.round(wtNum * 100))
                        : prev.cent,
                    }));
                  }}
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </div>

              {/* 10. Batch # */}
              <div>
                <label className={labelClass}>10. Batch #</label>
                <input
                  value={form.batchNumber}
                  onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                  placeholder="e.g. B-2601"
                  className={`${inputClass} font-mono`}
                />
              </div>

              {/* 11. Stock Quantity */}
              <div>
                <label className={labelClass}>11. Stock Quantity</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.stockQty}
                  onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </div>

              {/* 12. Cent */}
              <div>
                <label className={labelClass}>12. Cent</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cent}
                  onChange={(e) => setForm({ ...form, cent: e.target.value })}
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </div>

              {/* 13. Fridge */}
              <div>
                <label className={labelClass}>13. Fridge</label>
                <input
                  value={form.fridge}
                  onChange={(e) => setForm({ ...form, fridge: e.target.value })}
                  placeholder="e.g. Fridge A / Tray 02"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Sequential Pricing Block: 14. Cost & 15. Price with World Currency + Rate -> PKR */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* 14. Cost */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    14. Cost
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {canViewCost ? `Evaluated: ${previewCostPkr}` : 'Cost Restricted'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">
                      Cost Amount
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.unitCost}
                      onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                      className={`${inputClass} font-mono tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">
                      Cost Currency
                    </label>
                    <WorldCurrencySelect
                      value={form.costCurrency}
                      onChange={handleCostCurrencyChange}
                      compact
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">
                      Rate → PKR (0 = Own Cur)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={form.costCurrency === 'PKR'}
                      value={form.costCurrency === 'PKR' ? '1' : form.costExchangeRate}
                      onChange={(e) =>
                        setForm({ ...form, costExchangeRate: e.target.value })
                      }
                      className={`${inputClass} font-mono tabular-nums disabled:opacity-60`}
                    />
                  </div>
                </div>
              </div>

              {/* 15. Price */}
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    15. Price{' '}
                    <span className="font-normal text-[11px] text-slate-500">
                      (+{profile.defaultMarkupPercent}% Markup)
                    </span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    Final: {formatMoney(previewSellCalc.finalDisplayAmount, previewSellCalc.finalCurrency)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">
                      Base Price
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.baseSellPrice}
                      onChange={(e) => setForm({ ...form, baseSellPrice: e.target.value })}
                      className={`${inputClass} font-mono tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">
                      Sell Currency
                    </label>
                    <WorldCurrencySelect
                      value={form.sellCurrency}
                      onChange={handleSellCurrencyChange}
                      compact
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">
                      Rate → PKR (0 = Own Cur)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={form.sellCurrency === 'PKR'}
                      value={form.sellCurrency === 'PKR' ? '1' : form.sellExchangeRate}
                      onChange={(e) =>
                        setForm({ ...form, sellExchangeRate: e.target.value })
                      }
                      className={`${inputClass} font-mono tabular-nums disabled:opacity-60`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sequential Grid: 16 -> 28 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {/* 16. Via (By Sea/ By Air) */}
              <div>
                <label className={labelClass}>16. Via (By Sea/ By Air)</label>
                <select
                  value={form.via}
                  onChange={(e) => setForm({ ...form, via: e.target.value })}
                  className={inputClass}
                >
                  {Array.from(new Set([...VIA_OPTIONS, form.via].filter(Boolean))).map(
                    (v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* 17. Purchase Date */}
              <div>
                <label className={labelClass}>17. Purchase Date</label>
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                  className={`${inputClass} font-mono`}
                />
              </div>

              {/* 18. Return/Loss/Damage */}
              <div>
                <label className={labelClass}>18. Return/Loss/Damage</label>
                <input
                  value={form.returnLossDamage}
                  onChange={(e) =>
                    setForm({ ...form, returnLossDamage: e.target.value })
                  }
                  placeholder="0 or e.g. 1 pc cracked"
                  className={inputClass}
                />
              </div>

              {/* 19. Gemstone */}
              <div>
                <label className={labelClass}>19. Gemstone</label>
                <input
                  value={form.gemstoneType}
                  onChange={(e) => setForm({ ...form, gemstoneType: e.target.value })}
                  placeholder="e.g. Natural Ruby"
                  className={inputClass}
                />
              </div>

              {/* 20. Origin */}
              <div>
                <label className={labelClass}>20. Origin</label>
                <input
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  placeholder="e.g. Mogok, Burma"
                  className={inputClass}
                />
              </div>

              {/* 21. Clarity */}
              <div>
                <label className={labelClass}>21. Clarity</label>
                <input
                  value={form.clarity}
                  onChange={(e) => setForm({ ...form, clarity: e.target.value })}
                  placeholder="e.g. VVS1, Eye Clean"
                  className={inputClass}
                />
              </div>

              {/* 22. Treatment */}
              <div>
                <label className={labelClass}>22. Treatment</label>
                <input
                  value={form.treatment}
                  onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                  placeholder="e.g. Unheated, Mild Oil"
                  className={inputClass}
                />
              </div>

              {/* 23. Cert Lab */}
              <div>
                <label className={labelClass}>23. Cert Lab</label>
                <input
                  value={form.certLab}
                  onChange={(e) => setForm({ ...form, certLab: e.target.value })}
                  placeholder="e.g. GRS, GIA, AGL"
                  className={inputClass}
                />
              </div>

              {/* 24. Cert No. */}
              <div>
                <label className={labelClass}>24. Cert No.</label>
                <input
                  value={form.certNumber}
                  onChange={(e) => setForm({ ...form, certNumber: e.target.value })}
                  placeholder="e.g. GRS2026-88412"
                  className={`${inputClass} font-mono`}
                />
              </div>

              {/* 25. Min Alert */}
              <div>
                <label className={labelClass}>25. Min Alert</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={form.minStockAlert}
                  onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })}
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </div>

              {/* 26. Vault / Box */}
              <div>
                <label className={labelClass}>26. Vault / Box</label>
                <input
                  value={form.vaultLocation}
                  onChange={(e) => setForm({ ...form, vaultLocation: e.target.value })}
                  placeholder="e.g. Vault A-1 / Box 04"
                  className={inputClass}
                />
              </div>

              {/* 27. Supplier/ Carrier */}
              <div>
                <label className={labelClass}>27. Supplier/ Carrier</label>
                <input
                  value={form.supplierName}
                  onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                  placeholder="e.g. Bangkok Gem Traders"
                  className={inputClass}
                />
              </div>

              {/* 28. Remarks */}
              <div className="sm:col-span-2 lg:col-span-2">
                <label className={labelClass}>28. Remarks</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Parcel notes, quality grade, carrier details..."
                  className={inputClass}
                />
              </div>

              {/* Optional Product Title */}
              <div className="sm:col-span-2 lg:col-span-2">
                <label className={labelClass}>
                  Product Title / Invoice Label{' '}
                  <span className="font-normal text-slate-400">(Auto-fills if blank)</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Leave blank to auto-build from Gemstone + Colour + Sub-Category + Size"
                  className={inputClass}
                />
              </div>

              {/* Camera Capture + Gallery Upload + Image Preview + Submit */}
              <div className="sm:col-span-2 lg:col-span-4 xl:col-span-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  {isPhotoLocked ? (
                    <button
                      type="button"
                      onClick={() => {
                        notify('Upgrade to Pro (4500 PKR/mo or 35000 PKR/yr) to capture & upload stock images.', 'info');
                        setActiveModule('subscription');
                      }}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-xs font-semibold text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 min-h-[40px]"
                    >
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>
                        {bi(
                          'Camera & Gallery Photo Upload (Pro Locked — Click to Unlock)',
                          'کیمرہ اور گیلری تصویر (پرو ورژن میں دستیاب)',
                          uiLanguage
                        )}
                      </span>
                      <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    </button>
                  ) : (
                    <>
                      {/* Direct Camera Button */}
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer min-h-[40px]">
                        <Camera className="w-4 h-4 shrink-0" />
                        <span>{bi('Take Photo (Camera)', 'کیمرہ تصویر', uiLanguage)}</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Phone Gallery Upload Button */}
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer min-h-[40px]">
                        <ImagePlus className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>{bi('Upload Gallery', 'گیلری سے اپلوڈ', uiLanguage)}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    </>
                  )}

                  {form.imageUrl && (
                    <div className="inline-flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                      <img
                        src={form.imageUrl}
                        alt="Stock preview"
                        className="w-8 h-8 rounded object-cover border border-slate-200 dark:border-slate-700"
                      />
                      <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        {bi('Photo Saved', 'تصویر منسلک ہے', uiLanguage)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, imageUrl: '' }))}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0 min-h-[40px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingItemId
                    ? bi('Update Product Entry', 'پراڈکٹ اپڈیٹ کریں', uiLanguage)
                    : bi('Save Product Entry', 'نیا اسٹاک محفوظ کریں', uiLanguage)}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, Size, Sub-Category, Batch #, Gemstone, Fridge, Vault, Remarks..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[38px]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 min-h-[38px]"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All Categories' : c}
              </option>
            ))}
          </select>

          <WorldCurrencySelect
            value={currencyFilter}
            onChange={setCurrencyFilter}
            includeAllOption
            allLabel="All Sell Currencies"
            compact
          />

          <select
            value={viaFilter}
            onChange={(e) => setViaFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 min-h-[38px]"
          >
            <option value="All">All Freight (Air / Sea)</option>
            {VIA_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as 'All' | 'Low' | 'Out' | 'In')}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 min-h-[38px]"
          >
            <option value="All">All Stock Levels</option>
            <option value="In">Healthy Stock</option>
            <option value="Low">Low Stock Alert</option>
            <option value="Out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* 28-COLUMN INVENTORY SPREADSHEET TABLE (EXACT SEQUENCE 1 -> 28) */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 whitespace-nowrap">
                <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-950 px-3 py-3 border-r border-slate-200 dark:border-slate-800">
                  1. SKU
                </th>
                <th className="px-3 py-3">2. Size (mm)</th>
                <th className="px-3 py-3">3. Colour</th>
                <th className="px-3 py-3">4. Shape</th>
                <th className="px-3 py-3">5. Sub-Category</th>
                <th className="px-3 py-3">6. Category</th>
                <th className="px-3 py-3 text-right">7. Stock Pieces</th>
                <th className="px-3 py-3">8. Item Unit</th>
                <th className="px-3 py-3 text-right">9. Item Weight</th>
                <th className="px-3 py-3">10. Batch #</th>
                <th className="px-3 py-3 text-right">11. Stock Quantity</th>
                <th className="px-3 py-3 text-right">12. Cent</th>
                <th className="px-3 py-3">13. Fridge</th>
                <th className="px-3 py-3 text-right">14. Cost</th>
                <th className="px-3 py-3 text-right">15. Price</th>
                <th className="px-3 py-3">16. Via (By Sea/ By Air)</th>
                <th className="px-3 py-3">17. Purchase Date</th>
                <th className="px-3 py-3">18. Return/Loss/Damage</th>
                <th className="px-3 py-3">19. Gemstone</th>
                <th className="px-3 py-3">20. Origin</th>
                <th className="px-3 py-3">21. Clarity</th>
                <th className="px-3 py-3">22. Treatment</th>
                <th className="px-3 py-3">23. Cert Lab</th>
                <th className="px-3 py-3">24. Cert No.</th>
                <th className="px-3 py-3 text-right">25. Min Alert</th>
                <th className="px-3 py-3">26. Vault / Box</th>
                <th className="px-3 py-3">27. Supplier/ Carrier</th>
                <th className="px-3 py-3 min-w-[180px]">28. Remarks</th>
                <th className="sticky right-0 z-20 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-right border-l border-slate-200 dark:border-slate-800">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={29}
                    className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No inventory items match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const costRate =
                    item.costCurrency === 'PKR'
                      ? 1
                      : typeof item.costExchangeRate === 'number'
                        ? item.costExchangeRate
                        : getRateForCurrency(item.costCurrency, profile);
                  const costConvertedLabel =
                    item.costCurrency !== 'PKR' && costRate === 0
                      ? formatMoney(item.unitCost, item.costCurrency)
                      : formatMoney(
                          convertToPkr(item.unitCost, item.costCurrency, costRate),
                          'PKR'
                        );

                  const sellCalc = computeItemFinalPkr(
                    item.baseSellPrice,
                    item.sellCurrency,
                    profile,
                    item.sellExchangeRate
                  );

                  const isOut = item.stockQty === 0;
                  const isLow = item.stockQty > 0 && item.stockQty <= item.minStockAlert;

                  return (
                    <tr
                      key={item.id}
                      className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 whitespace-nowrap"
                    >
                      {/* 1. SKU */}
                      <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/90 px-3 py-2.5 border-r border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt={item.sku}
                              className="w-7 h-7 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-slate-900 dark:text-white">
                              {item.sku}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                              {item.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Size (mm) */}
                      <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700 dark:text-slate-200">
                        {item.sizeMm || '—'}
                      </td>

                      {/* 3. Colour */}
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                        {item.colour || '—'}
                      </td>

                      {/* 4. Shape */}
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                        {item.shapeCut || '—'}
                      </td>

                      {/* 5. Sub-Category */}
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                        {item.subCategory || '—'}
                      </td>

                      {/* 6. Category */}
                      <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                        {item.category || '—'}
                      </td>

                      {/* 7. Stock Pieces */}
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800 dark:text-slate-100">
                        {item.stockPieces ?? 0}
                      </td>

                      {/* 8. Item Unit */}
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {item.itemUnit || 'Carats'}
                      </td>

                      {/* 9. 1TP Weight */}
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800 dark:text-slate-100">
                        {Number(item.oneTpWeight ?? item.weightCarats ?? 0).toFixed(2)}
                      </td>

                      {/* 10. Batch # */}
                      <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-200">
                        {item.batchNumber || '—'}
                      </td>

                      {/* 11. Stock Quantity */}
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-bold tabular-nums ${
                          isOut
                            ? 'text-rose-600 dark:text-rose-400'
                            : isLow
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {item.stockQty}
                      </td>

                      {/* 12. Cent */}
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                        {item.cent ?? 0}
                      </td>

                      {/* 13. Fridge */}
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                        {item.fridge || '—'}
                      </td>

                      {/* 14. Cost */}
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {canViewCost ? (
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              {formatMoney(item.unitCost, item.costCurrency)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {item.costCurrency !== 'PKR' && costRate === 0
                                ? 'Rate 0 (Own Cur)'
                                : costConvertedLabel}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Restricted</span>
                        )}
                      </td>

                      {/* 15. Price */}
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        <div className="font-bold text-emerald-700 dark:text-emerald-400">
                          {formatMoney(sellCalc.finalDisplayAmount, sellCalc.finalCurrency)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Base: {formatMoney(item.baseSellPrice, item.sellCurrency)}
                        </div>
                      </td>

                      {/* 16. Via (By Sea/ By Air) */}
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                        {item.via || '—'}
                      </td>

                      {/* 17. Purchase Date */}
                      <td className="px-3 py-2.5 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {item.purchaseDate || '—'}
                      </td>

                      {/* 18. Return/Loss/Damage */}
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                        {item.returnLossDamage || '0'}
                      </td>

                      {/* 19. Gemstone */}
                      <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                        {item.gemstoneType || '—'}
                      </td>

                      {/* 20. Origin */}
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                        {item.origin || '—'}
                      </td>

                      {/* 21. Clarity */}
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                        {item.clarity || '—'}
                      </td>

                      {/* 22. Treatment */}
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {item.treatment || '—'}
                      </td>

                      {/* 23. Cert Lab */}
                      <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-100">
                        {item.certLab || '—'}
                      </td>

                      {/* 24. Cert No. */}
                      <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-200">
                        {item.certNumber || '—'}
                      </td>

                      {/* 25. Min Alert */}
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {item.minStockAlert}
                      </td>

                      {/* 26. Vault / Box */}
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                        {item.vaultLocation || '—'}
                      </td>

                      {/* 27. Supplier/ Carrier */}
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                        {item.supplierName || '—'}
                      </td>

                      {/* 28. Remarks */}
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 max-w-[240px] truncate">
                        {item.notes || '—'}
                      </td>

                      {/* Actions */}
                      <td className="sticky right-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/90 px-3 py-2.5 text-right border-l border-slate-200 dark:border-slate-800">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setQrItem(item)}
                            title="Generate QR Label"
                            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditItem(item)}
                                title="Edit Product Entry"
                                className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <DeleteActionButton
                                title={`Delete ${item.sku}`}
                                onConfirm={() => deleteInventoryItem(item.id)}
                              />
                            </>
                          )}
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

      {qrItem && <QrTagModal item={qrItem} onClose={() => setQrItem(null)} />}
    </div>
  );
};

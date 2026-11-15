import React, { useMemo, useState } from 'react';
import {
  Edit3,
  FileDown,
  FileSpreadsheet,
  Gem,
  Plus,
  QrCode,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { CurrencyCode, InventoryItem } from '../types/business';
import {
  computeItemFinalPkr,
  convertToPkr,
  formatMoney,
} from '../utils/currency';
import {
  exportInventoryCsv,
  exportInventoryExcel,
  exportInventoryPdf,
} from '../utils/exporters';
import { QrTagModal } from '../components/QrTagModal';

const EMPTY_FORM: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
  sku: '',
  name: '',
  category: 'Loose Gemstone',
  gemstoneType: 'Ruby',
  origin: 'Burma',
  shapeCut: 'Oval Mixed',
  colour: '',
  clarity: 'Eye Clean',
  weightCarats: 1.0,
  sizeMm: '',
  treatment: 'Unheated / Natural',
  certLab: 'GIA',
  certNumber: '',
  stockQty: 1,
  minStockAlert: 1,
  vaultLocation: 'Vault A-01',
  supplierName: '',
  costCurrency: 'RMB',
  unitCost: 0,
  sellCurrency: 'RMB',
  baseSellPrice: 0,
  imageUrl: '',
  notes: '',
};

export const InventoryView: React.FC = () => {
  const {
    inventory,
    profile,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    hasPermission,
  } = useBusiness();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [currencyFilter, setCurrencyFilter] = useState<'All' | CurrencyCode>('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'In Stock' | 'Low Stock' | 'Out'>('All');

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [qrItem, setQrItem] = useState<InventoryItem | null>(null);

  const canEdit = hasPermission('edit_inventory');
  const canViewCost = hasPermission('view_profit');

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(inventory.map((i) => i.category).filter(Boolean)))],
    [inventory]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (currencyFilter !== 'All' && item.sellCurrency !== currencyFilter) return false;
      if (stockFilter === 'In Stock' && item.stockQty <= 0) return false;
      if (stockFilter === 'Low Stock' && (item.stockQty <= 0 || item.stockQty > item.minStockAlert))
        return false;
      if (stockFilter === 'Out' && item.stockQty > 0) return false;

      if (!q) return true;
      return (
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.gemstoneType.toLowerCase().includes(q) ||
        item.certNumber.toLowerCase().includes(q) ||
        item.colour.toLowerCase().includes(q) ||
        item.origin.toLowerCase().includes(q) ||
        item.supplierName.toLowerCase().includes(q)
      );
    });
  }, [inventory, search, categoryFilter, currencyFilter, stockFilter]);

  const openAdd = () => {
    setEditingItem(null);
    setForm({
      ...EMPTY_FORM,
      sku: `NAG-GM-${Math.floor(100 + Math.random() * 899)}`,
    });
    setShowModal(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      sku: item.sku,
      name: item.name,
      category: item.category,
      gemstoneType: item.gemstoneType,
      origin: item.origin,
      shapeCut: item.shapeCut,
      colour: item.colour,
      clarity: item.clarity,
      weightCarats: item.weightCarats,
      sizeMm: item.sizeMm,
      treatment: item.treatment,
      certLab: item.certLab,
      certNumber: item.certNumber,
      stockQty: item.stockQty,
      minStockAlert: item.minStockAlert,
      vaultLocation: item.vaultLocation,
      supplierName: item.supplierName,
      costCurrency: item.costCurrency,
      unitCost: item.unitCost,
      sellCurrency: item.sellCurrency,
      baseSellPrice: item.baseSellPrice,
      imageUrl: item.imageUrl || '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) return;
    if (editingItem) {
      updateInventoryItem(editingItem.id, form);
    } else {
      addInventoryItem(form);
    }
    setShowModal(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, imageUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      {/* Header & Exports */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            22-Column Gemstone & Jewelry Inventory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {filtered.length} of {inventory.length} items · Rates: RMB {profile.rmbToPkr} /
            USD {profile.usdToPkr} · Markup {profile.defaultMarkupPercent}%
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportInventoryExcel(filtered, profile)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            Excel (.xlsx)
          </button>
          <button
            onClick={() => exportInventoryCsv(filtered, profile)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <FileDown className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => exportInventoryPdf(filtered, profile)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <FileDown className="w-4 h-4 text-rose-600" />
            PDF
          </button>
          {canEdit && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              Add Gemstone / Item
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, gemstone name, certificate number, colour, origin, or supplier..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[40px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 min-h-[40px]"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                Category: {cat}
              </option>
            ))}
          </select>

          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value as 'All' | CurrencyCode)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 min-h-[40px]"
          >
            <option value="All">All Currencies</option>
            <option value="RMB">RMB (¥)</option>
            <option value="USD">USD ($)</option>
            <option value="PKR">PKR (Rs)</option>
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
            {(['All', 'In Stock', 'Low Stock', 'Out'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStockFilter(st)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  stockFilter === st
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 22-Column High-Density Desktop / Tablet Table */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-[2150px]">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3 font-semibold sticky left-0 bg-slate-50 dark:bg-slate-950 z-10 border-r border-slate-200 dark:border-slate-800">
                  1. SKU
                </th>
                <th className="py-3 px-3 font-semibold">2. Product Name</th>
                <th className="py-3 px-3 font-semibold">3. Category</th>
                <th className="py-3 px-3 font-semibold">4. Gemstone</th>
                <th className="py-3 px-3 font-semibold">5. Origin</th>
                <th className="py-3 px-3 font-semibold">6. Shape / Cut</th>
                <th className="py-3 px-3 font-semibold">7. Colour</th>
                <th className="py-3 px-3 font-semibold">8. Clarity</th>
                <th className="py-3 px-3 font-semibold text-right">9. Weight (ct)</th>
                <th className="py-3 px-3 font-semibold">10. Size (mm)</th>
                <th className="py-3 px-3 font-semibold">11. Treatment</th>
                <th className="py-3 px-3 font-semibold">12. Cert Lab</th>
                <th className="py-3 px-3 font-semibold">13. Cert No.</th>
                <th className="py-3 px-3 font-semibold text-right">14. Stock Qty</th>
                <th className="py-3 px-3 font-semibold text-right">15. Min Alert</th>
                <th className="py-3 px-3 font-semibold">16. Vault / Box</th>
                <th className="py-3 px-3 font-semibold">17. Supplier</th>
                <th className="py-3 px-3 font-semibold">18. Cost Cur</th>
                <th className="py-3 px-3 font-semibold text-right">19. Cost (Orig)</th>
                <th className="py-3 px-3 font-semibold">20. Sell Cur</th>
                <th className="py-3 px-3 font-semibold text-right">21. Base Sell</th>
                <th className="py-3 px-3 font-semibold text-right">22. Final PKR (+{profile.defaultMarkupPercent}%)</th>
                <th className="py-3 px-3 font-semibold text-right sticky right-0 bg-slate-50 dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={23} className="py-12 text-center text-slate-500">
                    No gemstones match your current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const costPkr = convertToPkr(
                    item.unitCost,
                    item.costCurrency,
                    profile.rmbToPkr,
                    profile.usdToPkr
                  );
                  const sellCalc = computeItemFinalPkr(
                    item.baseSellPrice,
                    item.sellCurrency,
                    profile
                  );

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-emerald-700 dark:text-emerald-400 sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        {item.sku}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5 min-w-[210px]">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
                              <Gem className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                            </div>
                          )}
                          <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {item.category}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                        {item.gemstoneType}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {item.origin || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {item.shapeCut || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-200">
                        {item.colour || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {item.clarity || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                        {item.weightCarats.toFixed(2)} ct
                      </td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {item.sizeMm || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {item.treatment || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium">
                        {item.certLab || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap text-slate-700 dark:text-slate-200">
                        {item.certNumber || '—'}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                          item.stockQty <= 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : item.stockQty <= item.minStockAlert
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {item.stockQty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                        {item.minStockAlert}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {item.vaultLocation || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300 max-w-[160px] truncate">
                        {item.supplierName || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                        {canViewCost ? item.costCurrency : '—'}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right font-mono whitespace-nowrap"
                        title={canViewCost ? `~ ${formatMoney(costPkr, 'PKR')}` : ''}
                      >
                        {canViewCost ? formatMoney(item.unitCost, item.costCurrency) : 'Restricted'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                        {item.sellCurrency}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                        {formatMoney(item.baseSellPrice, item.sellCurrency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {formatMoney(sellCalc.finalPkr, 'PKR')}
                      </td>
                      <td className="py-2.5 px-3 text-right sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setQrItem(item)}
                            title="Generate QR Label"
                            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => openEdit(item)}
                                title="Edit Item"
                                className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteInventoryItem(item.id)}
                                title="Delete Item"
                                className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

      {/* Add / Edit 22-Field Inventory Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 md:p-6 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl my-auto overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {editingItem ? `Edit Gemstone (${editingItem.sku})` : 'Add New Gemstone / Jewelry Item'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    1. SKU / Barcode *
                  </label>
                  <input
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    2. Product Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    3. Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  >
                    <option>Loose Gemstone</option>
                    <option>Jewelry Ring</option>
                    <option>Necklace</option>
                    <option>Bracelet</option>
                    <option>Earrings</option>
                    <option>Lot / Parcel</option>
                    <option>Rough Stone</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    4. Gemstone Type
                  </label>
                  <input
                    value={form.gemstoneType}
                    onChange={(e) => setForm({ ...form, gemstoneType: e.target.value })}
                    placeholder="Ruby, Emerald, Sapphire..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    5. Origin
                  </label>
                  <input
                    value={form.origin}
                    onChange={(e) => setForm({ ...form, origin: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    6. Shape / Cut
                  </label>
                  <input
                    value={form.shapeCut}
                    onChange={(e) => setForm({ ...form, shapeCut: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    7. Colour
                  </label>
                  <input
                    value={form.colour}
                    onChange={(e) => setForm({ ...form, colour: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    8. Clarity
                  </label>
                  <input
                    value={form.clarity}
                    onChange={(e) => setForm({ ...form, clarity: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    9. Weight (Carats)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.weightCarats}
                    onChange={(e) => setForm({ ...form, weightCarats: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    10. Size / Dimensions (mm)
                  </label>
                  <input
                    value={form.sizeMm}
                    onChange={(e) => setForm({ ...form, sizeMm: e.target.value })}
                    placeholder="9.4 x 7.2 x 4.8 mm"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    11. Treatment
                  </label>
                  <input
                    value={form.treatment}
                    onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    12. Certificate Lab
                  </label>
                  <input
                    value={form.certLab}
                    onChange={(e) => setForm({ ...form, certLab: e.target.value })}
                    placeholder="GIA, GRS, SSEF, AIGS..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    13. Certificate Number
                  </label>
                  <input
                    value={form.certNumber}
                    onChange={(e) => setForm({ ...form, certNumber: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    14. Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.stockQty}
                    onChange={(e) => setForm({ ...form, stockQty: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    15. Min Stock Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.minStockAlert}
                    onChange={(e) => setForm({ ...form, minStockAlert: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    16. Box / Vault Location
                  </label>
                  <input
                    value={form.vaultLocation}
                    onChange={(e) => setForm({ ...form, vaultLocation: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    17. Supplier
                  </label>
                  <input
                    value={form.supplierName}
                    onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    18. Cost Currency
                  </label>
                  <select
                    value={form.costCurrency}
                    onChange={(e) =>
                      setForm({ ...form, costCurrency: e.target.value as CurrencyCode })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                  >
                    <option value="RMB">RMB</option>
                    <option value="USD">USD</option>
                    <option value="PKR">PKR</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    19. Unit Cost ({form.costCurrency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unitCost}
                    onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    20. Selling Currency
                  </label>
                  <select
                    value={form.sellCurrency}
                    onChange={(e) =>
                      setForm({ ...form, sellCurrency: e.target.value as CurrencyCode })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                  >
                    <option value="RMB">RMB</option>
                    <option value="USD">USD</option>
                    <option value="PKR">PKR</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    21. Base Sell Price ({form.sellCurrency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.baseSellPrice}
                    onChange={(e) => setForm({ ...form, baseSellPrice: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    22. Auto Final PKR (+{profile.defaultMarkupPercent}%)
                  </label>
                  <div className="w-full rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 font-mono font-bold text-emerald-800 dark:text-emerald-300">
                    {formatMoney(
                      computeItemFinalPkr(form.baseSellPrice, form.sellCurrency, profile).finalPkr,
                      'PKR'
                    )}
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Gemstone Photo (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full text-xs text-slate-600 dark:text-slate-300"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Notes
                  </label>
                  <input
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  {editingItem ? 'Save Changes' : 'Add to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrItem && <QrTagModal item={qrItem} onClose={() => setQrItem(null)} />}
    </div>
  );
};

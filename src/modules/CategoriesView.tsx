import React, { useMemo, useState } from 'react';
import {
  Check,
  Crown,
  Edit3,
  FolderPlus,
  Layers,
  Lock,
  Plus,
  Ruler,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { DeleteActionButton } from '../components/DeleteActionButton';
import { bi } from '../utils/bilingual';

export const CategoriesView: React.FC = () => {
  const {
    customCategories,
    customUnits,
    inventory,
    uiLanguage,
    hasPermission,
    isFeatureLocked,
    setActiveModule,
    addCategory,
    updateCategory,
    deleteCategory,
    addSubCategory,
    renameSubCategory,
    deleteSubCategory,
    addItemUnit,
    renameItemUnit,
    deleteItemUnit,
    notify,
  } = useBusiness();

  const isLockedByPlan = isFeatureLocked('category_management');
  const canEdit = hasPermission('edit_inventory') && !isLockedByPlan;

  // New Category form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatUr, setNewCatUr] = useState('');
  const [newCatSubs, setNewCatSubs] = useState('');
  const [search, setSearch] = useState('');

  // Inline editing category state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatUr, setEditCatUr] = useState('');

  // Inline sub-category add/edit state per category
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});
  const [editingSub, setEditingSub] = useState<{
    categoryId: string;
    oldName: string;
    value: string;
  } | null>(null);

  // Item Unit add/edit state
  const [newUnitName, setNewUnitName] = useState('');
  const [editingUnit, setEditingUnit] = useState<{ oldName: string; value: string } | null>(null);

  const itemCountsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of inventory) {
      const key = (item.category || '').trim().toLowerCase();
      if (key) map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [inventory]);

  const itemCountsBySubCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of inventory) {
      const key = `${(item.category || '').trim().toLowerCase()}::${(item.subCategory || '').trim().toLowerCase()}`;
      if (item.subCategory) map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [inventory]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customCategories;
    return customCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nameUr || '').toLowerCase().includes(q) ||
        c.subCategories.some((s) => s.toLowerCase().includes(q))
    );
  }, [customCategories, search]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const clean = newCatName.trim();
    if (!clean) {
      notify('Enter a category name.', 'error');
      return;
    }
    if (customCategories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      notify(`Category "${clean}" already exists.`, 'error');
      return;
    }
    const subs = newCatSubs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    addCategory(clean, newCatUr.trim() || undefined, subs);
    setNewCatName('');
    setNewCatUr('');
    setNewCatSubs('');
  };

  const handleSaveCategoryEdit = (catId: string) => {
    const clean = editCatName.trim();
    if (!clean) return;
    updateCategory(catId, {
      name: clean,
      nameUr: editCatUr.trim() || undefined,
    });
    setEditingCatId(null);
  };

  const handleAddSub = (categoryId: string) => {
    const val = (subDrafts[categoryId] || '').trim();
    if (!val) return;
    addSubCategory(categoryId, val);
    setSubDrafts((prev) => ({ ...prev, [categoryId]: '' }));
  };

  const handleSaveSubRename = () => {
    if (!editingSub) return;
    const clean = editingSub.value.trim();
    if (!clean) return;
    renameSubCategory(editingSub.categoryId, editingSub.oldName, clean);
    setEditingSub(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {bi(
                  'Category, Sub-Category & Item Unit Manager',
                  'کیٹیگری، ذیلی کیٹیگری اور آئٹم یونٹ مینجمنٹ',
                  uiLanguage
                )}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {bi(
                'Add, edit, or delete custom categories, sub-categories, and item units. Saved in local & cloud database and shown across Inventory & all Stock Reports.',
                'نئی کیٹیگریز، ذیلی اقسام اور یونٹس شامل، تبدیل یا حذف کریں۔ انوینٹری اور تمام اسٹاک رپورٹس میں دستیاب۔',
                uiLanguage
              )}
            </p>
          </div>
          <div className="font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            Categories: <strong className="text-slate-900 dark:text-white">{customCategories.length}</strong>
            {' · '}
            Item Units: <strong className="text-slate-900 dark:text-white">{customUnits.length}</strong>
          </div>
        </div>
      </div>

      {isLockedByPlan && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-200">
            <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>
                {bi(
                  'Category, Sub-Category & Item Unit Management is locked on Free / Basic Version.',
                  'مفت ورژن میں کیٹیگری اور آئٹم یونٹ ترمیم لاک ہے۔',
                  uiLanguage
                )}
              </strong>
              <p className="text-[11px] opacity-90 mt-0.5">
                Upgrade to Monthly (4500 PKR / Month) or Yearly (35000 PKR / Year) via EasyPaisa / Meezan Bank to freely add, edit, and delete categories, sub-categories, and item units.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('subscription')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 min-h-[38px]"
          >
            <Crown className="w-3.5 h-3.5" />
            Unlock Pro Version
          </button>
        </div>
      )}

      {/* Item Unit Management Card */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {bi('Item Unit Master List (Add / Edit / Delete)', 'آئٹم یونٹ فہرست (شامل / تبدیل / حذف)', uiLanguage)}
            </h3>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <input
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!newUnitName.trim()) return;
                    addItemUnit(newUnitName);
                    setNewUnitName('');
                  }
                }}
                placeholder={bi('New Unit (e.g. Carats, Tola, Box)...', 'نیا یونٹ لکھیں...', uiLanguage)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs min-h-[36px]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newUnitName.trim()) {
                    notify('Enter an Item Unit name.', 'error');
                    return;
                  }
                  addItemUnit(newUnitName);
                  setNewUnitName('');
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-1.5 text-xs font-semibold text-white whitespace-nowrap min-h-[36px]"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Unit
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {customUnits.map((unit) => {
            const isEditingThisUnit = editingUnit?.oldName === unit;
            const unitCount = inventory.filter(
              (i) => (i.itemUnit || '').toLowerCase() === unit.toLowerCase()
            ).length;

            return (
              <div
                key={unit}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              >
                {isEditingThisUnit ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      value={editingUnit.value}
                      onChange={(e) =>
                        setEditingUnit({ ...editingUnit, value: e.target.value })
                      }
                      className="flex-1 rounded border border-emerald-500 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (editingUnit.value.trim()) {
                          renameItemUnit(editingUnit.oldName, editingUnit.value);
                          setEditingUnit(null);
                        }
                      }}
                      className="p-1 rounded bg-emerald-700 text-white"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUnit(null)}
                      className="p-1 rounded text-slate-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-white">{unit}</span>
                      <span className="ml-1.5 font-mono text-[11px] text-slate-500">({unitCount})</span>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingUnit({ oldName: unit, value: unit })}
                          className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          title={`Edit ${unit}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <DeleteActionButton
                          title={`Delete unit ${unit}`}
                          onConfirm={() => deleteItemUnit(unit)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add New Custom Category Form */}
      {canEdit && (
        <form
          onSubmit={handleAddCategory}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
            <FolderPlus className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>{bi('Add New Custom Category', 'نئی کیٹیگری شامل کریں', uiLanguage)}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {bi('Category Name *', 'کیٹیگری کا نام *', uiLanguage)}
              </label>
              <input
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Precious Beads"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {bi('Urdu Label (Optional)', 'اردو نام (اختیاری)', uiLanguage)}
              </label>
              <input
                value={newCatUr}
                onChange={(e) => setNewCatUr(e.target.value)}
                dir="auto"
                placeholder="مثال: قیمتی موتی"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {bi('Initial Sub-Categories (comma separated)', 'ابتدائی ذیلی کیٹیگریز', uiLanguage)}
              </label>
              <input
                value={newCatSubs}
                onChange={(e) => setNewCatSubs(e.target.value)}
                placeholder="e.g. Smooth Round, Faceted Drops"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 min-h-[38px]"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white min-h-[38px]"
              >
                <Plus className="w-4 h-4" />
                {bi('Save Category', 'کیٹیگری محفوظ کریں', uiLanguage)}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={bi('Search category or sub-category...', 'کیٹیگری یا ذیلی کیٹیگری تلاش کریں...', uiLanguage)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 min-h-[38px]"
          />
        </div>
      </div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredCategories.map((cat) => {
          const isEditingThis = editingCatId === cat.id;
          const catCount = itemCountsByCategory.get(cat.name.toLowerCase()) || 0;

          return (
            <div
              key={cat.id}
              className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Category Header */}
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-2">
                  {isEditingThis ? (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        className="rounded-md border border-emerald-500 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold"
                        placeholder="Category Name"
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          value={editCatUr}
                          onChange={(e) => setEditCatUr(e.target.value)}
                          dir="auto"
                          className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                          placeholder="اردو نام"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCategoryEdit(cat.id)}
                          className="p-1.5 rounded bg-emerald-700 text-white hover:bg-emerald-800"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatId(null)}
                          className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {cat.name}
                          {cat.nameUr && (
                            <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                              ({cat.nameUr})
                            </span>
                          )}
                        </h3>
                        <p className="text-[11px] font-mono text-slate-500">
                          {cat.subCategories.length} sub-categories · {catCount} stock items
                        </p>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatId(cat.id);
                              setEditCatName(cat.name);
                              setEditCatUr(cat.nameUr || '');
                            }}
                            title="Edit Category"
                            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <DeleteActionButton
                            title={`Delete category ${cat.name}`}
                            onConfirm={() => deleteCategory(cat.id)}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Sub-Categories List */}
                <div className="p-4 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {bi('Sub-Categories', 'ذیلی کیٹیگریز', uiLanguage)}
                  </p>
                  {cat.subCategories.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      {bi('No sub-categories yet.', 'ابھی کوئی ذیلی کیٹیگری نہیں ہے۔', uiLanguage)}
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                      {cat.subCategories.map((sub) => {
                        const isEditingSub =
                          editingSub?.categoryId === cat.id && editingSub.oldName === sub;
                        const subCount =
                          itemCountsBySubCategory.get(
                            `${cat.name.toLowerCase()}::${sub.toLowerCase()}`
                          ) || 0;

                        return (
                          <div
                            key={sub}
                            className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                          >
                            {isEditingSub ? (
                              <div className="flex-1 flex items-center gap-1.5">
                                <input
                                  value={editingSub.value}
                                  onChange={(e) =>
                                    setEditingSub({ ...editingSub, value: e.target.value })
                                  }
                                  className="flex-1 rounded border border-emerald-500 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveSubRename}
                                  className="p-1 rounded bg-emerald-700 text-white"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSub(null)}
                                  className="p-1 rounded text-slate-500"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 min-w-0">
                                  <Tag className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                                  <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                                    {sub}
                                  </span>
                                  <span className="font-mono text-[11px] text-slate-400">
                                    ({subCount})
                                  </span>
                                </div>
                                {canEdit && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingSub({
                                          categoryId: cat.id,
                                          oldName: sub,
                                          value: sub,
                                        })
                                      }
                                      title={`Rename ${sub}`}
                                      className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <DeleteActionButton
                                      title={`Delete sub-category ${sub}`}
                                      onConfirm={() => deleteSubCategory(cat.id, sub)}
                                    />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Sub-Category inline bar */}
              {canEdit && (
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center gap-2">
                  <input
                    value={subDrafts[cat.id] || ''}
                    onChange={(e) =>
                      setSubDrafts((prev) => ({ ...prev, [cat.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSub(cat.id);
                      }
                    }}
                    placeholder={bi(
                      `Add sub-category to ${cat.name}...`,
                      `ذیلی کیٹیگری شامل کریں...`,
                      uiLanguage
                    )}
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 min-h-[36px]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddSub(cat.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 dark:bg-emerald-700 hover:bg-slate-900 dark:hover:bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap min-h-[36px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {bi('Add Sub', 'شامل کریں', uiLanguage)}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

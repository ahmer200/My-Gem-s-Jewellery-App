import React, { useMemo, useState } from 'react';
import {
  Building2,
  Contact,
  Edit3,
  FileDown,
  FileSpreadsheet,
  MapPin,
  Phone,
  Plus,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { CurrencyCode, PartyAccount, PartyType } from '../types/business';
import { convertToPkr, formatMoney, getRateForCurrency } from '../utils/currency';
import { exportGenericReportExcel, exportGenericReportPdf } from '../utils/exporters';
import { DeleteActionButton } from '../components/DeleteActionButton';
import { WorldCurrencySelect } from '../components/WorldCurrencySelect';

export const PartiesView: React.FC = () => {
  const {
    parties,
    sales,
    purchases,
    profile,
    addParty,
    updateParty,
    deleteParty,
    hasPermission,
    notify,
  } = useBusiness();

  const canManage =
    hasPermission('create_sales') ||
    hasPermission('record_purchases') ||
    hasPermission('manage_payments');
  const canExport = hasPermission('export_reports');

  const [filterType, setFilterType] = useState<'All' | 'Customer' | 'Vendor'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state (supports both Create & Edit at any time)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [partyType, setPartyType] = useState<PartyType>('Customer');
  const [name, setName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimitInput, setCreditLimitInput] = useState('500000');
  const [creditCurrency, setCreditCurrency] = useState<CurrencyCode>('PKR');
  const [creditExchangeRateInput, setCreditExchangeRateInput] = useState('1');
  const [notes, setNotes] = useState('');

  const handleCreditCurrencyChange = (cur: CurrencyCode) => {
    setCreditCurrency(cur);
    setCreditExchangeRateInput(String(getRateForCurrency(cur, profile)));
  };

  const resetForm = () => {
    setEditingId(null);
    setPartyType('Customer');
    setName('');
    setContactNumber('');
    setCity('');
    setAddress('');
    setCreditLimitInput('500000');
    setCreditCurrency('PKR');
    setCreditExchangeRateInput('1');
    setNotes('');
  };

  const startEditParty = (party: PartyAccount) => {
    const cur = party.creditCurrency || 'PKR';
    const rate =
      cur === 'PKR'
        ? 1
        : typeof party.creditExchangeRate === 'number'
          ? party.creditExchangeRate
          : getRateForCurrency(cur, profile);
    setEditingId(party.id);
    setPartyType(party.partyType);
    setName(party.name);
    setContactNumber(party.contactNumber || '');
    setCity(party.city || '');
    setAddress(party.address || '');
    setCreditLimitInput(String(party.creditLimit ?? 0));
    setCreditCurrency(cur);
    setCreditExchangeRateInput(String(rate));
    setNotes(party.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      notify('Permission required to add or edit customer/vendor profiles.', 'error');
      return;
    }
    if (!name.trim()) {
      notify('Please enter customer or vendor name.', 'error');
      return;
    }

    const activeCreditRate =
      creditCurrency === 'PKR' ? 1 : Math.max(0, Number(creditExchangeRateInput) || 0);

    const payload = {
      partyType,
      name: name.trim(),
      contactNumber: contactNumber.trim(),
      city: city.trim(),
      address: address.trim(),
      creditLimit: Math.max(0, Number(creditLimitInput) || 0),
      creditCurrency,
      creditExchangeRate: activeCreditRate,
      notes: notes.trim(),
    };

    if (editingId) {
      updateParty(editingId, payload);
      resetForm();
      return;
    }

    addParty(payload);
    resetForm();
  };

  // Compute live receivables (sales) & payables (purchases) per party name
  const partyBalances = useMemo(() => {
    const map = new Map<string, { receivablePkr: number; payablePkr: number; ordersCount: number }>();
    for (const s of sales) {
      const key = s.customerName.trim().toLowerCase();
      const cur = map.get(key) || { receivablePkr: 0, payablePkr: 0, ordersCount: 0 };
      cur.receivablePkr += Math.max(0, s.finalTotalPkrEquivalent - s.paidAmountPkr);
      cur.ordersCount += 1;
      map.set(key, cur);
    }
    for (const p of purchases) {
      const key = p.supplierName.trim().toLowerCase();
      const cur = map.get(key) || { receivablePkr: 0, payablePkr: 0, ordersCount: 0 };
      cur.payablePkr += Math.max(0, p.totalPkr - p.paidPkr);
      cur.ordersCount += 1;
      map.set(key, cur);
    }
    return map;
  }, [sales, purchases]);

  const filteredParties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return parties.filter((p) => {
      if (filterType === 'Customer' && p.partyType !== 'Customer' && p.partyType !== 'Both') {
        return false;
      }
      if (filterType === 'Vendor' && p.partyType !== 'Vendor' && p.partyType !== 'Both') {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.contactNumber.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q)
      );
    });
  }, [parties, filterType, searchQuery]);

  const stats = useMemo(() => {
    const customers = parties.filter((p) => p.partyType === 'Customer' || p.partyType === 'Both');
    const vendors = parties.filter((p) => p.partyType === 'Vendor' || p.partyType === 'Both');
    const totalReceivablesPkr = sales.reduce(
      (sum, s) => sum + Math.max(0, s.finalTotalPkrEquivalent - s.paidAmountPkr),
      0
    );
    const totalPayablesPkr = purchases.reduce(
      (sum, p) => sum + Math.max(0, p.totalPkr - p.paidPkr),
      0
    );
    return {
      customerCount: customers.length,
      vendorCount: vendors.length,
      totalReceivablesPkr,
      totalPayablesPkr,
    };
  }, [parties, sales, purchases]);

  const handleExportExcel = () => {
    const headers = [
      'Type',
      'Name',
      'Contact Number',
      'City',
      'Address',
      'Credit Limit',
      'Currency',
      'Credit Limit (PKR Eqv.)',
      'Open Receivable (PKR)',
      'Open Payable (PKR)',
      'Notes',
    ];
    const rows = filteredParties.map((p) => {
      const bal = partyBalances.get(p.name.trim().toLowerCase()) || {
        receivablePkr: 0,
        payablePkr: 0,
      };
      const rate =
        p.creditCurrency === 'PKR'
          ? 1
          : typeof p.creditExchangeRate === 'number'
            ? p.creditExchangeRate
            : getRateForCurrency(p.creditCurrency, profile);
      const isOrigMode = p.creditCurrency !== 'PKR' && rate === 0;
      const limitConverted = isOrigMode
        ? formatMoney(p.creditLimit, p.creditCurrency)
        : formatMoney(convertToPkr(p.creditLimit, p.creditCurrency, rate), 'PKR');
      return [
        p.partyType,
        p.name,
        p.contactNumber || '—',
        p.city || '—',
        p.address || '—',
        p.creditLimit,
        p.creditCurrency,
        limitConverted,
        formatMoney(bal.receivablePkr, 'PKR'),
        formatMoney(bal.payablePkr, 'PKR'),
        p.notes || '',
      ];
    });
    const defCur = profile.defaultCurrency || 'CNY';
    exportGenericReportExcel('Customers_and_Vendors_Directory', headers, rows, [
      ['Merchant', profile.companyName],
      ['Default Currency', `${defCur} -> PKR ${getRateForCurrency(defCur, profile)}`],
      ['Generated', new Date().toLocaleString()],
    ]);
  };

  const handleExportPdf = () => {
    const headers = [
      'Type',
      'Name',
      'Contact',
      'City',
      'Address',
      'Credit Limit',
      'Open Due (PKR)',
      'Payable (PKR)',
    ];
    const rows = filteredParties.map((p) => {
      const bal = partyBalances.get(p.name.trim().toLowerCase()) || {
        receivablePkr: 0,
        payablePkr: 0,
      };
      return [
        p.partyType,
        p.name,
        p.contactNumber || '—',
        p.city || '—',
        p.address || '—',
        formatMoney(p.creditLimit, p.creditCurrency),
        formatMoney(bal.receivablePkr, 'PKR'),
        formatMoney(bal.payablePkr, 'PKR'),
      ];
    });
    exportGenericReportPdf(
      'Customers & Vendors Directory',
      `Total Profiles: ${filteredParties.length} (Editable Address, Contact, City & Credit Limit)`,
      headers,
      rows,
      profile
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Customers & Vendors Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage and edit customer & vendor address, contact number, city, and credit limits anytime
          </p>
        </div>

        {canExport && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 min-h-[40px]"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Saved Customers</span>
            <Contact className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="mt-1.5 font-mono text-xl font-bold text-slate-900 dark:text-white">
            {stats.customerCount}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Saved Vendors / Suppliers</span>
            <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="mt-1.5 font-mono text-xl font-bold text-slate-900 dark:text-white">
            {stats.vendorCount}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Open Customer Dues</span>
            <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-1.5 font-mono text-lg font-bold text-amber-700 dark:text-amber-400">
            {formatMoney(stats.totalReceivablesPkr, 'PKR')}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Open Vendor Payables</span>
            <Wallet className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-1.5 font-mono text-lg font-bold text-rose-600 dark:text-rose-400">
            {formatMoney(stats.totalPayablesPkr, 'PKR')}
          </p>
        </div>
      </div>

      {/* Add / Edit Customer or Vendor Form */}
      {canManage && (
        <form
          onSubmit={handleSave}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Contact className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              {editingId ? 'Edit Customer / Vendor Profile' : 'Add New Customer / Vendor'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Party Type *
              </label>
              <select
                value={partyType}
                onChange={(e) => setPartyType(e.target.value as PartyType)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-semibold"
              >
                <option value="Customer">Customer</option>
                <option value="Vendor">Vendor / Supplier</option>
                <option value="Both">Both (Customer & Vendor)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name / Business Name *
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Haji Tariq Mehmood Jewellers"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Contact Number / WhatsApp
              </label>
              <input
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                City
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Rawalpindi / Lahore / Guangzhou / Dubai"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div className="lg:col-span-2">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Street / Market Address
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop #, Market / Plaza, Road..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Credit Limit
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={creditLimitInput}
                onChange={(e) => setCreditLimitInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Currency
              </label>
              <WorldCurrencySelect
                value={creditCurrency}
                onChange={handleCreditCurrencyChange}
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Rate → PKR (0 = Orig)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={creditCurrency === 'PKR'}
                value={creditCurrency === 'PKR' ? '1' : creditExchangeRateInput}
                onChange={(e) => setCreditExchangeRateInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono font-semibold disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notes
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Terms, preferred courier, etc."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px]"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              {editingId ? 'Save Updated Profile' : 'Save Customer / Vendor'}
            </button>
          </div>
        </form>
      )}

      {/* Directory Filter & Search */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
            {(['All', 'Customer', 'Vendor'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterType(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  filterType === tab
                    ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tab === 'All' ? `All (${parties.length})` : tab === 'Customer' ? `Customers (${stats.customerCount})` : `Vendors (${stats.vendorCount})`}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, city, contact, address..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-xs"
            />
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Name & Type</th>
                <th className="py-3 px-4 font-semibold">Contact Number</th>
                <th className="py-3 px-4 font-semibold">City</th>
                <th className="py-3 px-4 font-semibold">Address</th>
                <th className="py-3 px-4 font-semibold text-right">Credit Limit</th>
                <th className="py-3 px-4 font-semibold text-right">Open Balance (PKR)</th>
                <th className="py-3 px-4 font-semibold text-right">Credit Remaining</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredParties.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No customer or vendor profiles match your filter.
                  </td>
                </tr>
              ) : (
                filteredParties.map((party) => {
                  const bal = partyBalances.get(party.name.trim().toLowerCase()) || {
                    receivablePkr: 0,
                    payablePkr: 0,
                    ordersCount: 0,
                  };
                  const creditRate =
                    party.creditCurrency === 'PKR'
                      ? 1
                      : typeof party.creditExchangeRate === 'number'
                        ? party.creditExchangeRate
                        : getRateForCurrency(party.creditCurrency, profile);
                  const isCreditOrigMode = party.creditCurrency !== 'PKR' && creditRate === 0;
                  const creditLimitPkr = convertToPkr(
                    party.creditLimit,
                    party.creditCurrency,
                    creditRate
                  );
                  const primaryBalancePkr =
                    party.partyType === 'Vendor' ? bal.payablePkr : bal.receivablePkr;
                  const remainingPkr = creditLimitPkr - primaryBalancePkr;
                  const isOverLimit = !isCreditOrigMode && creditLimitPkr > 0 && remainingPkr < 0;

                  return (
                    <tr key={party.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{party.name}</p>
                        <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          {party.partyType}
                          {party.notes ? ` · ${party.notes}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          {party.contactNumber || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          {party.city || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs">
                        {party.address || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {formatMoney(party.creditLimit, party.creditCurrency)}
                        </p>
                        {party.creditCurrency !== 'PKR' && (
                          <p className="text-[10px] text-slate-500">
                            {isCreditOrigMode
                              ? `Rate: 0 (Kept in ${party.creditCurrency})`
                              : `≈ ${formatMoney(creditLimitPkr, 'PKR')} (@${creditRate})`}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        {bal.receivablePkr > 0 && (
                          <p className="font-semibold text-amber-700 dark:text-amber-400">
                            Due: {formatMoney(bal.receivablePkr, 'PKR')}
                          </p>
                        )}
                        {bal.payablePkr > 0 && (
                          <p className="font-semibold text-rose-600 dark:text-rose-400">
                            Pay: {formatMoney(bal.payablePkr, 'PKR')}
                          </p>
                        )}
                        {bal.receivablePkr === 0 && bal.payablePkr === 0 && (
                          <span className="text-slate-400">0.00 PKR</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        {isCreditOrigMode ? (
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {formatMoney(party.creditLimit, party.creditCurrency)}
                            </span>
                            <p className="text-[10px] text-slate-500">Own Currency Mode</p>
                          </div>
                        ) : (
                          <>
                            <span
                              className={`font-semibold ${
                                isOverLimit
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {formatMoney(remainingPkr, 'PKR')}
                            </span>
                            {isOverLimit && (
                              <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                Over Credit Limit
                              </p>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditParty(party)}
                                title={`Edit ${party.name}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <DeleteActionButton
                                onConfirm={() => deleteParty(party.id)}
                                title={`Delete ${party.name}`}
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
    </div>
  );
};

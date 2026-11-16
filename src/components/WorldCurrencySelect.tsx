import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import {
  getWorldCurrency,
  WORLD_CURRENCIES,
  WorldCurrency,
} from '../utils/worldCurrencies';

interface WorldCurrencySelectProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  includeAllOption?: boolean;
  allLabel?: string;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const WorldCurrencySelect: React.FC<WorldCurrencySelectProps> = ({
  value,
  onChange,
  disabled = false,
  includeAllOption = false,
  allLabel = 'All Currencies',
  compact = false,
  className = '',
  ariaLabel = 'Select world currency',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const isAllSelected = includeAllOption && value === 'All';
  const selectedCurrency: WorldCurrency | null = useMemo(
    () => (isAllSelected ? null : getWorldCurrency(value)),
    [isAllSelected, value]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return WORLD_CURRENCIES;
    return WORLD_CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q) ||
        (c.country || '').toLowerCase().includes(q)
    );
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 20);

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSelect = (code: string) => {
    onChange(code);
    setOpen(false);
    setSearch('');
  };

  const normalizedVal = value.trim().toUpperCase() === 'RMB' ? 'CNY' : value.trim().toUpperCase();

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60 min-h-[38px]"
      >
        <span className="truncate text-left">
          {isAllSelected ? (
            <span className="font-medium">{allLabel}</span>
          ) : selectedCurrency ? (
            compact ? (
              <span className="font-mono font-semibold">
                {selectedCurrency.code} ({selectedCurrency.symbol})
              </span>
            ) : (
              <span>
                <strong className="font-mono">{selectedCurrency.code}</strong> —{' '}
                {selectedCurrency.name} ({selectedCurrency.symbol})
              </span>
            )
          ) : (
            <span className="font-mono font-semibold">{value}</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 sm:min-w-[290px] z-50 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          {/* Search box inside dropdown */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search world currency name or code..."
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Scroll-down list of ALL World Currencies */}
          <ul
            role="listbox"
            className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/70"
          >
            {includeAllOption && (
              <li>
                <button
                  type="button"
                  onClick={() => handleSelect('All')}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 ${
                    isAllSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span>{allLabel}</span>
                  {isAllSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              </li>
            )}

            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-slate-500">
                No matching world currency found.
              </li>
            ) : (
              filtered.map((c) => {
                const isSelected = !isAllSelected && normalizedVal === c.code;
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => handleSelect(c.code)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white w-9 shrink-0">
                          {c.code}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {c.symbol}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

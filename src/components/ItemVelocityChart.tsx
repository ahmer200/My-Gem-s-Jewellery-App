import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3 } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { SalesOrder } from '../types/business';
import { formatMoney } from '../utils/currency';
import { computeItemVelocity, ItemVelocityMetric } from '../utils/velocity';

interface ItemVelocityChartProps {
  salesSource?: SalesOrder[];
  title?: string;
  subtitle?: string;
}

type VelocityTab = 'split' | 'fast' | 'slow';
type MetricMode = 'units' | 'value';

export const ItemVelocityChart: React.FC<ItemVelocityChartProps> = ({
  salesSource,
  title = 'Fast-Moving & Slow-Moving Item Velocity',
  subtitle,
}) => {
  const { inventory, sales, profile, setActiveModule } = useBusiness();
  const activeSales = salesSource ?? sales;

  const [tab, setTab] = useState<VelocityTab>('split');
  const [metric, setMetric] = useState<MetricMode>('units');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const metrics = useMemo(
    () => computeItemVelocity(inventory, activeSales, profile),
    [inventory, activeSales, profile]
  );

  const fastMoving = useMemo(() => {
    const sorted = [...metrics].sort((a, b) => {
      if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
      if (b.sellThroughPct !== a.sellThroughPct) return b.sellThroughPct - a.sellThroughPct;
      return b.revenuePkr - a.revenuePkr;
    });
    const activeSold = sorted.filter((m) => m.unitsSold > 0);
    return (activeSold.length > 0 ? activeSold : sorted).slice(0, 6);
  }, [metrics]);

  const slowMoving = useMemo(() => {
    const sorted = [...metrics].sort((a, b) => {
      if (a.unitsSold !== b.unitsSold) return a.unitsSold - b.unitsSold;
      if (a.sellThroughPct !== b.sellThroughPct) return a.sellThroughPct - b.sellThroughPct;
      if (b.stockQty !== a.stockQty) return b.stockQty - a.stockQty;
      return b.stockValuePkr - a.stockValuePkr;
    });
    const slowCandidates = sorted.filter(
      (m) => !fastMoving.some((f) => f.id === m.id) || m.unitsSold === 0
    );
    return (slowCandidates.length > 0 ? slowCandidates : sorted).slice(0, 6);
  }, [metrics, fastMoving]);

  const selectedItem: ItemVelocityMetric | null = useMemo(
    () => metrics.find((m) => m.id === selectedId) || null,
    [metrics, selectedId]
  );

  const maxFastMetric = useMemo(() => {
    const vals = fastMoving.map((m) => (metric === 'units' ? m.unitsSold : m.revenuePkr));
    return Math.max(1, ...vals);
  }, [fastMoving, metric]);

  const maxSlowMetric = useMemo(() => {
    const vals = slowMoving.map((m) => (metric === 'units' ? m.stockQty : m.stockValuePkr));
    return Math.max(1, ...vals);
  }, [slowMoving, metric]);

  const totalSoldUnits = metrics.reduce((s, m) => s + m.unitsSold, 0);
  const idleSkuCount = metrics.filter((m) => m.unitsSold === 0 && m.stockQty > 0).length;

  const renderFastBars = (items: ItemVelocityMetric[]) => (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
            Fast-Moving Items (Highest Turnover)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          {metric === 'units' ? 'Sold Qty · Sell-Through %' : 'Revenue (PKR Eqv.)'}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-xs text-slate-500">No inventory items available.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const val = metric === 'units' ? item.unitsSold : item.revenuePkr;
            const widthPct =
              val > 0 ? Math.max(10, Math.min(100, (val / maxFastMetric) * 100)) : 4;
            const isSelected = selectedId === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(isSelected ? null : item.id)}
                className={`w-full text-left rounded-lg p-2.5 transition-colors border ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 text-xs mb-1.5">
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                      {item.sku}
                    </span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="font-medium text-slate-900 dark:text-white truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0 tabular-nums">
                    {metric === 'units'
                      ? `${item.unitsSold} sold (${item.sellThroughPct}%)`
                      : formatMoney(item.revenuePkr, 'PKR')}
                  </div>
                </div>

                <div className="h-2.5 w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-sm transition-all duration-200 ${
                      item.unitsSold > 0
                        ? 'bg-emerald-700 dark:bg-emerald-500'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>
                    {item.orderCount} {item.orderCount === 1 ? 'order' : 'orders'} ·{' '}
                    {item.stockQty} left in vault
                  </span>
                  <span>
                    {item.lastSoldDate ? `Last sold ${item.lastSoldDate}` : 'No sales recorded'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderSlowBars = (items: ItemVelocityMetric[]) => (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <ArrowDownRight className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
            Slow-Moving Items (Idle Stock Watch)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          {metric === 'units' ? 'Held Stock Qty' : 'Tied-Up Retail Value'}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-xs text-slate-500">All items are moving steadily.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const val = metric === 'units' ? item.stockQty : item.stockValuePkr;
            const widthPct =
              val > 0 ? Math.max(10, Math.min(100, (val / maxSlowMetric) * 100)) : 4;
            const isSelected = selectedId === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(isSelected ? null : item.id)}
                className={`w-full text-left rounded-lg p-2.5 transition-colors border ${
                  isSelected
                    ? 'border-amber-600 bg-amber-50/50 dark:bg-amber-950/20'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 text-xs mb-1.5">
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                      {item.sku}
                    </span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="font-medium text-slate-900 dark:text-white truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0 tabular-nums">
                    {metric === 'units'
                      ? `${item.stockQty} in stock (${item.unitsSold} sold)`
                      : formatMoney(item.stockValuePkr, 'PKR')}
                  </div>
                </div>

                <div className="h-2.5 w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-sm bg-amber-600 dark:bg-amber-500 transition-all duration-200"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>
                    {item.sellThroughPct}% sell-through · {item.category}
                  </span>
                  <span>
                    {item.unitsSold === 0
                      ? `0 sold · ${item.daysIdle}d in catalog`
                      : `Last sold ${item.lastSoldDate}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header Toolbar */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle ||
              `${totalSoldUnits} total units sold · ${idleSkuCount} idle SKUs with zero sales · Click any bar for stock & turnover details`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
            {(
              [
                { id: 'split', label: 'Fast vs Slow' },
                { id: 'fast', label: 'Fast Moving' },
                { id: 'slow', label: 'Slow Moving' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTab(opt.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  tab === opt.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Metric Basis Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMetric('units')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                metric === 'units'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Quantity
            </button>
            <button
              type="button"
              onClick={() => setMetric('value')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                metric === 'value'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              PKR Value
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="p-5">
        {inventory.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-xs text-slate-500">
              Add gemstone items to your 22-column inventory to track fast-moving vs slow-moving velocity.
            </p>
            <button
              type="button"
              onClick={() => setActiveModule('inventory')}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Open Inventory
            </button>
          </div>
        ) : tab === 'split' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderFastBars(fastMoving)}
            {renderSlowBars(slowMoving)}
          </div>
        ) : tab === 'fast' ? (
          renderFastBars(fastMoving)
        ) : (
          renderSlowBars(slowMoving)
        )}
      </div>

      {/* Selected Bar Detail Strip */}
      {selectedItem && (
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-900 dark:text-white">
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                {selectedItem.sku}
              </span>{' '}
              · {selectedItem.name} ·{' '}
              <span
                className={
                  selectedItem.classification === 'Fast Moving'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }
              >
                {selectedItem.classification}
              </span>
            </p>
            <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
              Sold: {selectedItem.unitsSold} pcs · Vault Stock: {selectedItem.stockQty} pcs ·
              Sell-Through: {selectedItem.sellThroughPct}% · Revenue:{' '}
              {formatMoney(selectedItem.revenuePkr, 'PKR')} · Tied Stock Value:{' '}
              {formatMoney(selectedItem.stockValuePkr, 'PKR')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveModule('inventory')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 whitespace-nowrap"
            >
              View in Inventory
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('sales')}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
            >
              New Sale
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

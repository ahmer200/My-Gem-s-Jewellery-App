import { CompanyProfile, InventoryItem, SalesOrder } from '../types/business';
import { computeItemFinalPkr, getLineItemAmounts, getRateForCurrency } from './currency';

export interface ItemVelocityMetric {
  id: string;
  sku: string;
  name: string;
  category: string;
  gemstoneType: string;
  stockQty: number;
  unitsSold: number;
  orderCount: number;
  sellThroughPct: number;
  revenuePkr: number;
  stockValuePkr: number;
  lastSoldDate: string | null;
  daysIdle: number;
  classification: 'Fast Moving' | 'Moderate' | 'Slow Moving';
}

export function computeItemVelocity(
  inventory: InventoryItem[],
  sales: SalesOrder[],
  profile: CompanyProfile,
  referenceDate: Date = new Date()
): ItemVelocityMetric[] {
  const soldByItem = new Map<
    string,
    { unitsSold: number; orderCount: number; revenuePkr: number; lastSoldDate: string | null }
  >();

  for (const sale of sales) {
    const seenInOrder = new Set<string>();
    const rate =
      sale.sourceCurrency === 'PKR'
        ? 1
        : sale.exchangeRateApplied > 0
          ? sale.exchangeRateApplied
          : getRateForCurrency(sale.sourceCurrency, profile) || 1;

    for (const li of sale.items) {
      const key = li.inventoryId || li.sku.toLowerCase();
      const matchedInv = inventory.find(
        (inv) => inv.id === li.inventoryId || inv.sku.toLowerCase() === li.sku.toLowerCase()
      );
      const mapKey = matchedInv ? matchedInv.id : key;
      const prev = soldByItem.get(mapKey) || {
        unitsSold: 0,
        orderCount: 0,
        revenuePkr: 0,
        lastSoldDate: null,
      };

      const { lineTotalOrig } = getLineItemAmounts(li, sale.markupPercentUsed);
      const linePkr = sale.sourceCurrency === 'PKR' ? lineTotalOrig : lineTotalOrig * rate;

      prev.unitsSold += Math.max(0, Number(li.quantity) || 0);
      prev.revenuePkr += Math.max(0, linePkr);
      if (!seenInOrder.has(mapKey)) {
        prev.orderCount += 1;
        seenInOrder.add(mapKey);
      }
      if (!prev.lastSoldDate || sale.orderDate > prev.lastSoldDate) {
        prev.lastSoldDate = sale.orderDate;
      }
      soldByItem.set(mapKey, prev);
    }
  }

  const refMs = referenceDate.getTime();

  const rows: ItemVelocityMetric[] = inventory.map((item) => {
    const stats = soldByItem.get(item.id) || {
      unitsSold: 0,
      orderCount: 0,
      revenuePkr: 0,
      lastSoldDate: null,
    };

    const totalHandled = stats.unitsSold + Math.max(0, item.stockQty);
    const sellThroughPct =
      totalHandled > 0 ? Number(((stats.unitsSold / totalHandled) * 100).toFixed(1)) : 0;

    const { finalPkr } = computeItemFinalPkr(
      item.baseSellPrice,
      item.sellCurrency,
      profile,
      item.sellExchangeRate
    );
    const stockValuePkr = finalPkr * Math.max(0, item.stockQty);

    const anchorDateStr = stats.lastSoldDate || item.createdAt || item.updatedAt;
    const anchorMs = Date.parse(anchorDateStr);
    const daysIdle = Number.isFinite(anchorMs)
      ? Math.max(1, Math.round((refMs - anchorMs) / (1000 * 60 * 60 * 24)))
      : 1;

    let classification: ItemVelocityMetric['classification'] = 'Slow Moving';
    if (stats.unitsSold >= 2 || sellThroughPct >= 25) {
      classification = 'Fast Moving';
    } else if (stats.unitsSold > 0) {
      classification = 'Moderate';
    }

    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      gemstoneType: item.gemstoneType,
      stockQty: item.stockQty,
      unitsSold: stats.unitsSold,
      orderCount: stats.orderCount,
      sellThroughPct,
      revenuePkr: stats.revenuePkr,
      stockValuePkr,
      lastSoldDate: stats.lastSoldDate,
      daysIdle,
      classification,
    };
  });

  return rows;
}

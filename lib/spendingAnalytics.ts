import {
  Asset,
  CategoryBudget,
  PaymentMethod,
  PrimaryCategory,
} from '../types/schema';
import { diffInDays } from './policyEngine';

export type TimeframeFilter = 'MTD' | 'YTD' | 'ALL';

export interface SpendDisaggregation {
  baseProductSpend: number;
  salesTaxSpend: number;
  shippingAndRecyclingFees: number;
  grossTotalSpend: number;
  overheadRatioPercent: number;
}

export interface CategoryBudgetStatus {
  budgetId: string;
  category: PrimaryCategory;
  monthlyLimit: number;
  spentAmount: number;
  projectedMonthEndAmount: number;
  utilizationPercent: number;
  projectedPercent: number;
  statusColor: 'green' | 'amber' | 'red';
  isProjectedOverspend: boolean;
}

export interface DurableAssetValuation {
  assetId: string;
  name: string;
  brand: string;
  category: PrimaryCategory;
  purchaseDate: string;
  purchasePrice: number;
  daysOwned: number;
  estimatedResidualValue: number;
  depreciationPercent: number;
  netCostConsumed: number;
  costPerDay: number;
  usageCount: number;
  costPerUse: number;
}

export interface RecurringPatternInsight {
  merchantName: string;
  category: PrimaryCategory;
  occurrenceCount: number;
  latestAmount: number;
  previousAmount: number;
  priceIncreaseDetected: boolean;
  priceDeltaPercent: number;
  estimatedAnnualRunRate: number;
  cadenceLabel: 'Monthly' | 'Quarterly' | 'Recurring';
}

export interface CardOptimizationInsight {
  assetId: string;
  assetName: string;
  merchantName: string;
  category: PrimaryCategory;
  purchaseTotal: number;
  usedCardName: string;
  usedMultiplier: number;
  optimalCardName: string;
  optimalMultiplier: number;
  missedRewardValueUsd: number;
  hasSuperiorWarrantyOnOptimalCard: boolean;
  recommendationNote: string;
}

export interface SpendingAnalyticsSummary {
  timeframe: TimeframeFilter;
  disaggregation: SpendDisaggregation;
  projectedMonthEndSpend: number;
  activePhysicalAssetNetWorth: number;
  topSpendingCategory: {
    category: PrimaryCategory;
    amount: number;
  };
  categoryBreakdown: Array<{
    category: PrimaryCategory;
    amount: number;
    sharePercent: number;
  }>;
  budgetStatuses: CategoryBudgetStatus[];
  durableValuations: DurableAssetValuation[];
  recurringPatterns: RecurringPatternInsight[];
  cardOptimizations: CardOptimizationInsight[];
}

// Annual depreciation curves by primary category
const ANNUAL_DEPRECIATION_RATE: Record<PrimaryCategory, number> = {
  'Electronics': 0.35, // 35% per year
  'Home & Kitchen': 0.18, // 18% per year
  'Tools': 0.10, // Premium tools retain high residual value
  'Automotive': 0.22,
  'Apparel': 0.50,
  'Health/Personal Care': 0.45,
  'Subscriptions/Services': 1.0,
  'Groceries': 1.0,
};

/**
 * Filters assets according to the selected timeframe (MTD, YTD, or ALL)
 * relative to a deterministic referenceDate (defaults to 2026-10-23).
 */
export function filterAssetsByTimeframe(
  assets: Asset[],
  timeframe: TimeframeFilter,
  referenceDate: string = '2026-10-23'
): Asset[] {
  if (timeframe === 'ALL') return assets;
  const [refYear, refMonth] = referenceDate.split('-').map(Number);

  return assets.filter((asset) => {
    const [y, m] = asset.purchaseDate.split('-').map(Number);
    if (timeframe === 'MTD') {
      return y === refYear && m === refMonth;
    }
    if (timeframe === 'YTD') {
      return y === refYear;
    }
    return true;
  });
}

/**
 * Disaggregates base product spend vs sales tax, shipping, and recycling overhead.
 * Supports multi-item split receipts via lineItems.
 */
export function calculateSpendDisaggregation(assets: Asset[]): SpendDisaggregation {
  let baseProductSpend = 0;
  let salesTaxSpend = 0;
  let shippingAndRecyclingFees = 0;

  for (const a of assets) {
    const lineItemSum =
      a.lineItems && a.lineItems.length > 0
        ? a.lineItems.reduce((sum, li) => sum + li.totalPrice, 0)
        : a.purchasePrice;

    baseProductSpend += lineItemSum;
    salesTaxSpend += a.taxAmount || 0;
    shippingAndRecyclingFees += (a.shippingFee || 0) + (a.recyclingFee || 0);
  }

  const grossTotalSpend = baseProductSpend + salesTaxSpend + shippingAndRecyclingFees;
  const overheadRatioPercent =
    grossTotalSpend > 0
      ? Number((((salesTaxSpend + shippingAndRecyclingFees) / grossTotalSpend) * 100).toFixed(1))
      : 0;

  return {
    baseProductSpend: Number(baseProductSpend.toFixed(2)),
    salesTaxSpend: Number(salesTaxSpend.toFixed(2)),
    shippingAndRecyclingFees: Number(shippingAndRecyclingFees.toFixed(2)),
    grossTotalSpend: Number(grossTotalSpend.toFixed(2)),
    overheadRatioPercent,
  };
}

/**
 * Calculates real-time Cost-Per-Day (CPU), Cost-Per-Use, and Estimated Residual Value
 * using the exact specification formula:
 * Cost Per Day = (Purchase Price - Estimated Residual Value) / Days Owned
 */
export function calculateDurableAssetValuation(
  asset: Asset,
  referenceDate: string = '2026-10-23'
): DurableAssetValuation {
  const rawDays = diffInDays(asset.purchaseDate, referenceDate);
  const daysOwned = Math.max(1, rawDays);
  const yearsOwned = daysOwned / 365;

  const annualRate = ANNUAL_DEPRECIATION_RATE[asset.category] ?? 0.25;
  // Exponential retention curve with a 12% salvage floor for working durable hardware
  const retentionFactor = asset.isDurableAsset
    ? Math.max(0.12, Math.pow(1 - annualRate, yearsOwned))
    : 0;

  const estimatedResidualValue = Number((asset.purchasePrice * retentionFactor).toFixed(2));
  const netCostConsumed = Number(
    Math.max(0, asset.purchasePrice - estimatedResidualValue).toFixed(2)
  );
  const depreciationPercent =
    asset.purchasePrice > 0
      ? Math.round(((asset.purchasePrice - estimatedResidualValue) / asset.purchasePrice) * 100)
      : 0;

  const costPerDay = Number((netCostConsumed / daysOwned).toFixed(2));
  const usageCount = Math.max(1, asset.usageCount || 1);
  const costPerUse = Number((asset.purchasePrice / usageCount).toFixed(2));

  return {
    assetId: asset.id,
    name: asset.name,
    brand: asset.brand,
    category: asset.category,
    purchaseDate: asset.purchaseDate,
    purchasePrice: asset.purchasePrice,
    daysOwned,
    estimatedResidualValue,
    depreciationPercent,
    netCostConsumed,
    costPerDay,
    usageCount,
    costPerUse,
  };
}

/**
 * Computes Category Spend (respecting split line items across categories) and evaluates
 * monthly budget burn rates and projected month-end velocity.
 */
export function evaluateCategoryBudgets(
  mtdAssets: Asset[],
  budgets: CategoryBudget[],
  referenceDate: string = '2026-10-23'
): CategoryBudgetStatus[] {
  const [year, month, dayOfMonth] = referenceDate.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const elapsedDays = Math.max(1, dayOfMonth);

  // Aggregate category spend from line items (or asset primary category if no line items)
  const categorySpendMap = new Map<PrimaryCategory, number>();

  for (const asset of mtdAssets) {
    if (asset.lineItems && asset.lineItems.length > 0) {
      for (const li of asset.lineItems) {
        const prev = categorySpendMap.get(li.category) || 0;
        categorySpendMap.set(li.category, prev + li.totalPrice);
      }
    } else {
      const prev = categorySpendMap.get(asset.category) || 0;
      categorySpendMap.set(asset.category, prev + asset.purchasePrice);
    }
  }

  return budgets.map((b) => {
    const spentAmount = Number((categorySpendMap.get(b.category) || 0).toFixed(2));
    const dailyVelocity = spentAmount / elapsedDays;
    const projectedMonthEndAmount = Number((dailyVelocity * daysInMonth).toFixed(2));

    const utilizationPercent =
      b.monthlyLimit > 0 ? Math.round((spentAmount / b.monthlyLimit) * 100) : 0;
    const projectedPercent =
      b.monthlyLimit > 0 ? Math.round((projectedMonthEndAmount / b.monthlyLimit) * 100) : 0;

    let statusColor: 'green' | 'amber' | 'red' = 'green';
    if (utilizationPercent >= 100) {
      statusColor = 'red';
    } else if (utilizationPercent >= b.alertThresholdPercent) {
      statusColor = 'amber';
    }

    return {
      budgetId: b.id,
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      spentAmount,
      projectedMonthEndAmount,
      utilizationPercent,
      projectedPercent,
      statusColor,
      isProjectedOverspend: projectedMonthEndAmount > b.monthlyLimit,
    };
  });
}

/**
 * Detects recurring merchant charges, subscription cadences, and unnoticed price increases.
 */
export function detectRecurringPatterns(allAssets: Asset[]): RecurringPatternInsight[] {
  const byMerchant = new Map<string, Asset[]>();
  for (const a of allAssets) {
    const key = a.merchantName.trim();
    const list = byMerchant.get(key) || [];
    list.push(a);
    byMerchant.set(key, list);
  }

  const insights: RecurringPatternInsight[] = [];

  for (const [merchantName, records] of byMerchant.entries()) {
    const isSubscriptionCategory = records.some(
      (r) => r.category === 'Subscriptions/Services'
    );
    if (records.length < 2 && !isSubscriptionCategory) continue;

    const sorted = [...records].sort((a, b) =>
      a.purchaseDate.localeCompare(b.purchaseDate)
    );
    const latest = sorted[sorted.length - 1];
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : latest;

    const latestAmount = latest.purchasePrice;
    const previousAmount = previous.purchasePrice;
    const priceDelta = latestAmount - previousAmount;
    const priceIncreaseDetected = priceDelta > 0.01;
    const priceDeltaPercent =
      previousAmount > 0 ? Number(((priceDelta / previousAmount) * 100).toFixed(1)) : 0;

    const cadenceLabel: RecurringPatternInsight['cadenceLabel'] =
      latest.category === 'Subscriptions/Services' ? 'Monthly' : 'Recurring';
    const multiplier = cadenceLabel === 'Monthly' ? 12 : 4;

    insights.push({
      merchantName,
      category: latest.category,
      occurrenceCount: records.length,
      latestAmount,
      previousAmount,
      priceIncreaseDetected,
      priceDeltaPercent,
      estimatedAnnualRunRate: Number((latestAmount * multiplier).toFixed(2)),
      cadenceLabel,
    });
  }

  return insights.sort((a, b) => b.estimatedAnnualRunRate - a.estimatedAnnualRunRate);
}

/**
 * Evaluates Payment Method & Card Perk Optimization across purchases.
 */
export function analyzeCardPerkOptimizations(
  assets: Asset[],
  paymentMethods: PaymentMethod[]
): CardOptimizationInsight[] {
  if (paymentMethods.length === 0) return [];

  const getMultiplierForCategory = (card: PaymentMethod, category: PrimaryCategory): number => {
    const exact = card.rewardMultipliers.find((m) => m.category === category);
    if (exact) return exact.multiplier;
    const fallback = card.rewardMultipliers.find((m) => m.category === 'All Other');
    return fallback ? fallback.multiplier : 1;
  };

  const insights: CardOptimizationInsight[] = [];

  for (const asset of assets) {
    const usedCard =
      paymentMethods.find((pm) => pm.id === asset.paymentMethodId) || paymentMethods[0];
    const usedMultiplier = getMultiplierForCategory(usedCard, asset.category);

    let bestCard = usedCard;
    let bestMultiplier = usedMultiplier;

    for (const candidate of paymentMethods) {
      const mult = getMultiplierForCategory(candidate, asset.category);
      if (mult > bestMultiplier) {
        bestMultiplier = mult;
        bestCard = candidate;
      }
    }

    const purchaseTotal = Number((asset.purchasePrice + asset.taxAmount).toFixed(2));
    const missedRewardValueUsd = Number(
      (((bestMultiplier - usedMultiplier) / 100) * purchaseTotal).toFixed(2)
    );

    const hasSuperiorWarrantyOnOptimalCard =
      asset.isDurableAsset &&
      bestCard.extendedWarrantyMonths > usedCard.extendedWarrantyMonths;

    if (missedRewardValueUsd > 0.5 || hasSuperiorWarrantyOnOptimalCard) {
      insights.push({
        assetId: asset.id,
        assetName: asset.name,
        merchantName: asset.merchantName,
        category: asset.category,
        purchaseTotal,
        usedCardName: `${usedCard.issuer} ${usedCard.cardName} (••${usedCard.lastFour})`,
        usedMultiplier,
        optimalCardName: `${bestCard.issuer} ${bestCard.cardName} (••${bestCard.lastFour})`,
        optimalMultiplier: bestMultiplier,
        missedRewardValueUsd: Math.max(0, missedRewardValueUsd),
        hasSuperiorWarrantyOnOptimalCard,
        recommendationNote:
          missedRewardValueUsd > 0
            ? `Routing ${asset.category} spend to ${bestCard.cardName} yields ${bestMultiplier}% vs ${usedMultiplier}% (+$${missedRewardValueUsd.toFixed(2)} value).`
            : `${bestCard.cardName} provides +${bestCard.extendedWarrantyMonths}m extended warranty on durable hardware.`,
      });
    }
  }

  return insights;
}

/**
 * Master Spending Intelligence Aggregator
 */
export function buildSpendingAnalyticsSummary(
  allAssets: Asset[],
  budgets: CategoryBudget[],
  paymentMethods: PaymentMethod[],
  timeframe: TimeframeFilter = 'MTD',
  referenceDate: string = '2026-10-23'
): SpendingAnalyticsSummary {
  const filteredAssets = filterAssetsByTimeframe(allAssets, timeframe, referenceDate);
  const mtdAssets = filterAssetsByTimeframe(allAssets, 'MTD', referenceDate);

  const disaggregation = calculateSpendDisaggregation(filteredAssets);
  const mtdDisaggregation = calculateSpendDisaggregation(mtdAssets);

  const [year, month, dayOfMonth] = referenceDate.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const projectedMonthEndSpend = Number(
    ((mtdDisaggregation.grossTotalSpend / Math.max(1, dayOfMonth)) * daysInMonth).toFixed(2)
  );

  // Durable valuations across all owned durable assets
  const durableValuations = allAssets
    .filter((a) => a.isDurableAsset)
    .map((a) => calculateDurableAssetValuation(a, referenceDate));

  const activePhysicalAssetNetWorth = Number(
    durableValuations.reduce((sum, v) => sum + v.estimatedResidualValue, 0).toFixed(2)
  );

  // Category breakdown for selected timeframe (including split receipt line items)
  const catTotals = new Map<PrimaryCategory, number>();
  for (const a of filteredAssets) {
    if (a.lineItems && a.lineItems.length > 0) {
      for (const li of a.lineItems) {
        catTotals.set(li.category, (catTotals.get(li.category) || 0) + li.totalPrice);
      }
    } else {
      catTotals.set(a.category, (catTotals.get(a.category) || 0) + a.purchasePrice);
    }
  }

  const totalCatSpend = Array.from(catTotals.values()).reduce((s, v) => s + v, 0);
  const categoryBreakdown = Array.from(catTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
      sharePercent: totalCatSpend > 0 ? Math.round((amount / totalCatSpend) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topSpendingCategory =
    categoryBreakdown.length > 0
      ? categoryBreakdown[0]
      : { category: 'Electronics' as PrimaryCategory, amount: 0 };

  const budgetStatuses = evaluateCategoryBudgets(mtdAssets, budgets, referenceDate);
  const recurringPatterns = detectRecurringPatterns(allAssets);
  const cardOptimizations = analyzeCardPerkOptimizations(filteredAssets, paymentMethods);

  return {
    timeframe,
    disaggregation,
    projectedMonthEndSpend,
    activePhysicalAssetNetWorth,
    topSpendingCategory,
    categoryBreakdown,
    budgetStatuses,
    durableValuations,
    recurringPatterns,
    cardOptimizations,
  };
}

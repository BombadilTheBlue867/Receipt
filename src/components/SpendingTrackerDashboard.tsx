import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Activity,
  Repeat,
  SlidersHorizontal,
  ArrowUpRight,
  Receipt,
} from 'lucide-react';
import {
  Asset,
  CategoryBudget,
  PaymentMethod,
} from '../types/schema';
import {
  TimeframeFilter,
  buildSpendingAnalyticsSummary,
} from '../lib/spendingAnalytics';
import { formatProtectedField } from '../lib/vaultCrypto';
import {
  INITIAL_ASSETS,
  INITIAL_BUDGETS,
  INITIAL_PAYMENT_METHODS,
  REFERENCE_DATE,
} from '../lib/seedData';

export interface SpendingTrackerDashboardProps {
  assets?: Asset[];
  budgets?: CategoryBudget[];
  paymentMethods?: PaymentMethod[];
  isPiiRevealed?: boolean;
  onUpdateBudgetLimit?: (budgetId: string, newMonthlyLimit: number) => void;
  onLogAssetUse?: (assetId: string) => void;
}

export const SpendingTrackerDashboard: React.FC<SpendingTrackerDashboardProps> = ({
  assets: propAssets,
  budgets: propBudgets,
  paymentMethods: propCards,
  isPiiRevealed = true,
  onUpdateBudgetLimit,
  onLogAssetUse,
}) => {
  const [localAssets, setLocalAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [localBudgets, setLocalBudgets] = useState<CategoryBudget[]>(INITIAL_BUDGETS);

  const assets = propAssets || localAssets;
  const budgets = propBudgets || localBudgets;
  const paymentMethods = propCards || INITIAL_PAYMENT_METHODS;

  const [timeframe, setTimeframe] = useState<TimeframeFilter>('MTD');
  const [spotlightAssetId, setSpotlightAssetId] = useState<string>(
    assets.find((a) => a.isDurableAsset)?.id || 'ast_miele_espresso'
  );
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editBudgetValue, setEditBudgetValue] = useState<string>('');

  const summary = useMemo(
    () =>
      buildSpendingAnalyticsSummary(
        assets,
        budgets,
        paymentMethods,
        timeframe,
        REFERENCE_DATE
      ),
    [assets, budgets, paymentMethods, timeframe]
  );

  const spotlightValuation = useMemo(() => {
    return (
      summary.durableValuations.find((v) => v.assetId === spotlightAssetId) ||
      summary.durableValuations[0]
    );
  }, [summary.durableValuations, spotlightAssetId]);

  const handleSaveBudget = (budgetId: string) => {
    const num = parseFloat(editBudgetValue);
    if (!isNaN(num) && num > 0) {
      if (onUpdateBudgetLimit) {
        onUpdateBudgetLimit(budgetId, num);
      } else {
        setLocalBudgets((prev) =>
          prev.map((b) => (b.id === budgetId ? { ...b, monthlyLimit: num } : b))
        );
      }
    }
    setEditingBudgetId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header Toolbar with Interactive Timeframe Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Spending Tracker &amp; Financial Intelligence
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Line-item tax disaggregation, budget velocity, and live cost-per-use
          </p>
        </div>

        <div
          role="group"
          aria-label="Spending Timeframe Filter"
          className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl"
        >
          {(
            [
              { id: 'MTD', label: 'MTD' },
              { id: 'YTD', label: 'YTD' },
              { id: 'ALL', label: 'All-Time' },
            ] as const
          ).map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => setTimeframe(tf.id)}
              className={`min-h-[34px] px-2 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                timeframe === tf.id
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Compact 2x2 Phone Financial Metrics Grid */}
      <section
        aria-label="Financial Intelligence Key Metrics"
        className="grid grid-cols-2 gap-2.5"
      >
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5">
          <div className="text-[11px] font-medium text-slate-500">
            Total Spent ({timeframe})
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            $
            {summary.disaggregation.grossTotalSpend.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[10px] text-slate-500 font-mono tabular-nums mt-0.5">
            Tax/Fees: {summary.disaggregation.overheadRatioPercent}%
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5">
          <div className="text-[11px] font-medium text-slate-500">
            Projected Month-End
          </div>
          <div className="text-lg font-bold text-amber-500 font-mono tabular-nums mt-0.5">
            $
            {summary.projectedMonthEndSpend.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Oct 23 velocity pace
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5">
          <div className="text-[11px] font-medium text-slate-500">
            Resale Net Worth
          </div>
          <div className="text-lg font-bold text-emerald-500 font-mono tabular-nums mt-0.5">
            $
            {summary.activePhysicalAssetNetWorth.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Live residual equity
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5">
          <div className="text-[11px] font-medium text-slate-500">
            Top Category
          </div>
          <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">
            {summary.topSpendingCategory.category}
          </div>
          <div className="text-[10px] text-slate-500 font-mono tabular-nums mt-0.5">
            ${summary.topSpendingCategory.amount.toFixed(0)} net
          </div>
        </div>
      </section>

      {/* 2. Category Budget Guardrails (Phone Card) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Category Budget Guardrails
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tap any monthly limit to adjust guardrail ceiling
            </p>
          </div>
          <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        <div className="space-y-3.5">
          {summary.budgetStatuses.map((b) => {
            const barColor =
              b.statusColor === 'red'
                ? 'bg-rose-500'
                : b.statusColor === 'amber'
                ? 'bg-amber-500'
                : 'bg-emerald-500';

            return (
              <div key={b.budgetId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-slate-900 truncate">
                      {b.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      ({b.utilizationPercent}%)
                    </span>
                  </div>

                  <div className="font-mono tabular-nums text-xs text-slate-700 flex items-center gap-1 shrink-0">
                    <span>${b.spentAmount.toFixed(0)} /</span>
                    {editingBudgetId === b.budgetId ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          aria-label={`Edit monthly limit for ${b.category}`}
                          value={editBudgetValue}
                          onChange={(e) => setEditBudgetValue(e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-xs border border-slate-400 rounded bg-white text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveBudget(b.budgetId)}
                          className="px-2 py-0.5 text-[10px] bg-slate-900 text-white rounded cursor-pointer"
                        >
                          Save
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBudgetId(b.budgetId);
                          setEditBudgetValue(String(b.monthlyLimit));
                        }}
                        className="underline decoration-dotted hover:text-sky-400 cursor-pointer"
                      >
                        ${b.monthlyLimit.toFixed(0)}
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{
                      width: `${Math.min(100, Math.max(6, b.utilizationPercent))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Durable Asset Cost-Per-Use (CPU) Spotlight */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Cost-Per-Use (CPU) Spotlight
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Real-time depreciation &amp; utilization efficiency
            </p>
          </div>
          <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
        </div>

        <select
          id="spotlight-asset-select"
          aria-label="Inspect Durable Hardware Asset"
          value={spotlightValuation?.assetId || ''}
          onChange={(e) => setSpotlightAssetId(e.target.value)}
          className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
        >
          {summary.durableValuations.map((v) => (
            <option key={v.assetId} value={v.assetId}>
              {v.name} (${v.purchasePrice.toLocaleString()})
            </option>
          ))}
        </select>

        {spotlightValuation && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono tabular-nums">
              <div>
                <div className="text-[10px] font-sans text-slate-500">
                  Cost Per Day
                </div>
                <div className="text-base font-bold text-emerald-500 mt-0.5">
                  ${spotlightValuation.costPerDay.toFixed(2)}/day
                </div>
              </div>
              <div>
                <div className="text-[10px] font-sans text-slate-500">
                  Logged Cost Per Use
                </div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  ${spotlightValuation.costPerUse.toFixed(2)}/use
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
              <span className="text-[11px] text-slate-500 font-mono">
                Resale: ${spotlightValuation.estimatedResidualValue.toFixed(0)} ({spotlightValuation.usageCount} uses)
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onLogAssetUse) {
                    onLogAssetUse(spotlightValuation.assetId);
                  } else {
                    setLocalAssets((prev) =>
                      prev.map((a) =>
                        a.id === spotlightValuation.assetId
                          ? { ...a, usageCount: a.usageCount + 1 }
                          : a
                      )
                    );
                  }
                }}
                className="min-h-[34px] px-3 py-1 text-xs font-semibold text-white bg-slate-900 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Log Use (+1)</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 4. Payment Method Optimization & Subscription Radar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Card Perk &amp; Multiplier Optimizer
          </h3>
          <CreditCard className="w-4 h-4 text-sky-400" />
        </div>

        {summary.cardOptimizations.length === 0 ? (
          <div className="text-xs text-slate-500 py-3 text-center">
            All purchases used your optimal card tier.
          </div>
        ) : (
          <div className="space-y-2.5">
            {summary.cardOptimizations.map((opt) => (
              <div
                key={opt.assetId}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 truncate">
                    {opt.assetName}
                  </span>
                  <span className="font-mono text-[11px] text-amber-500 font-bold shrink-0">
                    +${opt.missedRewardValueUsd.toFixed(2)} missed
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Used {opt.usedCardName} ({opt.usedMultiplier}x) &rarr; Optimal:{' '}
                  <span className="text-emerald-500 font-semibold">
                    {opt.optimalCardName} ({opt.optimalMultiplier}x)
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>{opt.recommendationNote}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Recurring Billing Radar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Recurring Subscription Radar
          </h3>
          <Repeat className="w-4 h-4 text-slate-400" />
        </div>
        <div className="space-y-2">
          {summary.recurringPatterns.map((rec, i) => (
            <div
              key={i}
              className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">
                  {rec.merchantName} · {rec.cadenceLabel}
                </div>
                {rec.priceIncreaseDetected ? (
                  <div className="text-[11px] text-amber-500 flex items-center gap-1 mt-0.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>
                      Rate hike: ${rec.previousAmount.toFixed(0)} &rarr; $
                      {rec.latestAmount.toFixed(0)} (+{rec.priceDeltaPercent}%)
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-500 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Stable billing rate</span>
                  </div>
                )}
              </div>
              <div className="text-right font-mono tabular-nums shrink-0">
                <div className="font-bold text-slate-900">
                  ${rec.latestAmount.toFixed(2)}/mo
                </div>
                <div className="text-[10px] text-slate-500">
                  ${rec.estimatedAnnualRunRate.toFixed(0)}/yr
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Mobile Itemized Receipt Stack (Replaces Wide 5-Column Desktop Table) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Itemized Receipt Ledger
            </h3>
            <p className="text-[11px] text-slate-500">
              Line-item tax disaggregation &amp; tender audit
            </p>
          </div>
          <Receipt className="w-4 h-4 text-slate-400" />
        </div>

        <div className="space-y-2.5">
          {assets.map((asset) => {
            const card =
              paymentMethods.find((pm) => pm.id === asset.paymentMethodId) ||
              paymentMethods[0];
            return (
              <div
                key={asset.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {asset.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {asset.merchantName} · {asset.purchaseDate} ·{' '}
                      {asset.category}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-bold text-slate-900">
                      ${(asset.purchasePrice + asset.taxAmount).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Tax: ${asset.taxAmount.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>
                    {card.issuer} {card.cardName} (••
                    {formatProtectedField(
                      card.lastFour,
                      isPiiRevealed,
                      'card'
                    ).slice(-4)}
                    )
                  </span>
                  <span>
                    {asset.isDurableAsset ? 'Durable Hardware' : 'Consumable'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default SpendingTrackerDashboard;

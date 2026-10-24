import React, { useState } from 'react';
import { Shield, Clock, RefreshCw, ChevronRight, RotateCcw } from 'lucide-react';
import { Asset } from '../types/schema';
import { triggerHaptic } from '../lib/haptics';

export interface HomeWidgetProps {
  assets: Asset[];
  onSelectAsset?: (assetId: string) => void;
  onOpenReturnWizard?: () => void;
}

export const HomeWidget: React.FC<HomeWidgetProps> = ({
  assets,
  onSelectAsset,
  onOpenReturnWizard,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    triggerHaptic(15);
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshKey((k) => k + 1);
    }, 600);
  };

  const activeAssets = assets.filter((a) => a.status !== 'Returned' && a.status !== 'Expired');

  let nearestAsset: Asset | null = null;
  let nearestDays = Infinity;
  let nearestPolicyType = '';

  for (const asset of activeAssets) {
    for (const p of asset.policies || []) {
      if (p.isActive && p.daysRemaining < nearestDays) {
        nearestDays = p.daysRemaining;
        nearestAsset = asset;
        nearestPolicyType = p.coverageType;
      }
    }
  }

  if (!nearestAsset && activeAssets.length > 0) {
    nearestAsset = activeAssets[0];
    nearestDays = 14;
    nearestPolicyType = 'Retailer Return Window';
  }

  if (!nearestAsset) {
    return (
      <div className="bg-slate-900 text-white rounded-3xl p-4 shadow-xl border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
            <Shield className="w-3.5 h-3.5" />
            <span>HomeWidget · Live</span>
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh widget"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
        <div className="text-sm font-bold text-slate-100">
          No active receipts in vault
        </div>
        <div className="text-xs text-slate-400">
          Scan your first receipt to track warranty and return deadlines.
        </div>
      </div>
    );
  }

  const isUrgent = nearestDays <= 30;

  return (
    <div key={refreshKey} className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-4 shadow-xl border border-slate-800 space-y-3 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
          <Shield className="w-3.5 h-3.5" />
          <span>HomeWidget</span>
        </span>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono flex items-center gap-1 ${
              isUrgent
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>{nearestDays}d remaining</span>
          </span>

          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh widget"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-sky-400 truncate">
            {nearestPolicyType}
          </div>
          <div className="text-sm font-bold text-slate-100 truncate mt-0.5">
            {nearestAsset.name}
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">
            {nearestAsset.brand} · {nearestAsset.merchantName} · ${nearestAsset.purchasePrice.toFixed(2)}
          </div>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-xs font-bold text-sky-400 shrink-0">
          {nearestAsset.merchantName.slice(0, 2).toUpperCase()}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('cardExpansion');
            if (onSelectAsset) onSelectAsset(nearestAsset!.id);
          }}
          className="font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
        >
          <span>Inspect Coverage</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {onOpenReturnWizard && nearestDays <= 30 && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('scanSuccess');
              onOpenReturnWizard();
            }}
            className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1 cursor-pointer hover:bg-emerald-500/30 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Return Window</span>
          </button>
        )}
      </div>
    </div>
  );
};

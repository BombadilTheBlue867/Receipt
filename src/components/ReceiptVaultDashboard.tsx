import React, { useState, useMemo } from 'react';
import { triggerHaptic } from '../lib/haptics';
import {
  Shield,
  ShieldAlert,
  FileText,
  ScanLine,
  Search,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  Unlock,
  Activity,
  Sparkles,
  Cpu,
  Layers,
  Tag,
  PlusCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  X,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';
import { HomeWidget } from './HomeWidget';
import {
  Asset,
  PaymentMethod,
  ClaimRecord,
  PrimaryCategory,
} from '../types/schema';
import {
  evaluateAssetPolicies,
  checkSafetyRecall,
} from '../lib/policyEngine';
import { selectOptimalClaimRoute } from '../lib/claimGenerator';
import { formatProtectedField } from '../lib/vaultCrypto';
import { MULTI_ITEM_RECEIPT_PRESETS } from '../lib/onboardReceiptIntelligence';
import { IntelligenceEngine } from '../lib/intelligenceEngine';
import {
  INITIAL_ASSETS,
  INITIAL_PAYMENT_METHODS,
  REFERENCE_DATE,
} from '../lib/seedData';
import { ScanModal } from './ScanModal';
import { ClaimWizard } from './ClaimWizard';

export interface ReceiptVaultDashboardProps {
  assets?: Asset[];
  paymentMethods?: PaymentMethod[];
  claims?: ClaimRecord[];
  isPiiRevealed?: boolean;
  onTogglePiiReveal?: () => void;
  onAddAsset?: (newAsset: Asset) => void;
  onLogAssetUse?: (assetId: string) => void;
  onFileClaim?: (newClaim: ClaimRecord) => void;
  onOpenReturnWizard?: () => void;
  openScannerModalTrigger?: boolean;
  onCloseScannerModalTrigger?: () => void;
}

type QuickFilterChip =
  | 'ALL'
  | 'Expiring Soon (<30d)'
  | 'Card Protected'
  | 'Recalls'
  | 'Electronics'
  | 'Appliances'
  | 'Tools';

type SortOption =
  | 'expiring_soonest'
  | 'highest_value'
  | 'newest_purchase'
  | 'lowest_cpu';

type InspectorTab = 'coverage' | 'valuation' | 'receipt';

const CATEGORIES: PrimaryCategory[] = [
  'Electronics',
  'Home & Kitchen',
  'Tools',
  'Apparel',
  'Groceries',
  'Subscriptions/Services',
  'Automotive',
  'Health/Personal Care',
];


export const ReceiptVaultDashboard: React.FC<ReceiptVaultDashboardProps> = ({
  assets: propAssets,
  paymentMethods: propCards,
  claims: propClaims,
  isPiiRevealed = true,
  onTogglePiiReveal,
  onAddAsset,
  onLogAssetUse,
  onFileClaim,
  onOpenReturnWizard,
  openScannerModalTrigger = false,
  onCloseScannerModalTrigger,
}) => {
  const [localAssets, setLocalAssets] = useState<Asset[]>([]);
  const [localClaims, setLocalClaims] = useState<ClaimRecord[]>([]);

  const assets = propAssets || localAssets;
  const paymentMethods = propCards || [];
  const claims = propClaims || localClaims;

  // Search, Sort & Material You Filter Chips
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState<QuickFilterChip>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | PrimaryCategory>(
    'ALL'
  );
  const [sortBy, setSortBy] = useState<SortOption>('expiring_soonest');
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    assets[0]?.id || 'ast_mbp16_m3max'
  );
  const [isInspectorSheetOpen, setIsInspectorSheetOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('coverage');

  // Onboard Receipt Intelligence v5.0 workbench toggle & state
  const [showOnboardAiWorkbench, setShowOnboardAiWorkbench] = useState(false);
  const [workbenchRawText, setWorkbenchRawText] = useState(
    MULTI_ITEM_RECEIPT_PRESETS[0]?.rawText || 'COSTCO WHOLESALE\nDATE: 2026-10-23\nLG C4 42 OLED TV $899.99\nSUBTOTAL $899.99\nSALES TAX $79.65\nTOTAL $979.64'
  );
  const [workbenchCardId, setWorkbenchCardId] = useState(
    MULTI_ITEM_RECEIPT_PRESETS[0]?.defaultCardId || 'pm_csr_01'
  );
  const [ingestedBannerMessage, setIngestedBannerMessage] = useState<
    string | null
  >(null);

  // Modals
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [claimTargetAsset, setClaimTargetAsset] = useState<Asset | null>(null);

  const showScanModal = isScanModalOpen || openScannerModalTrigger;

  const closeScanner = () => {
    setIsScanModalOpen(false);
    if (onCloseScannerModalTrigger) onCloseScannerModalTrigger();
  };

  // IntelligenceEngine v5.0 real-time evaluation for the interactive phone studio
  const onboardWorkbenchResult = useMemo(() => {
    return IntelligenceEngine.parseReceiptSync(
      workbenchRawText,
      paymentMethods
    );
  }, [workbenchRawText, paymentMethods]);

  const handleIngestWorkbenchItems = () => {
    triggerHaptic(25);
    const card =
      paymentMethods.find((c) => c.id === workbenchCardId) || paymentMethods[0];
    let addedCount = 0;

    onboardWorkbenchResult.lineItems.forEach((item, idx) => {
      const assetId = `ast_ai_${Date.now().toString().slice(-5)}_${idx}`;
      const itemTaxShare =
        onboardWorkbenchResult.subtotal > 0
          ? Number(
              (
                (item.totalPrice / onboardWorkbenchResult.subtotal) *
                onboardWorkbenchResult.taxAmount
              ).toFixed(2)
            )
          : 0;

      const policyEval = evaluateAssetPolicies({
        assetId,
        purchaseDate: onboardWorkbenchResult.transactionDate,
        category: item.category,
        brand: item.brand,
        merchantName: onboardWorkbenchResult.merchantName,
        purchasePrice: item.totalPrice,
        paymentMethod: card,
        referenceDate: REFERENCE_DATE,
      });

      const createdAsset: Asset = {
        id: assetId,
        userId: 'usr_demo',
        name: item.description,
        brand: item.brand,
        modelNumber: item.modelNumber,
        serialNumber: item.serialNumber,
        upcBarcode: item.upcBarcode,
        category: item.category,
        subcategory: item.subcategory,
        merchantName: onboardWorkbenchResult.merchantName,
        purchaseDate: onboardWorkbenchResult.transactionDate,
        purchasePrice: item.totalPrice,
        taxAmount: itemTaxShare,
        shippingFee: idx === 0 ? onboardWorkbenchResult.shippingFee : 0,
        recyclingFee: idx === 0 ? onboardWorkbenchResult.recyclingFee : 0,
        currency: 'USD',
        paymentMethodId: card.id,
        isDurableAsset: item.isDurableAsset,
        usageCount: 1,
        status: policyEval.overallAssetStatus,
        lineItems: [
          {
            id: `li_${assetId}`,
            assetId,
            description: item.description,
            category: item.category,
            subcategory: item.subcategory,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            isDurableAsset: item.isDurableAsset,
          },
        ],
        usageLogs: [
          {
            id: `ul_${assetId}`,
            assetId,
            loggedDate: REFERENCE_DATE,
            usageCount: 1,
            notes: 'Onboard IntelligenceEngine v5.0 split ingestion',
          },
        ],
        policies: policyEval.allPolicies,
        recallNotice: checkSafetyRecall(item.modelNumber, item.brand),
        createdAt: new Date().toISOString(),
      };

      if (onAddAsset) {
        onAddAsset(createdAsset);
      } else {
        setLocalAssets((prev) => [createdAsset, ...prev]);
      }
      if (idx === 0) {
        setSelectedAssetId(createdAsset.id);
      }
      addedCount += 1;
    });

    setIngestedBannerMessage(
      `Ingested ${addedCount} categorized ${
        addedCount === 1 ? 'item' : 'items'
      } from ${onboardWorkbenchResult.merchantName} into your phone vault.`
    );
    setTimeout(() => setIngestedBannerMessage(null), 5000);
  };

  const filteredAssets = useMemo(() => {
    const base = assets.filter((asset) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        const searchableText = [
          asset.name,
          asset.brand,
          asset.merchantName,
          asset.category,
          asset.subcategory,
          asset.serialNumber,
          asset.modelNumber,
          asset.upcBarcode,
          ...(asset.lineItems || []).map((li) => `${li.description} ${li.category} ${li.subcategory}`),
          ...(asset.usageLogs || []).map((ul) => ul.notes),
        ]
          .join(' ')
          .toLowerCase();

        const matchesAllTokens = tokens.every((token) => searchableText.includes(token));
        if (!matchesAllTokens) return false;
      }

      if (categoryFilter !== 'ALL' && asset.category !== categoryFilter) {
        return false;
      }

      if (activeChip === 'Electronics') {
        return asset.category === 'Electronics';
      }
      if (activeChip === 'Appliances') {
        return asset.category === 'Home & Kitchen';
      }
      if (activeChip === 'Tools') {
        return asset.category === 'Tools';
      }
      if (activeChip === 'Expiring Soon (<30d)') {
        return (
          asset.status === 'Expiring Soon' ||
          asset.policies.some((p) => p.isActive && p.daysRemaining <= 30)
        );
      }
      if (activeChip === 'Card Protected') {
        return asset.policies.some(
          (p) =>
            p.isActive &&
            (p.coverageType === 'Credit Card Extended Warranty' ||
              p.coverageType === 'Credit Card Purchase Protection')
        );
      }
      if (activeChip === 'Recalls') {
        return Boolean(asset.recallNotice);
      }

      return true;
    });

    return [...base].sort((a, b) => {
      if (sortBy === 'highest_value') {
        return b.purchasePrice - a.purchasePrice;
      }
      if (sortBy === 'newest_purchase') {
        return b.purchaseDate.localeCompare(a.purchaseDate);
      }
      if (sortBy === 'lowest_cpu') {
        const cpuA = a.purchasePrice / Math.max(1, a.usageCount || 1);
        const cpuB = b.purchasePrice / Math.max(1, b.usageCount || 1);
        return cpuA - cpuB;
      }
      // expiring_soonest
      const minDaysA = Math.min(
        ...a.policies
          .filter((p) => p.isActive)
          .map((p) => p.daysRemaining),
        9999
      );
      const minDaysB = Math.min(
        ...b.policies
          .filter((p) => p.isActive)
          .map((p) => p.daysRemaining),
        9999
      );
      return minDaysA - minDaysB;
    });
  }, [assets, searchQuery, categoryFilter, activeChip, sortBy]);

  const selectedAsset = useMemo(() => {
    return (
      filteredAssets.find((a) => a.id === selectedAssetId) ||
      assets.find((a) => a.id === selectedAssetId) ||
      filteredAssets[0] ||
      assets[0] ||
      null
    );
  }, [filteredAssets, assets, selectedAssetId]);

  // Summary KPIs
  const kpiStats = useMemo(() => {
    const totalProtectedValue = assets.reduce(
      (sum, a) => sum + a.purchasePrice,
      0
    );
    const estResaleEquity = assets.reduce((sum, a) => {
      if (!a.isDurableAsset) return sum;
      const rate = a.category === 'Tools' ? 0.14 : a.category === 'Electronics' ? 0.24 : 0.18;
      return sum + a.purchasePrice * (1 - rate);
    }, 0);
    const activeClaimsCount =
      claims.filter((c) => c.status !== 'Resolved').length ||
      assets.filter((a) => a.status === 'Claim in Progress').length;
    const expiringSoonCount = assets.filter((a) =>
      a.policies.some((p) => p.isActive && p.daysRemaining <= 30)
    ).length;
    const recallAlertsCount = assets.filter((a) => Boolean(a.recallNotice)).length;
    return {
      totalProtectedValue,
      estResaleEquity,
      activeClaimsCount,
      expiringSoonCount,
      recallAlertsCount,
    };
  }, [assets, claims]);

  const getRelativeProtectionLabel = (
    asset: Asset
  ): { text: string; tone: 'emerald' | 'amber' | 'sky' | 'rose' } => {
    const returnPol = asset.policies.find(
      (p) => p.coverageType === 'Retailer Return Window'
    );
    const mfgPol = asset.policies.find(
      (p) => p.coverageType === 'Manufacturer Warranty'
    );
    const ccExtPol = asset.policies.find(
      (p) => p.coverageType === 'Credit Card Extended Warranty'
    );

    if (returnPol?.isActive && returnPol.daysRemaining <= 30) {
      return {
        text: `${returnPol.daysRemaining}d left to return`,
        tone: returnPol.daysRemaining <= 7 ? 'amber' : 'emerald',
      };
    }
    if (mfgPol?.isActive && mfgPol.daysRemaining <= 30) {
      return {
        text: `Mfg expires in ${mfgPol.daysRemaining}d`,
        tone: 'amber',
      };
    }
    if (ccExtPol?.isActive) {
      const expYear = (ccExtPol.endDate || '').slice(0, 7);
      return {
        text: `Protected until ${expYear}`,
        tone: 'sky',
      };
    }
    if (mfgPol?.isActive) {
      const expYear = (mfgPol.endDate || '').slice(0, 7);
      return {
        text: `Mfg covered until ${expYear}`,
        tone: 'emerald',
      };
    }
    return { text: 'Coverage window lapsed', tone: 'rose' };
  };

  return (
    <div className="space-y-3.5">
      {/* Home Screen Companion Widget */}
      <HomeWidget
        assets={assets}
        onSelectAsset={(id) => setSelectedAssetId(id)}
        onOpenReturnWizard={onOpenReturnWizard}
      />

      {/* 1. Compact 2x2 Android Material You Status Grid */}
      <section
        aria-label="Ledger Status Summary Grid"
        className="grid grid-cols-2 gap-2.5"
      >
        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            setActiveChip('ALL');
          }}
          className={`text-left bg-white border rounded-2xl p-3.5 transition-all cursor-pointer ${
            activeChip === 'ALL'
              ? 'border-sky-500 ring-1 ring-sky-500/25'
              : 'border-slate-200'
          }`}
        >
          <div className="text-[11px] font-medium text-slate-500">
            Protected Value
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5 whitespace-nowrap">
            $
            {kpiStats.totalProtectedValue.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[10px] text-emerald-500 font-mono mt-0.5">
            1-Yr Equity: ${kpiStats.estResaleEquity.toFixed(0)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            setActiveChip(
              activeChip === 'Card Protected' ? 'ALL' : 'Card Protected'
            );
          }}
          className={`text-left bg-white border rounded-2xl p-3.5 transition-all cursor-pointer ${
            activeChip === 'Card Protected'
              ? 'border-emerald-500 ring-1 ring-emerald-500/25'
              : 'border-slate-200'
          }`}
        >
          <div className="text-[11px] font-medium text-slate-500">
            Active Claims &amp; Perks
          </div>
          <div className="text-lg font-bold text-emerald-500 font-mono tabular-nums mt-0.5 whitespace-nowrap">
            {kpiStats.activeClaimsCount} Active
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            Tap for card-backed items
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            setActiveChip(
              activeChip === 'Expiring Soon (<30d)'
                ? 'ALL'
                : 'Expiring Soon (<30d)'
            );
          }}
          className={`text-left bg-white border rounded-2xl p-3.5 transition-all cursor-pointer ${
            activeChip === 'Expiring Soon (<30d)'
              ? 'border-amber-500 ring-1 ring-amber-500/25'
              : 'border-slate-200'
          }`}
        >
          <div className="text-[11px] font-medium text-slate-500">
            Attention (&lt;30d)
          </div>
          <div className="text-lg font-bold text-amber-500 font-mono tabular-nums mt-0.5 whitespace-nowrap">
            {kpiStats.expiringSoonCount} Expiring
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            Return &amp; warranty alerts
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            setActiveChip(activeChip === 'Recalls' ? 'ALL' : 'Recalls');
          }}
          className={`text-left bg-white border rounded-2xl p-3.5 transition-all cursor-pointer ${
            activeChip === 'Recalls'
              ? 'border-rose-500 ring-1 ring-rose-500/25'
              : 'border-slate-200'
          }`}
        >
          <div className="text-[11px] font-medium text-slate-500">
            CPSC Safety Recalls
          </div>
          <div className="text-lg font-bold text-rose-500 font-mono tabular-nums mt-0.5 whitespace-nowrap">
            {kpiStats.recallAlertsCount} Flagged
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            Statutory remedy active
          </div>
        </button>
      </section>

      {/* 2. Phone Search, Sort & Onboard Receipt Intelligence Launcher */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search by merchant, brand, model, or category"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search merchant, brand, serial, or model..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort + Category + Onboard AI Studio Bar */}
        <div className="grid grid-cols-12 gap-1.5 items-center">
          <select
            aria-label="Sort vault assets"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="col-span-4 min-h-[34px] px-2 py-1 text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none"
          >
            <option value="expiring_soonest">Sort: Expiring</option>
            <option value="highest_value">Sort: Value</option>
            <option value="newest_purchase">Sort: Newest</option>
            <option value="lowest_cpu">Sort: Cost/Use</option>
          </select>

          <select
            aria-label="Filter by specific category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="col-span-4 min-h-[34px] px-2 py-1 text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(12);
              setShowOnboardAiWorkbench((prev) => !prev);
            }}
            className={`col-span-4 min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer border ${
              showOnboardAiWorkbench
                ? 'bg-sky-500/15 border-sky-500 text-sky-400'
                : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Onboard AI</span>
          </button>
        </div>

        {/* Horizontal Touch-Scroll Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(
            [
              'ALL',
              'Expiring Soon (<30d)',
              'Card Protected',
              'Recalls',
              'Electronics',
              'Appliances',
              'Tools',
            ] as QuickFilterChip[]
          ).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setActiveChip(chip);
              }}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeChip === chip
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {chip === 'ALL' ? 'All Assets' : chip}
            </button>
          ))}
        </div>
      </section>

      {/* 3. Onboard IntelligenceEngine v5.0 Live Phone Studio Drawer */}
      {showOnboardAiWorkbench && (
        <section
          aria-label="Onboard Receipt Intelligence Itemizer & Categorizer"
          className="bg-white border border-sky-500/40 rounded-2xl p-3.5 space-y-3"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-500">
                <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>
                  {onboardWorkbenchResult.engineVersion} · 100% On-Device NPU
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 mt-0.5">
                Live Receipt Interpreter &amp; Card Perk Optimizer
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowOnboardAiWorkbench(false)}
              aria-label="Close Onboard AI Studio"
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Preset Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {MULTI_ITEM_RECEIPT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setWorkbenchRawText(preset.rawText);
                  setWorkbenchCardId(preset.defaultCardId);
                }}
                className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.label.split(' (')[0]}
              </button>
            ))}
          </div>

          {ingestedBannerMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{ingestedBannerMessage}</span>
            </div>
          )}

          {/* Raw OCR Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <label
                htmlFor="onboard-raw-receipt"
                className="font-semibold text-slate-700"
              >
                Raw OCR Receipt Stream
              </label>
              <span className="font-mono text-[10px] text-slate-500">
                Confidence: {(onboardWorkbenchResult.confidenceScore * 100).toFixed(0)}% ·{' '}
                {onboardWorkbenchResult.merchantReturnWindowDays}d Return
              </span>
            </div>
            <textarea
              id="onboard-raw-receipt"
              rows={4}
              value={workbenchRawText}
              onChange={(e) => setWorkbenchRawText(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* IntelligenceEngine v5.0 Card Perk Optimization & Advisory Insights */}
          <div
            className={`p-2.5 rounded-xl border text-xs space-y-1 ${
              onboardWorkbenchResult.cardOptimization.isOptimalCardUsed
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {onboardWorkbenchResult.cardOptimization.isOptimalCardUsed
                    ? 'Optimal Card Perk Active'
                    : 'Better Card Tier Available'}
                </span>
              </span>
              <span className="font-mono text-[10px]">
                +{onboardWorkbenchResult.cardOptimization.extendedWarrantyMonthsAdded}m Ext
              </span>
            </div>
            <p className="text-[11px] leading-snug">
              {onboardWorkbenchResult.cardOptimization.recommendationNote}
            </p>
          </div>

          {/* Key Parsed Insights */}
          <div className="space-y-1.5">
            {onboardWorkbenchResult.insights.map((ins) => (
              <div
                key={ins.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2 min-w-0">
                  {ins.severity === 'critical' ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  ) : ins.severity === 'warning' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  ) : ins.severity === 'positive' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">
                      {ins.title}
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug">
                      {ins.detail}
                    </div>
                  </div>
                </div>
                {ins.metricBadge && (
                  <span className="font-mono text-[10px] font-bold text-sky-400 shrink-0">
                    {ins.metricBadge}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Itemized Lines */}
          <div className="space-y-1.5">
            {onboardWorkbenchResult.lineItems.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-sky-400 shrink-0" />
                    <span>{item.description}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    <span className="font-semibold text-sky-400">
                      {item.category} &rarr; {item.subcategory}
                    </span>{' '}
                    ·{' '}
                    {item.isDurableAsset
                      ? `${item.estimatedWarrantyMonths}m Mfg · 1-Yr $${item.estimatedOneYearResaleValue.toFixed(0)}`
                      : 'Consumable'}
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="font-bold text-slate-900">
                    ${item.totalPrice.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {(item.confidence * 100).toFixed(0)}% conf
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleIngestWorkbenchItems}
            className="w-full min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              Ingest All {onboardWorkbenchResult.lineItems.length} Categorized Items
            </span>
          </button>
        </section>
      )}

      {/* 4. Single-Column Android Phone Asset Feed */}
      {filteredAssets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              No matching assets in this filter
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Scan a paper receipt or reset your filter chips to view your protected hardware.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            {(searchQuery ||
              activeChip !== 'ALL' ||
              categoryFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveChip('ALL');
                  setCategoryFilter('ALL');
                }}
                className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsScanModalOpen(true)}
              className="min-h-[38px] px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>Scan Receipt</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssets.map((asset) => {
            const isSelected = selectedAsset?.id === asset.id;
            const card =
              paymentMethods.find((pm) => pm.id === asset.paymentMethodId) ||
              paymentMethods[0];

            const returnPol = asset.policies.find(
              (p) => p.coverageType === 'Retailer Return Window'
            );
            const mfgPol = asset.policies.find(
              (p) => p.coverageType === 'Manufacturer Warranty'
            );
            const ccExtPol = asset.policies.find(
              (p) => p.coverageType === 'Credit Card Extended Warranty'
            );
            const relBadge = getRelativeProtectionLabel(asset);
            const costPerUse =
              asset.purchasePrice / Math.max(1, asset.usageCount || 1);

            return (
              <article
                key={asset.id}
                onClick={() => {
                  triggerHaptic('cardExpansion');
                  setSelectedAssetId(asset.id);
                }}
                className={`bg-white border rounded-2xl m3-card-pad p-4 transition-all duration-200 ${
                  isSelected
                    ? 'border-sky-500 ring-1 ring-sky-500/30 ambient-active-glow'
                    : 'border-slate-200'
                }`}
              >
                {/* Top Row: Monogram + Title + Price */}
                <div className="flex items-start justify-between gap-2.5 mb-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      aria-hidden="true"
                      className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-mono text-xs font-bold text-sky-400 shrink-0 mt-0.5"
                    >
                      {asset.merchantName.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                        <span className="font-semibold text-slate-700">
                          {asset.brand}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{asset.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{asset.merchantName}</span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug truncate mt-0.5">
                        {asset.name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                        <span>{asset.purchaseDate}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          S/N:{' '}
                          {formatProtectedField(
                            asset.serialNumber,
                            isPiiRevealed,
                            'serial'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm sm:text-base font-bold text-slate-900 font-mono tabular-nums">
                      $
                      {asset.purchasePrice.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono tabular-nums flex items-center justify-end gap-1 mt-0.5">
                      <CreditCard className="w-3 h-3 text-sky-400 shrink-0" />
                      <span>
                        {card.issuer} ••
                        {formatProtectedField(
                          card.lastFour,
                          isPiiRevealed,
                          'card'
                        ).slice(-4)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recall Banner */}
                {asset.recallNotice && (
                  <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-red-900 leading-snug">
                      <span className="font-semibold">
                        Recall ({asset.recallNotice.recallId}):
                      </span>{' '}
                      {asset.recallNotice.summary}
                    </div>
                  </div>
                )}

                {/* Compact 3-Column Coverage Meters for Phone */}
                <div className="grid grid-cols-3 gap-1.5 py-2">
                  {/* 1. Store Return */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-500">Return</span>
                      <span className="font-mono font-bold text-slate-900">
                        {returnPol?.isActive
                          ? `${returnPol.daysRemaining}d`
                          : 'End'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          !returnPol?.isActive
                            ? 'bg-rose-500/40'
                            : returnPol.daysRemaining <= 7
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${
                            returnPol?.isActive
                              ? Math.max(15, returnPol.percentRemaining)
                              : 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 2. Mfg Warranty */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-500">Mfg</span>
                      <span className="font-mono font-bold text-slate-900">
                        {mfgPol?.isActive ? `${mfgPol.daysRemaining}d` : 'End'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          !mfgPol?.isActive
                            ? 'bg-rose-500/40'
                            : mfgPol.daysRemaining <= 30
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${
                            mfgPol?.isActive
                              ? Math.max(12, mfgPol.percentRemaining)
                              : 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 3. Card Extended */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-500">Card Ext</span>
                      <span className="font-mono font-bold text-slate-900">
                        {ccExtPol?.isActive
                          ? `${ccExtPol.daysRemaining}d`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          !ccExtPol?.isActive
                            ? 'bg-slate-400'
                            : ccExtPol.daysRemaining <= 30
                            ? 'bg-amber-500'
                            : 'bg-sky-400'
                        }`}
                        style={{
                          width: `${
                            ccExtPol?.isActive
                              ? Math.max(15, ccExtPol.percentRemaining)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Phone Card Action Footer */}
                <div className="pt-2.5 mt-1 border-t border-slate-100 space-y-2">
                  <div className="text-[11px] font-mono flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {relBadge.tone === 'emerald' && (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{relBadge.text}</span>
                        </span>
                      )}
                      {relBadge.tone === 'sky' && (
                        <span className="text-sky-400 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 shrink-0" />
                          <span>{relBadge.text}</span>
                        </span>
                      )}
                      {relBadge.tone === 'amber' && (
                        <span className="text-amber-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>{relBadge.text}</span>
                        </span>
                      )}
                      {relBadge.tone === 'rose' && (
                        <span className="text-rose-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>{relBadge.text}</span>
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500 shrink-0">
                      ${costPerUse.toFixed(0)}/use · {asset.usageCount} uses
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic(10);
                        if (onLogAssetUse) {
                          onLogAssetUse(asset.id);
                        } else {
                          setLocalAssets((prev) =>
                            prev.map((a) =>
                              a.id === asset.id
                                ? { ...a, usageCount: a.usageCount + 1 }
                                : a
                            )
                          );
                        }
                      }}
                      className="min-h-[36px] px-2.5 py-1 text-[11px] font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                      aria-label={`Log use for ${asset.name}`}
                    >
                      +1 Use ({asset.usageCount})
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic(12);
                        setSelectedAssetId(asset.id);
                        setIsInspectorSheetOpen(true);
                      }}
                      className="min-h-[36px] px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-colors flex items-center justify-center gap-0.5 cursor-pointer"
                    >
                      <span>Inspect</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic(15);
                        setClaimTargetAsset(asset);
                      }}
                      className="min-h-[36px] px-3 py-1 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                    >
                      File Claim
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 5. Active Asset Quick-Inspector Card (Inline Phone Summary + Expandable Sheet) */}
      {selectedAsset && (
        <section
          aria-label="Selected Asset Digital Twin Inspector"
          className="bg-white border border-sky-500/40 rounded-2xl p-4 space-y-3.5"
        >
          {(() => {
            const card =
              paymentMethods.find(
                (pm) => pm.id === selectedAsset.paymentMethodId
              ) || paymentMethods[0];
            const bestRoute = selectOptimalClaimRoute(
              selectedAsset,
              'Hardware Defect'
            );
            const cpu =
              selectedAsset.purchasePrice /
              Math.max(1, selectedAsset.usageCount || 1);
            const estResale =
              selectedAsset.purchasePrice *
              (selectedAsset.category === 'Tools'
                ? 0.86
                : selectedAsset.category === 'Electronics'
                ? 0.76
                : 0.82);

            return (
              <>
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono text-sky-400">
                      Digital Twin Inspector · {selectedAsset.brand}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 truncate mt-0.5">
                      {selectedAsset.name}
                    </h3>
                    <div className="text-[11px] text-slate-500">
                      {selectedAsset.merchantName} · {selectedAsset.purchaseDate}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                      $
                      {(
                        selectedAsset.purchasePrice + selectedAsset.taxAmount
                      ).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Incl. ${selectedAsset.taxAmount.toFixed(2)} tax
                    </div>
                  </div>
                </div>

                {/* 3-Tab Segmented Switcher Inside Phone Inspector */}
                <div
                  role="tablist"
                  aria-label="Asset Digital Twin Tabs"
                  className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl"
                >
                  {(
                    [
                      { id: 'coverage', label: 'Coverage' },
                      { id: 'valuation', label: 'Value & CPU' },
                      { id: 'receipt', label: 'Enclave IDs' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={inspectorTab === tab.id}
                      onClick={() => {
                        triggerHaptic(8);
                        setInspectorTab(tab.id);
                      }}
                      className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        inspectorTab === tab.id
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab 1: Coverage & Optimal Route */}
                {inspectorTab === 'coverage' && (
                  <div className="space-y-2.5">
                    <div className="space-y-1.5">
                      {selectedAsset.policies.map((pol) => (
                        <div
                          key={pol.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900">
                              {pol.coverageType}
                            </span>
                            <span
                              className={`font-mono tabular-nums font-semibold ${
                                !pol.isActive
                                  ? 'text-slate-400'
                                  : pol.daysRemaining <= 30
                                  ? 'text-amber-500'
                                  : 'text-emerald-500'
                              }`}
                            >
                              {pol.isActive
                                ? `${pol.daysRemaining}d left`
                                : 'Expired'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span>{pol.providerName}</span>
                            <span>Ends {pol.endDate}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-emerald-950 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Route: {bestRoute.recommendedRoute}</span>
                        </span>
                        <span className="font-mono text-[10px] text-emerald-800">
                          {card.issuer}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-900 leading-snug">
                        {bestRoute.rationale}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tab 2: Valuation & Cost-Per-Use */}
                {inspectorTab === 'valuation' && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="text-[10px] font-sans text-slate-500">
                          Logged Cost / Use
                        </div>
                        <div className="text-base font-bold text-slate-900 mt-0.5">
                          ${cpu.toFixed(2)}/use
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {selectedAsset.usageCount} sessions logged
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="text-[10px] font-sans text-slate-500">
                          Est. 1-Yr Resale Value
                        </div>
                        <div className="text-base font-bold text-emerald-500 mt-0.5">
                          ${estResale.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Secondary market equity
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(12);
                        if (onLogAssetUse) onLogAssetUse(selectedAsset.id);
                      }}
                      className="w-full min-h-[38px] px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5 text-emerald-500" />
                      <span>
                        Log Utilization Session (+1) · Current: {selectedAsset.usageCount}
                      </span>
                    </button>
                  </div>
                )}

                {/* Tab 3: Encrypted Hardware IDs & Line Items */}
                {inspectorTab === 'receipt' && (
                  <div className="space-y-2.5">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {isPiiRevealed ? (
                            <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span>AES-256-GCM Hardware IDs</span>
                        </span>
                        {onTogglePiiReveal && (
                          <button
                            type="button"
                            onClick={onTogglePiiReveal}
                            className="text-[11px] font-medium text-sky-400 underline cursor-pointer"
                          >
                            {isPiiRevealed ? 'Mask PII' : 'Reveal PII'}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono tabular-nums">
                        <div className="bg-white border border-slate-200 rounded-lg p-2">
                          <div className="text-[9px] font-sans text-slate-500">
                            Model
                          </div>
                          <div className="font-semibold text-slate-900 truncate">
                            {formatProtectedField(
                              selectedAsset.modelNumber,
                              isPiiRevealed,
                              'model'
                            )}
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-2">
                          <div className="text-[9px] font-sans text-slate-500">
                            Serial (S/N)
                          </div>
                          <div className="font-semibold text-slate-900 truncate">
                            {formatProtectedField(
                              selectedAsset.serialNumber,
                              isPiiRevealed,
                              'serial'
                            )}
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-2">
                          <div className="text-[9px] font-sans text-slate-500">
                            UPC
                          </div>
                          <div className="font-semibold text-slate-900 truncate">
                            {selectedAsset.upcBarcode}
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedAsset.lineItems &&
                      selectedAsset.lineItems.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-sky-400" />
                            <span>Itemized Receipt Lines</span>
                          </div>
                          {selectedAsset.lineItems.map((li) => (
                            <div
                              key={li.id}
                              className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 truncate">
                                  {li.description}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {li.category} &rarr; {li.subcategory}
                                </div>
                              </div>
                              <span className="font-mono font-semibold text-slate-900 shrink-0">
                                ${li.totalPrice.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                )}

                {/* Bottom Action Buttons */}
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setClaimTargetAsset(selectedAsset)}
                    className="flex-1 min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Launch Claim Wizard</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsScanModalOpen(true)}
                    className="min-h-[42px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ScanLine className="w-4 h-4" />
                    <span>Scan</span>
                  </button>
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* Optional Slide-Up Modal Sheet when user explicitly taps "Inspect" on a card */}
      {isInspectorSheetOpen && selectedAsset && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Details for ${selectedAsset.name}`}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center"
        >
          <div className="bg-white border-t border-slate-200 rounded-t-3xl max-w-[430px] w-full p-4 shadow-2xl max-h-[88vh] overflow-y-auto space-y-4">
            <div className="w-10 h-1.5 bg-slate-500/40 rounded-full mx-auto" />
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <div className="text-[11px] font-mono text-sky-400">
                  {selectedAsset.brand} · {selectedAsset.category}
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {selectedAsset.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsInspectorSheetOpen(false)}
                aria-label="Close asset inspector"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {selectedAsset.policies.map((pol) => (
                <div
                  key={pol.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {pol.coverageType}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {pol.providerName} · Ends {pol.endDate}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-500">
                    {pol.isActive ? `${pol.daysRemaining}d left` : 'Lapsed'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsInspectorSheetOpen(false);
                  setClaimTargetAsset(selectedAsset);
                }}
                className="flex-1 min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>File Coverage Claim</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera & Multi-Point Ingestion Sheet (ScanModal) */}
      <ScanModal
        isOpen={showScanModal}
        paymentMethods={paymentMethods}
        onClose={closeScanner}
        onIngestAsset={(newAsset) => {
          if (onAddAsset) {
            onAddAsset(newAsset);
          } else {
            setLocalAssets((prev) => [newAsset, ...prev]);
          }
          setSelectedAssetId(newAsset.id);
        }}
      />

      {/* Interactive Claim Intake & Route Selector (ClaimWizard) */}
      <ClaimWizard
        asset={claimTargetAsset}
        paymentMethods={paymentMethods}
        isPiiRevealed={isPiiRevealed}
        onClose={() => setClaimTargetAsset(null)}
        onFileClaim={(compiledClaim) => {
          if (onFileClaim) {
            onFileClaim(compiledClaim);
          } else {
            setLocalClaims((prev) => [compiledClaim, ...prev]);
            setLocalAssets((prev) =>
              prev.map((a) =>
                a.id === compiledClaim.assetId
                  ? { ...a, status: 'Claim in Progress' }
                  : a
              )
            );
          }
        }}
      />
    </div>
  );
};

export const ReceiptVaultHome = ReceiptVaultDashboard;

import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  PaymentMethod,
  CardNetwork,
  Asset,
  CategoryBudget,
} from '../types/schema';
import { formatProtectedField } from '../lib/vaultCrypto';
import { SpendingTrackerDashboard } from './SpendingTrackerDashboard';

export interface CardMatrixScreenProps {
  paymentMethods: PaymentMethod[];
  assets: Asset[];
  budgets: CategoryBudget[];
  isPiiRevealed: boolean;
  onAddPaymentMethod: (newCard: PaymentMethod) => void;
  onUpdateBudgetLimit: (budgetId: string, newMonthlyLimit: number) => void;
  onLogAssetUse: (assetId: string) => void;
}

export const CardMatrixScreen: React.FC<CardMatrixScreenProps> = ({
  paymentMethods,
  assets,
  budgets,
  isPiiRevealed,
  onAddPaymentMethod,
  onUpdateBudgetLimit,
  onLogAssetUse,
}) => {
  const [subView, setSubView] = useState<'matrix' | 'spending'>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string>(
    paymentMethods[0]?.id || ''
  );
  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);

  // Add New Card Dialog state
  const [newIssuer, setNewIssuer] = useState('');
  const [newCardName, setNewCardName] = useState('');
  const [newNetwork, setNewNetwork] = useState<CardNetwork>('Visa');
  const [newLastFour, setNewLastFour] = useState('');
  const [newExtMonths, setNewExtMonths] = useState('12');
  const [newPpDays, setNewPpDays] = useState('120');
  const [newPpMaxUsd, setNewPpMaxUsd] = useState('10000');
  const [newRpDays, setNewRpDays] = useState('90');
  const [cardError, setCardError] = useState<string | null>(null);

  const triggerHaptic = (ms = 12) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {
      // ignore
    }
  };

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return paymentMethods;
    return paymentMethods.filter(
      (pm) =>
        pm.issuer.toLowerCase().includes(q) ||
        pm.cardName.toLowerCase().includes(q) ||
        pm.network.toLowerCase().includes(q) ||
        pm.lastFour.includes(q)
    );
  }, [paymentMethods, searchQuery]);

  const activeCard =
    filteredCards.find((c) => c.id === selectedCardId) ||
    filteredCards[0] ||
    paymentMethods[0] ||
    null;

  const getAssetsForCard = (cardId: string) => {
    return assets.filter((a) => a.paymentMethodId === cardId);
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(20);
    if (!newIssuer.trim() || !newCardName.trim()) {
      setCardError('Card Issuer and Account Tier Name are required.');
      return;
    }
    if (!/^\d{4}$/.test(newLastFour.trim())) {
      setCardError('Last 4 digits must be exactly 4 numbers.');
      return;
    }

    const card: PaymentMethod = {
      id: `pm_${Date.now().toString().slice(-5)}`,
      userId: 'usr_demo',
      issuer: newIssuer.trim(),
      cardName: newCardName.trim(),
      network: newNetwork,
      lastFour: newLastFour.trim(),
      extendedWarrantyMonths: parseInt(newExtMonths, 10) || 12,
      maxOriginalWarrantyMonths: 36,
      purchaseProtectionDays: parseInt(newPpDays, 10) || 120,
      purchaseProtectionMaxClaimUsd: parseInt(newPpMaxUsd, 10) || 10000,
      returnProtectionDays: parseInt(newRpDays, 10) || 90,
      rewardMultipliers: [
        { category: 'Electronics', multiplier: 3, rewardUnit: 'Points' },
        { category: 'Tools', multiplier: 2, rewardUnit: 'Points' },
        { category: 'All Other', multiplier: 1.5, rewardUnit: 'Points' },
      ],
      createdAt: new Date().toISOString(),
    };

    onAddPaymentMethod(card);
    setSelectedCardId(card.id);
    setNewIssuer('');
    setNewCardName('');
    setNewLastFour('');
    setCardError(null);
    setIsAddCardDialogOpen(false);
  };

  return (
    <div className="space-y-4 animate-tab-transition">
      {/* Top Phone Segmented Control & Add New Card Button */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
        <div
          role="group"
          aria-label="Benefits and Spend View Mode"
          className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl"
        >
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setSubView('matrix');
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
              subView === 'matrix'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Card Wallet ({paymentMethods.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setSubView('spending');
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
              subView === 'spending'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Spend &amp; Budgets</span>
          </button>
        </div>

        {subView === 'matrix' && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search enrolled cards by issuer or tier"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issuer or card tier..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(15);
                setIsAddCardDialogOpen(true);
              }}
              className="min-h-[38px] px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Card</span>
            </button>
          </div>
        )}
      </div>

      {subView === 'spending' ? (
        <SpendingTrackerDashboard
          assets={assets}
          budgets={budgets}
          paymentMethods={paymentMethods}
          isPiiRevealed={isPiiRevealed}
          onUpdateBudgetLimit={onUpdateBudgetLimit}
          onLogAssetUse={onLogAssetUse}
        />
      ) : (
        <div className="space-y-3.5">
          {/* Enrolled Payment Methods Phone Wallet Stack */}
          <div className="space-y-3">
            {filteredCards.map((pm) => {
              const linkedAssets = getAssetsForCard(pm.id);
              const totalProtectedOnCard = linkedAssets.reduce(
                (sum, a) => sum + a.purchasePrice,
                0
              );
              const activePurchaseProtAssets = linkedAssets.filter((a) =>
                a.policies.some(
                  (p) =>
                    p.coverageType === 'Credit Card Purchase Protection' &&
                    p.isActive
                )
              );
              const isSelected = activeCard?.id === pm.id;

              return (
                <article
                  key={pm.id}
                  onClick={() => {
                    triggerHaptic(8);
                    setSelectedCardId(pm.id);
                  }}
                  className={`bg-white border rounded-2xl m3-card-pad p-4 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-sky-500 ring-1 ring-sky-500/30 ambient-active-glow'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500">
                        {pm.issuer} · {pm.network}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">
                        {pm.cardName}
                      </h3>
                    </div>

                    <div className="text-right font-mono tabular-nums">
                      <div className="text-xs font-bold text-sky-400">
                        ••••{' '}
                        {formatProtectedField(
                          pm.lastFour,
                          isPiiRevealed,
                          'card'
                        ).slice(-4)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {linkedAssets.length} Assets · $
                        {totalProtectedOnCard.toFixed(0)}
                      </div>
                    </div>
                  </div>

                  {/* 3 Protection Pillars (Compact Phone Stack) */}
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[10px] text-slate-500">
                        Ext Warranty
                      </div>
                      <div className="font-mono font-bold text-sky-400 mt-0.5">
                        +{pm.extendedWarrantyMonths}m
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[10px] text-slate-500">
                        Purchase Prot
                      </div>
                      <div className="font-mono font-bold text-emerald-500 mt-0.5">
                        {pm.purchaseProtectionDays}d ({activePurchaseProtAssets.length})
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[10px] text-slate-500">
                        Return / FCBA
                      </div>
                      <div className="font-mono font-bold text-slate-900 mt-0.5">
                        {pm.returnProtectionDays > 0
                          ? `${pm.returnProtectionDays}d Ret`
                          : '60d FCBA'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="truncate">
                      Multipliers:{' '}
                      {pm.rewardMultipliers
                        .map((m) => `${m.category} ${m.multiplier}x`)
                        .join(' · ')}
                    </span>
                    <span className="font-mono shrink-0">
                      Max ${pm.purchaseProtectionMaxClaimUsd.toLocaleString()}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Selected Card Linked Vault Assets (Mobile Cards instead of Table) */}
          {activeCard && (
            <section
              aria-label="Selected Card Protected Assets Matrix"
              className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <div className="text-[11px] text-emerald-500 flex items-center gap-1 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>
                      {activeCard.issuer} {activeCard.cardName}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                    Protected Vault Assets ({getAssetsForCard(activeCard.id).length})
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  Cap: ${activeCard.purchaseProtectionMaxClaimUsd.toLocaleString()}
                </span>
              </div>

              {getAssetsForCard(activeCard.id).length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  No hardware assets linked to {activeCard.cardName}. Select this card when scanning a receipt.
                </div>
              ) : (
                <div className="space-y-2">
                  {getAssetsForCard(activeCard.id).map((asset) => {
                    const pp = asset.policies.find(
                      (p) =>
                        p.coverageType === 'Credit Card Purchase Protection'
                    );
                    const ext = asset.policies.find(
                      (p) =>
                        p.coverageType === 'Credit Card Extended Warranty'
                    );
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
                              {asset.brand} · {asset.merchantName} ·{' '}
                              {asset.purchaseDate}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-slate-900 shrink-0">
                            ${asset.purchasePrice.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-slate-200/60">
                          {pp?.isActive ? (
                            <span className="text-emerald-500 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Prot: {pp.daysRemaining}d left</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              Purchase Prot: Lapsed
                            </span>
                          )}

                          {ext?.isActive ? (
                            <span className="text-sky-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Ext: {ext.endDate}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">Ext: N/A</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Add New Card / Account Tier Phone Bottom Sheet */}
      {isAddCardDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-card-dialog-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center"
        >
          <div className="bg-white border-t border-slate-200 rounded-t-3xl max-w-[430px] w-full p-4 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-500/40 rounded-full mx-auto" />
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <div className="text-[11px] font-medium text-sky-400">
                  Card Benefit Profile Enrollment
                </div>
                <h2
                  id="add-card-dialog-title"
                  className="text-base font-bold text-slate-900 mt-0.5"
                >
                  Add New Card / Account Tier
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCardDialogOpen(false)}
                aria-label="Close Add Card Dialog"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCard} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="card-issuer-input"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    Card Issuer
                  </label>
                  <input
                    id="card-issuer-input"
                    type="text"
                    placeholder="e.g., Capital One"
                    value={newIssuer}
                    onChange={(e) => setNewIssuer(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="card-tier-input"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    Account Tier Name
                  </label>
                  <input
                    id="card-tier-input"
                    type="text"
                    placeholder="e.g., Venture X"
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="card-network-select"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    Payment Network
                  </label>
                  <select
                    id="card-network-select"
                    value={newNetwork}
                    onChange={(e) =>
                      setNewNetwork(e.target.value as CardNetwork)
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  >
                    <option value="Visa">Visa Infinite / Signature</option>
                    <option value="Amex">American Express</option>
                    <option value="Mastercard">Mastercard World Elite</option>
                    <option value="Discover">Discover</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="card-last4-input"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    Last 4 Digits
                  </label>
                  <input
                    id="card-last4-input"
                    type="text"
                    maxLength={4}
                    placeholder="8842"
                    value={newLastFour}
                    onChange={(e) =>
                      setNewLastFour(e.target.value.replace(/\D/g, ''))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label
                    htmlFor="card-ext-months"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    +Ext (Mo)
                  </label>
                  <input
                    id="card-ext-months"
                    type="number"
                    value={newExtMonths}
                    onChange={(e) => setNewExtMonths(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="card-pp-days"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    Prot (Days)
                  </label>
                  <input
                    id="card-pp-days"
                    type="number"
                    value={newPpDays}
                    onChange={(e) => setNewPpDays(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="card-rp-days"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    Return (Days)
                  </label>
                  <input
                    id="card-rp-days"
                    type="number"
                    value={newRpDays}
                    onChange={(e) => setNewRpDays(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="card-pp-max-usd"
                  className="block text-[11px] font-medium text-slate-700 mb-1"
                >
                  Purchase Protection Max Claim Limit (USD)
                </label>
                <input
                  id="card-pp-max-usd"
                  type="number"
                  value={newPpMaxUsd}
                  onChange={(e) => setNewPpMaxUsd(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              {cardError && (
                <p role="alert" className="text-xs text-rose-500 font-medium">
                  {cardError}
                </p>
              )}

              <div className="flex items-center gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddCardDialogOpen(false)}
                  className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Enroll Card Tier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

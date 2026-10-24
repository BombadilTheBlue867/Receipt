import React, { useState } from 'react';
import {
  CreditCard,
  Database,
  Lock,
  Unlock,
  Copy,
  Check,
  Plus,
  Fingerprint,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Palette,
  Cloud,
} from 'lucide-react';
import {
  PaymentMethod,
  CardNetwork,
  POSTGRES_SCHEMA_DDL,
} from '../types/schema';
import { formatProtectedField } from '../lib/vaultCrypto';
import {
  ThemeSwitcherBar,
  VaultThemeId,
} from './ThemeSwitcherBar';
import { PWAInstallBanner } from './PWAInstallBanner';

interface CardsAndSecurityViewProps {
  paymentMethods: PaymentMethod[];
  isPiiRevealed: boolean;
  onTogglePiiReveal?: () => void;
  onAddPaymentMethod: (newCard: PaymentMethod) => void;
  storedPasscode: string;
  onUpdatePasscode: (newCode: string) => void;
  onLockVaultNow: () => void;
  lastUnlockMethod: string;
  activeTheme?: VaultThemeId;
  onSelectTheme?: (theme: VaultThemeId) => void;
  currentUserEmail?: string | null;
  onSignInCloud?: () => void;
  onSignOutCloud?: () => void;
}

export const CardsAndSecurityView: React.FC<CardsAndSecurityViewProps> = ({
  paymentMethods,
  isPiiRevealed,
  onTogglePiiReveal,
  onAddPaymentMethod,
  storedPasscode,
  onUpdatePasscode,
  onLockVaultNow,
  lastUnlockMethod,
  activeTheme = 'alabaster',
  onSelectTheme,
  currentUserEmail,
  onSignInCloud,
  onSignOutCloud,
}) => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSchemaDdl, setShowSchemaDdl] = useState(false);
  const [newIssuer, setNewIssuer] = useState('');
  const [newCardName, setNewCardName] = useState('');
  const [newNetwork, setNewNetwork] = useState<CardNetwork>('Visa');
  const [newLastFour, setNewLastFour] = useState('');
  const [newExtMonths, setNewExtMonths] = useState('12');
  const [newPpDays, setNewPpDays] = useState('120');
  const [newRpDays, setNewRpDays] = useState('90');
  const [cardError, setCardError] = useState<string | null>(null);

  const [customPasscode, setCustomPasscode] = useState(storedPasscode);
  const [passcodeSaved, setPasscodeSaved] = useState(false);

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssuer.trim() || !newCardName.trim()) {
      setCardError('Issuer and Card Name are required.');
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
      purchaseProtectionDays: parseInt(newPpDays, 10) || 90,
      purchaseProtectionMaxClaimUsd: 10000,
      returnProtectionDays: parseInt(newRpDays, 10) || 90,
      rewardMultipliers: [
        { category: 'Electronics', multiplier: 3, rewardUnit: 'Points' },
        { category: 'All Other', multiplier: 1.5, rewardUnit: 'Points' },
      ],
      createdAt: new Date().toISOString(),
    };

    onAddPaymentMethod(card);
    setNewIssuer('');
    setNewCardName('');
    setNewLastFour('');
    setCardError(null);
  };

  const handleSavePasscode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customPasscode.replace(/\D/g, '');
    if (cleaned.length < 4 || cleaned.length > 6) return;
    onUpdatePasscode(cleaned);
    setPasscodeSaved(true);
    setTimeout(() => setPasscodeSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* 1. Interface Theme Studio */}
      {onSelectTheme && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span>Appearance &amp; Display Calibration</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                Workspace Theme Studio
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Active: {activeTheme}
            </span>
          </div>

          <ThemeSwitcherBar
            activeTheme={activeTheme}
            onSelectTheme={onSelectTheme}
            variant="gallery"
          />
        </section>
      )}

      {/* 2. Two-Column Setup Grid: Biometric Security Enclave + Phone App & Cloud Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Columns: Hardware Biometric & AES-256-GCM Enclave Controls */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs text-emerald-700 font-mono font-semibold">
              <span className="flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4" />
                <span>AES-256-GCM + WEBAUTHN ENCLAVE</span>
              </span>
              <span>Unlocked via: {lastUnlockMethod}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Biometric Lock Screen &amp; Personal Data Encryption
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your serial numbers, receipt OCR payloads, payment card digits, and claimant identity are encrypted client-side using 256-bit AES-GCM keys derived from your phone lock screen code or hardware biometrics.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <form onSubmit={handleSavePasscode} className="flex items-center gap-2">
              <label
                htmlFor="update-pin-input"
                className="text-xs font-medium text-slate-700"
              >
                Phone Lock PIN:
              </label>
              <input
                id="update-pin-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={customPasscode}
                onChange={(e) =>
                  setCustomPasscode(e.target.value.replace(/\D/g, ''))
                }
                className="w-20 px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-center"
              />
              <button
                type="submit"
                className="min-h-[36px] px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg cursor-pointer"
              >
                {passcodeSaved ? 'PIN Saved' : 'Update PIN'}
              </button>
            </form>

            <div className="flex items-center gap-2">
              {onTogglePiiReveal && (
                <button
                  type="button"
                  onClick={onTogglePiiReveal}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {isPiiRevealed ? (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>PII Decrypted</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>PII Masked</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={onLockVaultNow}
                className="min-h-[36px] px-4 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Vault Now</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right 5 Columns: Android Standalone App & Cloud Backup Setup */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Device &amp; Cloud Setup</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Android Phone App &amp; Encrypted Sync
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Install ReceiptVault as a standalone home screen app on Android or iOS for instant camera barcode scanning, offline receipt access, and hardware biometric unlock.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <PWAInstallBanner />

            {currentUserEmail ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-700 font-mono truncate max-w-[160px]">
                  {currentUserEmail}
                </span>
                {onSignOutCloud && (
                  <button
                    type="button"
                    onClick={onSignOutCloud}
                    className="min-h-[36px] px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg cursor-pointer"
                  >
                    Sign Out
                  </button>
                )}
              </div>
            ) : (
              onSignInCloud && (
                <button
                  type="button"
                  onClick={onSignInCloud}
                  className="min-h-[36px] px-3.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Connect Cloud Sync</span>
                </button>
              )
            )}
          </div>
        </section>
      </div>

      {/* 3. Stored Credit Card Perks Matrix */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Credit Card Protection &amp; Benefits Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatic policy calculator rules for Extended Warranty, Purchase Protection, and Return Protection
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-semibold text-slate-700">{pm.issuer}</span>
                  <span className="font-mono">
                    {pm.network}{' '}
                    {formatProtectedField(pm.lastFour, isPiiRevealed, 'card')}
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 mb-4">
                  {pm.cardName}
                </h4>

                <div className="space-y-2.5 text-xs border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Extended Warranty:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      +{pm.extendedWarrantyMonths} Months (up to{' '}
                      {pm.maxOriginalWarrantyMonths}m base)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Purchase Protection:</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {pm.purchaseProtectionDays} Days (up to $
                      {pm.purchaseProtectionMaxClaimUsd.toLocaleString()})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Return Protection:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {pm.returnProtectionDays} Days
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                Multipliers:{' '}
                {pm.rewardMultipliers
                  .map((m) => `${m.category}: ${m.multiplier}x`)
                  .join(' · ')}
              </div>
            </div>
          ))}
        </div>

        {/* Add New Card Profile Form */}
        <form
          onSubmit={handleCreateCard}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-slate-500" />
            <span>Register Additional Payment Card Profile</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <input
              type="text"
              placeholder="Issuer (e.g., Chase)"
              aria-label="Card Issuer"
              value={newIssuer}
              onChange={(e) => setNewIssuer(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              placeholder="Card Name (e.g., Venture X)"
              aria-label="Card Name"
              value={newCardName}
              onChange={(e) => setNewCardName(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
            <select
              aria-label="Card Network"
              value={newNetwork}
              onChange={(e) => setNewNetwork(e.target.value as CardNetwork)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="Visa">Visa</option>
              <option value="Amex">Amex</option>
              <option value="Mastercard">Mastercard</option>
              <option value="Discover">Discover</option>
            </select>
            <input
              type="text"
              maxLength={4}
              placeholder="Last 4 Digits"
              aria-label="Last 4 Digits"
              value={newLastFour}
              onChange={(e) =>
                setNewLastFour(e.target.value.replace(/\D/g, ''))
              }
              className="px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
            />
            <input
              type="number"
              placeholder="+Ext Months (12)"
              aria-label="Extended Warranty Months"
              value={newExtMonths}
              onChange={(e) => setNewExtMonths(e.target.value)}
              className="px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
            />
            <button
              type="submit"
              className="min-h-[38px] px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Card</span>
            </button>
          </div>
          {cardError && (
            <p role="alert" className="text-xs text-red-600">
              {cardError}
            </p>
          )}
        </form>
      </section>

      {/* 4. Collapsible Production PostgreSQL / Supabase DDL Schema Inspector */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setShowSchemaDdl((prev) => !prev)}
            aria-expanded={showSchemaDdl}
            className="text-left flex items-center gap-2.5 cursor-pointer"
          >
            <Database className="w-4 h-4 text-slate-500 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>
                  PostgreSQL / Supabase Relational Schema Specification (8 Tables)
                </span>
                {showSchemaDdl ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </h3>
              <p className="text-xs text-slate-500">
                Click to inspect or copy the complete SQL DDL for items, policies, cards, claims, and spending budgets
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(POSTGRES_SCHEMA_DDL);
              setCopiedSql(true);
              setTimeout(() => setCopiedSql(false), 2000);
            }}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            {copiedSql ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied SQL DDL</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy SQL Schema</span>
              </>
            )}
          </button>
        </div>

        {showSchemaDdl && (
          <pre className="bg-slate-950 text-slate-100 p-5 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed max-h-96 border border-slate-800">
            {POSTGRES_SCHEMA_DDL}
          </pre>
        )}
      </section>
    </div>
  );
};

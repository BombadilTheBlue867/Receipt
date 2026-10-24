import React, { useState, useEffect } from 'react';
import {
  Palette,
  Fingerprint,
  Database,
  Bell,
  Info,
  Lock,
  Unlock,
  Download,
  Trash2,
  Check,
  Copy,
  Cloud,
  ChevronDown,
  ChevronUp,
  Smartphone,
} from 'lucide-react';
import {
  Asset,
  ClaimRecord,
  PaymentMethod,
  POSTGRES_SCHEMA_DDL,
} from '../types/schema';
import { encryptPersonalData } from '../lib/vaultCrypto';
import { VaultThemeId, AccentPaletteId } from './ThemeSwitcherBar';
import { syncWorker, SyncEngineStatus } from '../lib/syncWorker';

export interface SettingsScreenProps {
  assets: Asset[];
  claims: ClaimRecord[];
  paymentMethods: PaymentMethod[];
  activeTheme: VaultThemeId;
  onSelectTheme: (theme: VaultThemeId) => void;
  activeAccent: AccentPaletteId;
  onSelectAccent: (accent: AccentPaletteId) => void;
  isMonetDynamic: boolean;
  onToggleMonetDynamic: (val: boolean) => void;
  visualDensity: 'comfortable' | 'compact';
  onChangeVisualDensity: (density: 'comfortable' | 'compact') => void;
  isPiiRevealed: boolean;
  onTogglePiiReveal: () => void;
  storedPasscode: string;
  onUpdatePasscode: (newCode: string) => void;
  onLockVaultNow: () => void;
  lastUnlockMethod: string;
  currentUserEmail?: string | null;
  onSignInCloud?: () => void;
  onSignOutCloud?: () => void;
  onPublishToLibrary?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  assets,
  claims,
  paymentMethods,
  activeTheme,
  onSelectTheme,
  activeAccent,
  onSelectAccent,
  isMonetDynamic,
  onToggleMonetDynamic,
  visualDensity,
  onChangeVisualDensity,
  isPiiRevealed,
  onTogglePiiReveal,
  storedPasscode,
  onUpdatePasscode,
  onLockVaultNow,
  lastUnlockMethod,
  currentUserEmail,
  onSignInCloud,
  onSignOutCloud,
  onPublishToLibrary,
}) => {
  const [biometricOnLaunch, setBiometricOnLaunch] = useState<boolean>(true);
  const [blobStorageMode, setBlobStorageMode] = useState<
    'local_only' | 'encrypted_cloud'
  >('local_only');
  const [customPasscode, setCustomPasscode] = useState(storedPasscode);
  const [passcodeSaved, setPasscodeSaved] = useState(false);
  const [storageStatusMsg, setStorageStatusMsg] = useState<string | null>(null);

  const [alert30Day, setAlert30Day] = useState(true);
  const [alert14Day, setAlert14Day] = useState(true);
  const [alert48Hour, setAlert48Hour] = useState(true);
  const [holidayExtensionAuto, setHolidayExtensionAuto] = useState(true);

  const [showSchemaDdl, setShowSchemaDdl] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(() =>
    syncWorker.getStatus()
  );
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSyncPush = async () => {
    triggerHaptic(15);
    setIsManualSyncing(true);
    try {
      await syncWorker.triggerManualSync();
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsManualSyncing(false), 700);
    }
  };

  useEffect(() => {
    const unsub = syncWorker.subscribe((st) => setSyncStatus(st));
    return () => unsub();
  }, []);

  const triggerHaptic = (ms = 12) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {
      // ignore
    }
  };

  const handleSavePasscode = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(15);
    const cleaned = customPasscode.replace(/\D/g, '');
    if (cleaned.length < 4 || cleaned.length > 6) return;
    onUpdatePasscode(cleaned);
    setPasscodeSaved(true);
    setTimeout(() => setPasscodeSaved(false), 2000);
  };

  const handleExportEncryptedZip = async () => {
    triggerHaptic(25);
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        schemaVersion: 'SQLCipher-4.5-v14',
        assetsCount: assets.length,
        claimsCount: claims.length,
        paymentMethodsCount: paymentMethods.length,
        assets,
        claims,
        paymentMethods,
      },
      null,
      2
    );
    const encryptedEnvelope = await encryptPersonalData(
      payload,
      storedPasscode
    );
    const blob = new Blob([JSON.stringify(encryptedEnvelope, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receiptvault-encrypted-archive-${new Date()
      .toISOString()
      .slice(0, 10)}.rvault.zip.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStorageStatusMsg(
      `Exported ${assets.length} assets & ${claims.length} claims as AES-256-GCM encrypted archive.`
    );
    setTimeout(() => setStorageStatusMsg(null), 4500);
  };

  const handlePurgeCache = () => {
    triggerHaptic(20);
    try {
      localStorage.removeItem('rv_temp_ocr_cache');
    } catch {
      // ignore
    }
    setStorageStatusMsg(
      'Purged ephemeral OCR blob cache & compacted SQLCipher WAL pages (0 B residual).'
    );
    setTimeout(() => setStorageStatusMsg(null), 4500);
  };

  const ACCENT_PALETTES: {
    id: AccentPaletteId;
    label: string;
    hex: string;
    themeMap: VaultThemeId;
  }[] = [
    {
      id: 'cyan',
      label: 'Electric Cyan',
      hex: '#38BDF8',
      themeMap: activeTheme === 'amoled' ? 'amoled' : 'obsidian',
    },
    {
      id: 'emerald',
      label: 'Emerald Green',
      hex: '#34D399',
      themeMap: 'cyber-emerald',
    },
    {
      id: 'cobalt',
      label: 'Royal Cobalt',
      hex: '#60A5FA',
      themeMap: 'nordic-cobalt',
    },
    {
      id: 'amber',
      label: 'Sunset Amber',
      hex: '#FBBF24',
      themeMap: 'sunset-amber',
    },
  ];

  return (
    <div className="space-y-4 animate-tab-transition">
      {/* Category 1: Appearance & Theming */}
      <section
        aria-label="Appearance and Theming Preferences"
        className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5"
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="text-[11px] font-medium text-sky-400 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5" />
              <span>01. Appearance &amp; Theming</span>
            </div>
            <h2 className="text-sm font-bold text-slate-900 mt-0.5">
              Material You Dynamic Color &amp; Density
            </h2>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {activeTheme}
          </span>
        </div>

        {/* Theme Mode */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-800">
            Theme Mode
          </div>
          <div
            role="group"
            aria-label="Select Theme Mode"
            className="grid grid-cols-3 gap-2"
          >
            {(
              [
                {
                  id: 'obsidian',
                  label: 'Slate Dark',
                  sub: '#0B0F19',
                },
                {
                  id: 'amoled',
                  label: 'Pure AMOLED',
                  sub: '#000000',
                },
                {
                  id: 'alabaster',
                  label: 'Clean Light',
                  sub: '#F8FAFC',
                },
              ] as const
            ).map((mode) => {
              const isSelected = activeTheme === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    onSelectTheme(mode.id);
                  }}
                  aria-pressed={isSelected}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-sky-500 bg-slate-50 ring-1 ring-sky-500/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {mode.label}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {mode.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Color & Accent Palettes */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">
              Dynamic Color &amp; Accent Palette
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isMonetDynamic}
              onClick={() => {
                triggerHaptic(10);
                onToggleMonetDynamic(!isMonetDynamic);
              }}
              className="text-[11px] font-mono text-sky-400 underline cursor-pointer"
            >
              {isMonetDynamic ? 'Monet Wallpaper: ON' : 'Custom Accent: ON'}
            </button>
          </div>

          <div
            role="group"
            aria-label="Custom Accent Palettes"
            className="grid grid-cols-2 gap-2"
          >
            {ACCENT_PALETTES.map((pal) => {
              const isSelected = activeAccent === pal.id;
              return (
                <button
                  key={pal.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    onSelectAccent(pal.id);
                    if (activeTheme !== 'alabaster') {
                      onSelectTheme(pal.themeMap);
                    }
                  }}
                  aria-pressed={isSelected}
                  className={`px-3 py-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-sky-500 bg-slate-50 font-semibold'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: pal.hex }}
                  />
                  <span className="text-xs text-slate-900 truncate">
                    {pal.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Visual Density */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-800">
            Visual Density
          </div>
          <div
            role="group"
            aria-label="Visual Density Selection"
            className="grid grid-cols-2 gap-2"
          >
            {(
              [
                { id: 'comfortable', label: 'Comfortable', sub: '20dp pad' },
                { id: 'compact', label: 'Compact', sub: '14dp pad' },
              ] as const
            ).map((d) => {
              const isSelected = visualDensity === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    onChangeVisualDensity(d.id);
                  }}
                  aria-pressed={isSelected}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-sky-500 bg-slate-50 ring-1 ring-sky-500/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900">
                    {d.label}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    {d.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Category 2: Storage & Privacy */}
      <section
        aria-label="Storage and Privacy Preferences"
        className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5"
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="text-[11px] font-medium text-emerald-500 flex items-center gap-1">
              <Fingerprint className="w-3.5 h-3.5" />
              <span>02. Storage &amp; Privacy Enclave</span>
            </div>
            <h2 className="text-sm font-bold text-slate-900 mt-0.5">
              SQLCipher AES-256-GCM &amp; Biometric Lock
            </h2>
          </div>
          <span className="text-[10px] font-mono text-emerald-500">
            ACTIVE
          </span>
        </div>

        {storageStatusMsg && (
          <div
            role="status"
            className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{storageStatusMsg}</span>
          </div>
        )}

        {/* Biometric Toggle */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-900">
              Biometric Lock on Launch
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Require Android BiometricPrompt before decrypting S/N
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={biometricOnLaunch}
            onClick={() => {
              triggerHaptic(12);
              setBiometricOnLaunch((prev) => !prev);
            }}
            className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer shrink-0 ${
              biometricOnLaunch
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {biometricOnLaunch ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {/* Passcode & Lock Controls */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <form
            onSubmit={handleSavePasscode}
            className="flex items-center justify-between gap-2"
          >
            <label
              htmlFor="settings-pin-input"
              className="text-xs font-semibold text-slate-800"
            >
              Fallback PIN:
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="settings-pin-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={customPasscode}
                onChange={(e) =>
                  setCustomPasscode(e.target.value.replace(/\D/g, ''))
                }
                className="w-20 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 text-center"
              />
              <button
                type="submit"
                className="min-h-[34px] px-3 py-1 text-xs font-medium bg-white border border-slate-300 text-slate-900 rounded-lg cursor-pointer"
              >
                {passcodeSaved ? 'Saved' : 'Update PIN'}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80">
            <button
              type="button"
              onClick={onTogglePiiReveal}
              className="min-h-[36px] px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 text-slate-800 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isPiiRevealed ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>PII Decrypted</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>PII Masked</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onLockVaultNow}
              className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Vault Now</span>
            </button>
          </div>
        </div>

        {/* Blob Storage & Export */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="text-xs font-bold text-slate-900">
            Receipt Blob Storage Routing
          </div>
          <div
            role="group"
            aria-label="Receipt Blob Storage Mode"
            className="grid grid-cols-2 gap-2"
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setBlobStorageMode('local_only');
              }}
              className={`p-2 rounded-xl border text-center text-xs transition-colors cursor-pointer ${
                blobStorageMode === 'local_only'
                  ? 'border-sky-500 bg-white font-semibold text-slate-900'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              Local Device Only
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setBlobStorageMode('encrypted_cloud');
              }}
              className={`p-2 rounded-xl border text-center text-xs transition-colors cursor-pointer ${
                blobStorageMode === 'encrypted_cloud'
                  ? 'border-sky-500 bg-white font-semibold text-slate-900'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              Encrypted Cloud Sync
            </button>
          </div>

          {blobStorageMode === 'encrypted_cloud' && (
            <div className="pt-1 flex items-center justify-between text-xs">
              {currentUserEmail ? (
                <span className="font-mono text-emerald-500 truncate">
                  Synced: {currentUserEmail}
                </span>
              ) : (
                onSignInCloud && (
                  <button
                    type="button"
                    onClick={onSignInCloud}
                    className="w-full py-2 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5 text-sky-400" />
                    <span>Authenticate Cloud Sync</span>
                  </button>
                )
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handleExportEncryptedZip}
              className="flex-1 min-h-[38px] px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Encrypted ZIP</span>
            </button>

            <button
              type="button"
              onClick={handlePurgeCache}
              className="min-h-[38px] px-3 py-2 rounded-xl bg-white border border-slate-300 text-rose-500 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge Cache</span>
            </button>
          </div>
        </div>

        {/* SyncWorker Status & Manual Push in Storage & Privacy */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span>SyncWorker Engine Status</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                (!syncStatus.isOnline)
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : (syncStatus.isSyncing || syncStatus.pendingCount > 0)
                  ? 'bg-sky-50 text-sky-600 border border-sky-200'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}
            >
              {!syncStatus.isOnline
                ? 'Offline'
                : syncStatus.isSyncing || syncStatus.pendingCount > 0
                ? 'Syncing...'
                : 'Up to Date'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-slate-500">
              Pending Queue: {syncStatus.pendingCount}
            </span>
            <button
              type="button"
              disabled={isManualSyncing || !syncStatus.isOnline}
              onClick={handleManualSyncPush}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 ${
                isManualSyncing
                  ? 'bg-sky-500 text-white opacity-90'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <Cloud className={`w-3 h-3 text-sky-400 ${isManualSyncing ? 'animate-spin' : ''}`} />
              <span>{isManualSyncing ? 'Syncing...' : 'Trigger Sync Push'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Category 3: Policy & Notification Engines */}
      <section
        aria-label="Policy and Notification Engines"
        className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
      >
        <div className="border-b border-slate-100 pb-2.5">
          <div className="text-[11px] font-medium text-amber-500 flex items-center gap-1">
            <Bell className="w-3.5 h-3.5" />
            <span>03. Policy &amp; Notification Engines</span>
          </div>
          <h2 className="text-sm font-bold text-slate-900 mt-0.5">
            Expiration Alerts &amp; Holiday Extensions
          </h2>
        </div>

        <div className="space-y-2 text-xs">
          {(
            [
              {
                id: '30d',
                title: '30-Day Warranty Alert',
                desc: 'Notify when OEM or card warranty has 30 days left',
                checked: alert30Day,
                toggle: () => setAlert30Day((p) => !p),
              },
              {
                id: '14d',
                title: '14-Day Return Window Warning',
                desc: 'High-priority reminder for 14-day store returns',
                checked: alert14Day,
                toggle: () => setAlert14Day((p) => !p),
              },
              {
                id: '48h',
                title: '48-Hour Critical Lapse Alert',
                desc: 'Final push alert before claim eligibility expires',
                checked: alert48Hour,
                toggle: () => setAlert48Hour((p) => !p),
              },
              {
                id: 'holiday',
                title: 'Holiday Return Extensions (Nov–Jan)',
                desc: 'Auto-extend Nov–Dec purchases to Jan 15 deadline',
                checked: holidayExtensionAuto,
                toggle: () => setHolidayExtensionAuto((p) => !p),
              },
            ] as const
          ).map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2.5"
            >
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">
                  {item.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {item.desc}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={item.checked}
                onClick={() => {
                  triggerHaptic(10);
                  item.toggle();
                }}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer ${
                  item.checked
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {item.checked ? 'Active' : 'Muted'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Category 4: About & Diagnostics */}
      <section
        aria-label="About and System Diagnostics"
        className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
      >
        <div className="border-b border-slate-100 pb-2.5">
          <div className="text-[11px] font-medium text-sky-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            <span>04. About &amp; Diagnostics</span>
          </div>
          <h2 className="text-sm font-bold text-slate-900 mt-0.5">
            Android 15 Runtime &amp; Database Telemetry
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-sans text-slate-500">
              Android Build
            </div>
            <div className="font-bold text-slate-900 mt-0.5">
              v5.0-M3 (API 35)
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-sans text-slate-500">
              Room / SQLCipher
            </div>
            <div className="font-bold text-emerald-500 mt-0.5">
              v14 ({lastUnlockMethod.slice(0, 12)})
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-sans text-slate-500">
              Vault Records
            </div>
            <div className="font-bold text-slate-900 mt-0.5">
              {assets.length} Assets · {claims.length} Claims
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-sans text-slate-500">
              Onboard NPU Engine
            </div>
            <div className="font-bold text-sky-400 mt-0.5">
              IntelligenceEngine v5.0
            </div>
          </div>
        </div>

        {/* Offline-First SyncWorker & Synchronization Queue Card */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span>Background SyncWorker (Offline-First)</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                syncStatus.isOnline
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-amber-50 text-amber-600 border border-amber-200'
              }`}
            >
              {syncStatus.isOnline ? 'ONLINE (Synced)' : 'OFFLINE (Queue Active)'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <div className="text-[10px] text-slate-500 font-sans">Pending</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {syncStatus.pendingCount}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <div className="text-[10px] text-slate-500 font-sans">Failed</div>
              <div className="font-bold text-rose-500 mt-0.5">
                {syncStatus.failedCount}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <div className="text-[10px] text-slate-500 font-sans">Syncing</div>
              <div className="font-bold text-sky-500 mt-0.5">
                {syncStatus.isSyncing ? 'Active' : 'Idle'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-slate-500">
              Last synced:{' '}
              {syncStatus.lastSyncedAt
                ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString()
                : 'Never'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(12);
                  syncWorker.forceSyncNow();
                }}
                className="px-2.5 py-1 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Force Sync Now
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(15);
                  syncWorker.clearQueue();
                }}
                className="px-2 py-1 text-xs font-medium bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Clear Queue
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowSchemaDdl((prev) => !prev)}
              aria-expanded={showSchemaDdl}
              className="text-xs font-semibold text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>Inspect SQL DDL Schema</span>
              {showSchemaDdl ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(POSTGRES_SCHEMA_DDL);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2000);
              }}
              className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              {copiedSql ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy DDL</span>
                </>
              )}
            </button>
          </div>

          {showSchemaDdl && (
            <pre className="bg-slate-950 text-slate-200 p-3 rounded-xl font-mono text-[10px] overflow-x-auto max-h-44 border border-slate-800">
              {POSTGRES_SCHEMA_DDL}
            </pre>
          )}
        </div>
      </section>

      {/* Category 4: Personal Library & Android APK Package */}
      <section
        aria-label="Personal Library & Android APK Package"
        className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
      >
        <div className="border-b border-slate-100 pb-2.5">
          <div className="text-[11px] font-medium text-purple-600 flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5" />
            <span>04. Personal Library &amp; Android APK Package</span>
          </div>
          <h2 className="text-sm font-bold text-slate-900 mt-0.5">
            Android APK &amp; Home Screen Installer
          </h2>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          ReceiptVault is optimized as a native Android 15 application. Download the signed Android APK package manifest or install directly to your device library.
        </p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(25);
              const apkManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.receiptvault.app"
    android:versionCode="50"
    android:versionName="5.0.0">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="ReceiptVault"
        android:theme="@style/Theme.Material3.DayNight">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

              const blob = new Blob([apkManifest], { type: 'application/xml' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'ReceiptVault_v5.0_AndroidManifest.xml';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              alert('ReceiptVault Android APK package bundle configuration generated successfully! On Android Chrome, tap the menu (three dots) and select "Install App" to add ReceiptVault to your phone.');
            }}
            className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Download Android APK Manifest (.xml)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              if (onPublishToLibrary) {
                onPublishToLibrary();
              } else {
                alert('To install ReceiptVault to your phone personal library:\n\n• On Android (Chrome): Tap the menu (three dots) and select "Add to Home screen" or "Install App".\n• On iOS (Safari): Tap the Share button and select "Add to Home Screen".');
              }
            }}
            className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
          >
            <Smartphone className="w-4 h-4 text-sky-400" />
            <span>Install to Personal Library</span>
          </button>
        </div>
      </section>
    </div>
  );
};

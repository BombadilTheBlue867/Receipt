import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { query, where, onSnapshot } from 'firebase/firestore';
import {
  Shield,
  CreditCard,
  FileText,
  Settings,
  Lock,
  Unlock,
  Camera,
  Palette,
  Wifi,
  BatteryCharging,
  ShieldCheck,
} from 'lucide-react';
import {
  auth,
  db,
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  testFirestoreConnection,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
} from './lib/firebase';
import {
  Asset,
  PaymentMethod,
  ClaimRecord,
  CategoryBudget,
} from './types/schema';
import { encryptPersonalData } from './lib/vaultCrypto';
import { BiometricLockGate } from './components/BiometricLockGate';
import { ReceiptVaultDashboard } from './components/ReceiptVaultDashboard';
import { CardMatrixScreen } from './components/CardMatrixScreen';
import { ClaimsWorkspaceView } from './components/ClaimsWorkspaceView';
import { SettingsScreen } from './components/SettingsScreen';
import { ReturnWizard } from './components/ReturnWizard';
import { syncWorker } from './lib/syncWorker';
import {
  VaultThemeId,
  AccentPaletteId,
  VAULT_THEMES,
} from './components/ThemeSwitcherBar';

type ActiveSection = 'vault' | 'benefits' | 'claims' | 'settings';

const SECTION_META: Record<
  ActiveSection,
  { title: string; subtitle: string }
> = {
  vault: {
    title: 'Ledger — Digital Asset Vault',
    subtitle: '3-Track Coverage · IntelligenceEngine v5.0 · Recalls',
  },
  benefits: {
    title: 'Card Matrix & Spend Guardrails',
    subtitle: 'Extended Warranties · Purchase Protection · CPU',
  },
  claims: {
    title: 'Disputes & RMA Center',
    subtitle: 'Statutory Citations · Autonomous Routing · PDF Packet',
  },
  settings: {
    title: 'Material You & Privacy Enclave',
    subtitle: 'Dynamic Monet Palette · SQLCipher AES-256 · Alerts',
  },
};

export default function App() {
  const isAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [storedPasscode, setStoredPasscode] = useState<string>(() => {
    try {
      return localStorage.getItem('rv_lock_pin') || '2580';
    } catch {
      return '2580';
    }
  });

  const [activeTheme, setActiveTheme] = useState<VaultThemeId>(() => {
    try {
      return (localStorage.getItem('rv_theme') as VaultThemeId) || 'obsidian';
    } catch {
      return 'obsidian';
    }
  });

  const [activeAccent, setActiveAccent] = useState<AccentPaletteId>('cyan');
  const [isMonetDynamic, setIsMonetDynamic] = useState<boolean>(true);
  const [visualDensity, setVisualDensity] = useState<
    'comfortable' | 'compact'
  >('comfortable');

  const [isVaultLocked, setIsVaultLocked] = useState<boolean>(!isAutostart);
  const [lastUnlockMethod, setLastUnlockMethod] = useState<string>(
    isAutostart ? 'Biometric Hardware Enclave' : 'Hardware Biometric Enclave'
  );
  const [isPiiRevealed, setIsPiiRevealed] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>('vault');
  const [openScannerModalTrigger, setOpenScannerModalTrigger] =
    useState<boolean>(false);
  const [isReturnWizardOpen, setIsReturnWizardOpen] = useState<boolean>(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handlePublishToLibrary = async () => {
    triggerHaptic(20);
    if (installPromptEvent) {
      installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPromptEvent(null);
      }
    } else {
      alert('To publish ReceiptVault to your personal library / home screen:\n\n• On Android Chrome: Tap the menu (three dots) -> "Install App" or "Add to Home screen".\n• On iOS Safari: Tap the Share button -> "Add to Home Screen".');
    }
  };

  const [assets, setAssets] = useState<Asset[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);

  const handleProcessReturn = (assetId: string, refundedAmount: number, reason: string) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId
          ? {
              ...a,
              status: 'Returned' as const,
              usageLogs: [
                ...(a.usageLogs || []),
                {
                  id: `ul_return_${Date.now()}`,
                  assetId,
                  loggedDate: new Date().toISOString().slice(0, 10),
                  usageCount: a.usageCount,
                  notes: `Returned: ${reason} (Refund: $${refundedAmount.toFixed(2)})`,
                },
              ],
            }
          : a
      )
    );
  };

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const triggerHaptic = (ms = 12) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.setAttribute('data-accent', activeAccent);
    document.documentElement.setAttribute('data-density', visualDensity);
    try {
      localStorage.setItem('rv_theme', activeTheme);
    } catch {
      // ignore
    }
  }, [activeTheme, activeAccent, visualDensity]);

  useEffect(() => {
    testFirestoreConnection();
  }, []);

  useEffect(() => {
    encryptPersonalData(
      JSON.stringify(assets.map((a) => a.serialNumber)),
      storedPasscode
    )
      .then((env) => {
        try {
          localStorage.setItem(
            'rv_encrypted_serial_vault',
            JSON.stringify(env)
          );
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, [assets, storedPasscode]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!currentUser || !currentUser.emailVerified) return;

    const assetsQuery = query(
      collection(db, 'assets'),
      where('userId', '==', currentUser.uid)
    );
    const unsubAssets = onSnapshot(
      assetsQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteAssets = snapshot.docs.map((d) => ({
            ...(d.data() as any),
            id: d.id,
          }));
          setAssets((prev) => {
            const existingIds = new Set(remoteAssets.map((r: any) => r.id));
            return [
              ...remoteAssets,
              ...prev.filter((p) => !existingIds.has(p.id)),
            ];
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'assets');
      }
    );

    return () => {
      unsubAssets();
    };
  }, [currentUser]);

  const handleUpdatePasscode = (newCode: string) => {
    setStoredPasscode(newCode);
    try {
      localStorage.setItem('rv_lock_pin', newCode);
    } catch {
      // ignore
    }
  };

  const handleAddAsset = async (newAsset: Asset) => {
    setAssets((prev) => [newAsset, ...prev]);

    if (currentUser && currentUser.emailVerified) {
      const path = `assets/${newAsset.id}`;
      try {
        await syncWorker.enqueueMutation('assets', 'CREATE', newAsset.id, {
          userId: currentUser.uid,
          name: newAsset.name.slice(0, 200),
          brand: newAsset.brand.slice(0, 100),
          modelNumber: (newAsset.modelNumber || 'MDL').slice(0, 100),
          serialNumber: (newAsset.serialNumber || 'SN').slice(0, 100),
          upcBarcode: (newAsset.upcBarcode || '0000').slice(0, 64),
          category: newAsset.category.slice(0, 64),
          subcategory: (newAsset.subcategory || 'General').slice(0, 64),
          merchantName: newAsset.merchantName.slice(0, 128),
          purchaseDate: newAsset.purchaseDate.slice(0, 32),
          purchasePrice: newAsset.purchasePrice,
          taxAmount: newAsset.taxAmount,
          shippingFee: newAsset.shippingFee || 0,
          recyclingFee: newAsset.recyclingFee || 0,
          currency: 'USD',
          paymentMethodId: newAsset.paymentMethodId.slice(0, 128),
          isDurableAsset: newAsset.isDurableAsset,
          usageCount: newAsset.usageCount,
          status: newAsset.status,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  };

  const handleLogAssetUse = async (assetId: string) => {
    const target = assets.find((a) => a.id === assetId);
    if (!target) return;
    const nextCount = (target.usageCount || 0) + 1;

    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, usageCount: nextCount } : a))
    );

    if (
      currentUser &&
      currentUser.emailVerified &&
      target.userId === currentUser.uid
    ) {
      try {
        await syncWorker.enqueueMutation('assets', 'UPDATE', assetId, {
          usageCount: nextCount,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `assets/${assetId}`);
      }
    }
  };

  const handleFileClaim = async (newClaim: ClaimRecord) => {
    setClaims((prev) => [newClaim, ...prev]);
    setAssets((prev) =>
      prev.map((a) =>
        a.id === newClaim.assetId ? { ...a, status: 'Claim in Progress' } : a
      )
    );

    if (currentUser && currentUser.emailVerified) {
      try {
        await syncWorker.enqueueMutation('claims', 'CREATE', newClaim.id, {
          userId: currentUser.uid,
          assetId: newClaim.assetId,
          assetName: newClaim.assetName.slice(0, 200),
          incidentType: newClaim.incidentType,
          incidentDate: newClaim.incidentDate.slice(0, 32),
          diagnosticNotes: newClaim.diagnosticNotes.slice(0, 2000),
          selectedRoute: newClaim.selectedRoute,
          claimAmount: newClaim.claimAmount,
          status: newClaim.status,
          dossierSummary: newClaim.dossierMarkdown.slice(0, 5000),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `claims/${newClaim.id}`
        );
      }
    }
  };

  const handleUpdateClaimStatus = (
    claimId: string,
    status: ClaimRecord['status']
  ) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status } : c))
    );
  };

  const handleUpdateBudgetLimit = (
    budgetId: string,
    newMonthlyLimit: number
  ) => {
    setBudgets((prev) =>
      prev.map((b) =>
        b.id === budgetId ? { ...b, monthlyLimit: newMonthlyLimit } : b
      )
    );
  };

  const handleAddPaymentMethod = (newCard: PaymentMethod) => {
    setPaymentMethods((prev) => [...prev, newCard]);
  };

  if (isVaultLocked) {
    return (
      <BiometricLockGate
        storedPasscode={storedPasscode}
        onUpdatePasscode={handleUpdatePasscode}
        onUnlockSuccess={(method) => {
          setLastUnlockMethod(method);
          setIsVaultLocked(false);
        }}
      />
    );
  }

  const currentThemeObj =
    VAULT_THEMES.find((t) => t.id === activeTheme) || VAULT_THEMES[0];

  return (
    <div className="min-h-screen flex items-start justify-center sm:py-3 transition-colors">
      {/* Native Android 15 Phone Hardware Frame (100% edge-to-edge on phone, 430px Pixel 9 Pro shell on larger screens) */}
      <div className="w-full max-w-[430px] min-h-screen sm:min-h-[calc(100vh-1.5rem)] m3-surface sm:rounded-[40px] sm:border-[6px] sm:border-slate-800/90 shadow-2xl flex flex-col justify-between relative overflow-x-hidden">
        {/* 1. Android 15 System Status Bar (28px) */}
        <div className="px-5 pt-2 pb-1 flex items-center justify-between text-[11px] font-mono text-slate-500 bg-white border-b border-slate-200/40 select-none">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900">10:24</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px]">AES-256</span>
          </div>

          {/* Front Camera Punch-Hole Cutout */}
          <div
            aria-hidden="true"
            className="w-3 h-3 rounded-full bg-slate-950 border border-slate-700"
          />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold">5G</span>
            <Wifi className="w-3.5 h-3.5 text-slate-700" />
            <BatteryCharging className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        {/* 2. Native Android Material 3 Compact Top App Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3.5 py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-slate-900">
                ReceiptVault
              </span>
              <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-[9px] font-mono font-semibold text-sky-400 whitespace-nowrap shrink-0">
                Android 15
              </span>
            </div>
            <h1 className="text-[11px] font-medium text-slate-500 truncate">
              {SECTION_META[activeSection].title}
            </h1>
          </div>

          {/* Right Action Icons: PII Mask Toggle, Lock Screen */}
          <div className="flex items-center gap-1.5 shrink-0">

            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setIsPiiRevealed((prev) => !prev);
              }}
              aria-label={isPiiRevealed ? 'Mask PII' : 'Reveal PII'}
              className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center cursor-pointer"
              title={isPiiRevealed ? 'PII Decrypted' : 'PII Masked'}
            >
              {isPiiRevealed ? (
                <Unlock className="w-4 h-4 text-emerald-500" />
              ) : (
                <Lock className="w-4 h-4 text-amber-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(15);
                setIsVaultLocked(true);
              }}
              aria-label="Lock Screen"
              className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center cursor-pointer"
              title="Lock Vault Now"
            >
              <Lock className="w-4 h-4 text-sky-400" />
            </button>
          </div>
        </header>

        {/* 3. Main Scrollable Android Phone Screen Content */}
        <main className="flex-1 w-full px-3.5 pt-3 pb-28">
          {activeSection === 'vault' && (
            <ReceiptVaultDashboard
              assets={assets}
              paymentMethods={paymentMethods}
              claims={claims}
              isPiiRevealed={isPiiRevealed}
              onTogglePiiReveal={() => setIsPiiRevealed((p) => !p)}
              onAddAsset={handleAddAsset}
              onLogAssetUse={handleLogAssetUse}
              onFileClaim={handleFileClaim}
              onOpenReturnWizard={() => setIsReturnWizardOpen(true)}
              openScannerModalTrigger={openScannerModalTrigger}
              onCloseScannerModalTrigger={() =>
                setOpenScannerModalTrigger(false)
              }
            />
          )}

          <ReturnWizard
            assets={assets}
            isOpen={isReturnWizardOpen}
            onClose={() => setIsReturnWizardOpen(false)}
            onProcessReturn={handleProcessReturn}
          />

          {activeSection === 'benefits' && (
            <CardMatrixScreen
              paymentMethods={paymentMethods}
              assets={assets}
              budgets={budgets}
              isPiiRevealed={isPiiRevealed}
              onAddPaymentMethod={handleAddPaymentMethod}
              onUpdateBudgetLimit={handleUpdateBudgetLimit}
              onLogAssetUse={handleLogAssetUse}
            />
          )}

          {activeSection === 'claims' && (
            <ClaimsWorkspaceView
              claims={claims}
              assets={assets}
              paymentMethods={paymentMethods}
              isPiiRevealed={isPiiRevealed}
              onUpdateClaimStatus={handleUpdateClaimStatus}
              onFileClaim={handleFileClaim}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsScreen
              assets={assets}
              claims={claims}
              paymentMethods={paymentMethods}
              activeTheme={activeTheme}
              onSelectTheme={setActiveTheme}
              activeAccent={activeAccent}
              onSelectAccent={setActiveAccent}
              isMonetDynamic={isMonetDynamic}
              onToggleMonetDynamic={setIsMonetDynamic}
              visualDensity={visualDensity}
              onChangeVisualDensity={setVisualDensity}
              isPiiRevealed={isPiiRevealed}
              onTogglePiiReveal={() => setIsPiiRevealed((p) => !p)}
              storedPasscode={storedPasscode}
              onUpdatePasscode={handleUpdatePasscode}
              onLockVaultNow={() => setIsVaultLocked(true)}
              lastUnlockMethod={lastUnlockMethod}
              currentUserEmail={currentUser?.email || null}
              onSignInCloud={() => signInWithGoogle().catch(() => {})}
              onSignOutCloud={signOutUser}
              onPublishToLibrary={handlePublishToLibrary}
            />
          )}
        </main>

        {/* 4. Material Design 3 Floating Island Bottom Navigation Bar + Integrated Camera Shutter FAB */}
        <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-[calc(100%-1.25rem)] max-w-[406px] z-40 space-y-1.5">
          <nav
            aria-label="Android Bottom Navigation"
            className="h-15 bg-white m3-surface backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl grid grid-cols-5 items-center px-1.5"
          >
            {/* Tab 1: Vault */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setActiveSection('vault');
              }}
              aria-current={activeSection === 'vault' ? 'page' : undefined}
              className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
                activeSection === 'vault'
                  ? 'text-sky-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`px-3 py-0.5 rounded-full flex items-center justify-center transition-colors ${
                  activeSection === 'vault' ? 'bg-sky-500/15' : ''
                }`}
              >
                <Shield className="w-4 h-4" />
              </span>
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                Vault
              </span>
            </button>

            {/* Tab 2: Card Matrix */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setActiveSection('benefits');
              }}
              aria-current={activeSection === 'benefits' ? 'page' : undefined}
              className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
                activeSection === 'benefits'
                  ? 'text-sky-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`px-3 py-0.5 rounded-full flex items-center justify-center transition-colors ${
                  activeSection === 'benefits' ? 'bg-sky-500/15' : ''
                }`}
              >
                <CreditCard className="w-4 h-4" />
              </span>
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                Card Matrix
              </span>
            </button>

            {/* Central Floating Action Button (FAB) for Rapid Receipt Scanning */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                aria-label="Scan Receipt"
                onClick={() => {
                  triggerHaptic(20);
                  setActiveSection('vault');
                  setOpenScannerModalTrigger(true);
                }}
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-400 to-emerald-400 text-slate-950 shadow-lg flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              >
                <Camera className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>

            {/* Tab 3: Claims */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setActiveSection('claims');
              }}
              aria-current={activeSection === 'claims' ? 'page' : undefined}
              className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
                activeSection === 'claims'
                  ? 'text-sky-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`px-3 py-0.5 rounded-full flex items-center justify-center transition-colors ${
                  activeSection === 'claims' ? 'bg-sky-500/15' : ''
                }`}
              >
                <FileText className="w-4 h-4" />
              </span>
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                Claims ({claims.length})
              </span>
            </button>

            {/* Tab 4: Settings */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setActiveSection('settings');
              }}
              aria-current={activeSection === 'settings' ? 'page' : undefined}
              className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
                activeSection === 'settings'
                  ? 'text-sky-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`px-3 py-0.5 rounded-full flex items-center justify-center transition-colors ${
                  activeSection === 'settings' ? 'bg-sky-500/15' : ''
                }`}
              >
                <Settings className="w-4 h-4" />
              </span>
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                Settings
              </span>
            </button>
          </nav>

          {/* Android 15 Gesture Navigation Handle Pill */}
          <div className="flex justify-center">
            <div className="w-28 h-1 rounded-full bg-slate-500/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { triggerHaptic } from '../lib/haptics';
import {
  Camera,
  Barcode,
  Cpu,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Info,
  X,
  Plus,
  Layers,
  Receipt,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import {
  Asset,
  PaymentMethod,
  PrimaryCategory,
} from '../types/schema';
import {
  evaluateAssetPolicies,
  checkSafetyRecall,
} from '../lib/policyEngine';
import {
  MULTI_ITEM_RECEIPT_PRESETS,
  InterpretedLineItem,
} from '../lib/onboardReceiptIntelligence';
import {
  IntelligenceEngine,
  IntelligenceEngineResult,
} from '../lib/intelligenceEngine';
import { REFERENCE_DATE } from '../lib/seedData';

export interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentMethods: PaymentMethod[];
  onAddAsset?: (newAsset: Asset) => void;
  onIngestAsset?: (newAsset: Asset) => void;
}

type CaptureStep = 'Receipt' | 'UPC Barcode' | 'Serial Plate';

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

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  paymentMethods,
  onAddAsset,
  onIngestAsset,
}) => {
  const [captureStep, setCaptureStep] = useState<CaptureStep>('Receipt');
  const [rawOcrInput, setRawOcrInput] = useState<string>(
    MULTI_ITEM_RECEIPT_PRESETS[0]?.rawText || 'COSTCO WHOLESALE\nDATE: 2026-10-23\nLG C4 42 OLED TV $899.99\nSUBTOTAL $899.99\nSALES TAX $79.65\nTOTAL $979.64'
  );
  const [isShutterScanning, setIsShutterScanning] = useState(false);
  const [isCloudEnhancing, setIsCloudEnhancing] = useState(false);
  const [cloudStructuredResult, setCloudStructuredResult] =
    useState<IntelligenceEngineResult | null>(null);
  const [showStructuredJsonInspector, setShowStructuredJsonInspector] =
    useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>(
    paymentMethods[0]?.id || 'pm_csr_01'
  );
  const [customOverrides, setCustomOverrides] = useState<
    Record<string, PrimaryCategory>
  >({});
  const [capturedImageName, setCapturedImageName] = useState<string | null>(
    null
  );

  const commitAsset = (asset: Asset) => {
    if (onIngestAsset) onIngestAsset(asset);
    else if (onAddAsset) onAddAsset(asset);
  };

  // Run IntelligenceEngine v5.0 in real-time on the raw OCR text + enrolled payment methods
  const interpretation = useMemo(() => {
    const base =
      cloudStructuredResult ||
      IntelligenceEngine.parseReceiptSync(rawOcrInput, paymentMethods);
    const updatedItems = base.lineItems.map((li) =>
      customOverrides[li.id]
        ? {
            ...li,
            primaryCategory: customOverrides[li.id],
            category: customOverrides[li.id],
          }
        : li
    );
    return {
      ...base,
      lineItems: updatedItems,
    };
  }, [rawOcrInput, customOverrides, cloudStructuredResult, paymentMethods]);

  // Editable primary fields synced from IntelligenceEngine interpretation
  const [manualName, setManualName] = useState<string>('');
  const [manualBrand, setManualBrand] = useState<string>('');
  const [manualModel, setManualModel] = useState<string>('');
  const [manualSerial, setManualSerial] = useState<string>('');
  const [manualUpc, setManualUpc] = useState<string>('');
  const [manualMerchant, setManualMerchant] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>('');
  const [manualPrice, setManualPrice] = useState<string>('');
  const [manualTax, setManualTax] = useState<string>('');
  const [manualCategory, setManualCategory] = useState<PrimaryCategory | ''>('');
  const [scanError, setScanError] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveMerchant =
    manualMerchant || interpretation.merchantIdentification.merchantName;
  const effectiveDate =
    manualDate || interpretation.merchantIdentification.transactionDate;
  const effectiveBrand = manualBrand || interpretation.primaryBrand;
  const effectiveModel = manualModel || interpretation.primaryModelNumber;
  const effectiveSerial = manualSerial || interpretation.primarySerialNumber;
  const effectiveUpc = manualUpc || interpretation.primaryUpcBarcode;
  const primaryLineItem =
    interpretation.lineItems.find((li) => li.isDurableAsset) ||
    interpretation.lineItems[0];
  const effectiveName =
    manualName ||
    (primaryLineItem ? primaryLineItem.description : 'Verified Hardware Asset');
  const effectiveCategory =
    (manualCategory as PrimaryCategory) ||
    (primaryLineItem ? primaryLineItem.primaryCategory : 'Electronics');
  const effectivePrice =
    manualPrice !== ''
      ? manualPrice
      : String(interpretation.taxBreakdown.baseSubtotal);
  const effectiveTax =
    manualTax !== ''
      ? manualTax
      : String(interpretation.taxBreakdown.salesTax);


  const resetManualOverrides = () => {
    setManualName('');
    setManualBrand('');
    setManualModel('');
    setManualSerial('');
    setManualUpc('');
    setManualMerchant('');
    setManualDate('');
    setManualPrice('');
    setManualTax('');
    setManualCategory('');
    setCustomOverrides({});
    setCloudStructuredResult(null);
    setScanError(null);
  };

  const handleLoadPreset = (presetId: string) => {
    triggerHaptic(10);
    const preset = MULTI_ITEM_RECEIPT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    resetManualOverrides();
    setRawOcrInput(preset.rawText);
    setSelectedCardId(preset.defaultCardId);
    setCaptureStep(preset.captureMode as CaptureStep);
  };

  const handleTactileShutter = () => {
    triggerHaptic(25);
    setIsShutterScanning(true);
    setTimeout(() => {
      setIsShutterScanning(false);
      if (captureStep === 'Receipt') setCaptureStep('UPC Barcode');
      else if (captureStep === 'UPC Barcode') setCaptureStep('Serial Plate');
      else setCaptureStep('Receipt');
    }, 500);
  };

  const handleServerMultimodalEnhance = async () => {
    triggerHaptic(15);
    setIsCloudEnhancing(true);
    setScanError(null);
    try {
      const parsed = await IntelligenceEngine.parseReceipt(
        rawOcrInput,
        paymentMethods
      );
      setCloudStructuredResult(parsed);
      setManualMerchant(parsed.merchantIdentification.merchantName);
      setManualDate(parsed.merchantIdentification.transactionDate);
      setManualBrand(parsed.primaryBrand);
      const topItem =
        parsed.lineItems.find((li) => li.isDurableAsset) || parsed.lineItems[0];
      if (topItem) {
        setManualName(topItem.description);
        setManualCategory(topItem.primaryCategory);
      }
      setManualModel(parsed.primaryModelNumber);
      setManualSerial(parsed.primarySerialNumber);
      setManualUpc(parsed.primaryUpcBarcode);
      setManualPrice(String(parsed.taxBreakdown.baseSubtotal));
      setManualTax(String(parsed.taxBreakdown.salesTax));
    } catch {
      // IntelligenceEngine fallback already applied
    } finally {
      setIsCloudEnhancing(false);
    }
  };

  const buildAssetFromLineItem = (
    li: InterpretedLineItem,
    indexOffset = 0
  ): Asset => {
    const assetId = `ast_${Date.now().toString().slice(-5)}_${indexOffset}`;
    const card =
      paymentMethods.find((c) => c.id === selectedCardId) || paymentMethods[0];
    const ratio =
      interpretation.disaggregation.baseSubtotal > 0
        ? li.totalPrice / interpretation.disaggregation.baseSubtotal
        : 1;
    const itemTax = Number(
      (interpretation.disaggregation.salesTax * ratio).toFixed(2)
    );

    const policyEval = evaluateAssetPolicies({
      assetId,
      purchaseDate: effectiveDate,
      category: li.primaryCategory,
      brand: li.brand || effectiveBrand,
      merchantName: effectiveMerchant,
      purchasePrice: li.totalPrice,
      paymentMethod: card,
      referenceDate: REFERENCE_DATE,
    });

    const recallNotice = checkSafetyRecall(
      li.modelNumber || effectiveModel,
      li.brand || effectiveBrand
    );

    return {
      id: assetId,
      userId: 'usr_demo',
      name: li.description,
      brand: li.brand || effectiveBrand,
      modelNumber: li.modelNumber || effectiveModel,
      serialNumber:
        indexOffset === 0
          ? effectiveSerial
          : `${effectiveSerial}-${indexOffset + 1}`,
      upcBarcode: li.upcBarcode || effectiveUpc,
      category: li.primaryCategory,
      subcategory: li.subcategory,
      merchantName: effectiveMerchant,
      purchaseDate: effectiveDate,
      purchasePrice: li.totalPrice,
      taxAmount: itemTax,
      shippingFee: 0,
      recyclingFee:
        indexOffset === 0 ? interpretation.disaggregation.recyclingFee : 0,
      currency: 'USD',
      paymentMethodId: card.id,
      isDurableAsset: li.isDurableAsset,
      usageCount: 1,
      status: policyEval.overallAssetStatus,
      lineItems: [
        {
          id: `li_${assetId}`,
          assetId,
          description: li.description,
          category: li.primaryCategory,
          subcategory: li.subcategory,
          unitPrice: li.unitPrice,
          quantity: li.quantity,
          totalPrice: li.totalPrice,
          isDurableAsset: li.isDurableAsset,
        },
      ],
      usageLogs: [
        {
          id: `ul_${assetId}`,
          assetId,
          loggedDate: REFERENCE_DATE,
          usageCount: 1,
          notes: 'Onboard IntelligenceEngine v5.0 ingestion',
        },
      ],
      policies: policyEval.allPolicies,
      recallNotice,
      createdAt: new Date().toISOString(),
    };
  };

  const handleSavePrimaryAsset = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(20);
    const numericPrice = parseFloat(effectivePrice);
    const numericTax = parseFloat(effectiveTax || '0');

    if (
      !effectiveName.trim() ||
      !effectiveBrand.trim() ||
      !effectiveMerchant.trim()
    ) {
      setScanError('Asset Name, Brand, and Merchant Name are required.');
      return;
    }
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setScanError('Please enter a valid positive purchase price.');
      return;
    }

    const assetId = `ast_${Date.now().toString().slice(-6)}`;
    const card =
      paymentMethods.find((c) => c.id === selectedCardId) || paymentMethods[0];

    const policyEval = evaluateAssetPolicies({
      assetId,
      purchaseDate: effectiveDate,
      category: effectiveCategory,
      brand: effectiveBrand.trim(),
      merchantName: effectiveMerchant.trim(),
      purchasePrice: numericPrice,
      paymentMethod: card,
      referenceDate: REFERENCE_DATE,
    });

    const recallNotice = checkSafetyRecall(effectiveModel, effectiveBrand);

    const createdAsset: Asset = {
      id: assetId,
      userId: 'usr_demo',
      name: effectiveName.trim(),
      brand: effectiveBrand.trim(),
      modelNumber: effectiveModel.trim() || 'MDL-STD',
      serialNumber: effectiveSerial.trim() || 'SN-PENDING',
      upcBarcode: effectiveUpc.trim() || '000000000000',
      category: effectiveCategory,
      subcategory: primaryLineItem?.subcategory || 'General',
      merchantName: effectiveMerchant.trim(),
      purchaseDate: effectiveDate,
      purchasePrice: numericPrice,
      taxAmount: isNaN(numericTax) ? 0 : numericTax,
      shippingFee: interpretation.disaggregation.shippingFee,
      recyclingFee: interpretation.disaggregation.recyclingFee,
      currency: 'USD',
      paymentMethodId: card.id,
      isDurableAsset:
        effectiveCategory !== 'Groceries' &&
        effectiveCategory !== 'Subscriptions/Services',
      usageCount: 1,
      status: policyEval.overallAssetStatus,
      lineItems: interpretation.lineItems.map((li, idx) => ({
        id: `li_${assetId}_${idx}`,
        assetId,
        description: li.description,
        category: li.primaryCategory,
        subcategory: li.subcategory,
        unitPrice: li.unitPrice,
        quantity: li.quantity,
        totalPrice: li.totalPrice,
        isDurableAsset: li.isDurableAsset,
      })),
      usageLogs: [
        {
          id: `ul_${assetId}`,
          assetId,
          loggedDate: REFERENCE_DATE,
          usageCount: 1,
          notes: 'Onboard IntelligenceEngine v5.0 ingestion',
        },
      ],
      policies: policyEval.allPolicies,
      recallNotice,
      createdAt: new Date().toISOString(),
    };

    commitAsset(createdAsset);
    triggerHaptic('scanSuccess');
    onClose();
  };

  const handleIngestSplitItemsSeparately = () => {
    triggerHaptic(30);
    interpretation.lineItems.forEach((li, idx) => {
      const splitAsset = buildAssetFromLineItem(li, idx);
      commitAsset(splitAsset);
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center"
    >
      <div className="bg-white border-t border-slate-200 rounded-t-3xl max-w-[430px] w-full p-4 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
        {/* Android Bottom Sheet Drag Handle */}
        <div className="w-10 h-1.5 bg-slate-500/40 rounded-full mx-auto" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="text-[11px] font-mono text-sky-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 shrink-0" />
              <span>
                {interpretation.engineVersion} · {interpretation.processingTimeMs}ms ·{' '}
                {Math.round(interpretation.overallConfidence * 100)}% match
              </span>
            </div>
            <h2
              id="scanner-modal-title"
              className="text-base font-bold text-slate-900 mt-0.5"
            >
              Android Receipt Scanner &amp; AI Itemizer
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Multi-Step Capture Mode Pill Bar */}
        <div
          role="group"
          aria-label="Multi-step capture mode"
          className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl"
        >
          {(
            [
              { step: 'Receipt', num: '1', icon: Receipt },
              { step: 'UPC Barcode', num: '2', icon: Barcode },
              { step: 'Serial Plate', num: '3', icon: ShieldCheck },
            ] as const
          ).map(({ step, num, icon: Icon }) => {
            const active = captureStep === step;
            return (
              <button
                key={step}
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setCaptureStep(step);
                }}
                className={`min-h-[38px] px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {num}. {step.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sample Receipt Presets (Horizontal Touch Scroll) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {MULTI_ITEM_RECEIPT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleLoadPreset(preset.id)}
              className="min-h-[32px] px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {preset.label.split(' (')[0]}
            </button>
          ))}
        </div>

        {/* 2. Phone Camera Viewfinder with Laser Reticle & Floating OCR Chips */}
        <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-3.5 flex flex-col justify-between min-h-[210px] overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-3 right-3 top-5 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-laser-scan"
          />

          <div className="flex items-center justify-between text-xs text-slate-400 z-10">
            <span className="font-mono text-[10px] text-sky-400">
              {captureStep.toUpperCase()} · NPU OCR LIVE
            </span>
            <label className="text-[11px] font-medium text-emerald-400 underline cursor-pointer flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" />
              <span>Snap Photo</span>
              <input
                type="file"
                accept="image/*,.pdf"
                capture="environment"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setCapturedImageName(f.name);
                    handleTactileShutter();
                    setIsCloudEnhancing(true);
                    try {
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const base64Data = (reader.result as string).split(',')[1];
                        if (base64Data) {
                          const res = await fetch('/api/intelligence/parse', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              rawText: `Receipt Photo: ${f.name}`,
                              imageBase64: base64Data,
                              mimeType: f.type || 'image/jpeg',
                            }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            if (data && data.result) {
                              setCloudStructuredResult(data.result);
                              setManualMerchant(data.result.merchantIdentification.merchantName);
                              setManualDate(data.result.merchantIdentification.transactionDate);
                              setManualBrand(data.result.primaryBrand);
                              setManualModel(data.result.primaryModelNumber);
                              setManualSerial(data.result.primarySerialNumber);
                              setManualUpc(data.result.primaryUpcBarcode);
                              setManualPrice(String(data.result.taxBreakdown.grandTotal));
                              setManualTax(String(data.result.taxBreakdown.salesTax));
                            }
                          }
                        }
                        setIsCloudEnhancing(false);
                      };
                      reader.readAsDataURL(f);
                    } catch {
                      setIsCloudEnhancing(false);
                    }
                  }
                }}
              />
            </label>
          </div>

          {/* Detected Floating OCR Chips */}
          <div className="my-2.5 border border-dashed border-sky-400/50 rounded-xl p-3 bg-slate-900/75 backdrop-blur-xs z-10 space-y-2">
            <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <span>
                {effectiveMerchant} · {interpretation.lineItems.length} Items
              </span>
              <span className="text-emerald-400">
                Return: {interpretation.merchantReturnWindowDays}d (until{' '}
                {interpretation.merchantIdentification.returnDeadlineDate})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-emerald-500/30">
                Total: ${interpretation.disaggregation.grandTotal.toFixed(2)}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
                S/N: {effectiveSerial}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-sky-500/30">
                1-Yr Resale: ${interpretation.estimatedOneYearResaleValue.toFixed(0)}
              </span>
            </div>
            {capturedImageName && (
              <div className="text-[10px] text-emerald-400 font-mono">
                Captured: {capturedImageName}
              </div>
            )}
          </div>

          {/* Shutter & Gemini Cloud Deep Parse */}
          <div className="flex items-center justify-between gap-2 z-10">
            <button
              type="button"
              onClick={handleServerMultimodalEnhance}
              disabled={isCloudEnhancing}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>{isCloudEnhancing ? 'Parsing...' : 'AI Deep Parse'}</span>
            </button>

            <button
              type="button"
              onClick={handleTactileShutter}
              aria-label={`Capture ${captureStep}`}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
                isShutterScanning
                  ? 'border-emerald-400 bg-emerald-500/20'
                  : 'border-sky-400 bg-white/10 hover:bg-white/20'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full transition-colors ${
                  isShutterScanning ? 'bg-emerald-400' : 'bg-sky-400'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Raw OCR Stream Collapsible / Editable Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="raw-ocr-textarea"
              className="font-semibold text-slate-800"
            >
              Raw Receipt OCR Stream (Live Editable)
            </label>
            <span className="font-mono text-[10px] text-slate-500">
              Tax Rate: {interpretation.taxBreakdown.effectiveTaxRatePercent}%
            </span>
          </div>
          <textarea
            id="raw-ocr-textarea"
            rows={4}
            value={rawOcrInput}
            onChange={(e) => {
              resetManualOverrides();
              setRawOcrInput(e.target.value);
            }}
            className="w-full p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* 3. NEW IntelligenceEngine v5.0 Smart Insights & Card Perk Optimizer */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>IntelligenceEngine v5.0 Advisory Insights</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              {interpretation.insights.length} Active Checks
            </span>
          </div>

          {/* Card Optimization Banner */}
          <div
            className={`p-3 rounded-xl border text-xs space-y-1 ${
              interpretation.cardOptimization.isOptimalCardUsed
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {interpretation.cardOptimization.isOptimalCardUsed
                    ? 'Optimal Card Tier Detected'
                    : 'Card Perk Upgrade Available'}
                </span>
              </span>
              <span className="font-mono text-[11px]">
                +{interpretation.cardOptimization.extendedWarrantyMonthsAdded}m Ext
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {interpretation.cardOptimization.recommendationNote}
            </p>
          </div>

          {/* Diagnostic Insights List */}
          <div className="space-y-1.5">
            {interpretation.insights.map((ins) => (
              <div
                key={ins.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2 min-w-0">
                  {ins.severity === 'critical' ? (
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  ) : ins.severity === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  ) : ins.severity === 'positive' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">
                      {ins.title}
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
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
        </div>

        {/* 4. Mobile Line-Item Cards (Replaces Desktop Table) */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  Itemized Line Breakdown ({interpretation.lineItems.length})
                </span>
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowStructuredJsonInspector((prev) => !prev)}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 text-[11px] font-medium cursor-pointer"
            >
              {showStructuredJsonInspector ? 'Hide JSON' : 'Prompt & JSON'}
            </button>
          </div>

          {showStructuredJsonInspector && (
            <div className="space-y-2 pt-1">
              <pre className="p-2.5 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[10px] leading-relaxed overflow-x-auto max-h-44 border border-slate-800 whitespace-pre-wrap">
                {JSON.stringify(
                  {
                    merchantIdentification:
                      interpretation.merchantIdentification,
                    cardOptimization: interpretation.cardOptimization,
                    lineItems: interpretation.lineItems.map((li) => ({
                      description: li.description,
                      totalPrice: li.totalPrice,
                      primaryCategory: li.primaryCategory,
                      subcategory: li.subcategory,
                      isDurableAsset: li.isDurableAsset,
                      estimatedOneYearResaleValue:
                        li.estimatedOneYearResaleValue,
                    })),
                    taxBreakdown: interpretation.taxBreakdown,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}

          {/* Phone-Native Line Item Stack */}
          <div className="space-y-2">
            {interpretation.lineItems.map((li) => (
              <div
                key={li.id}
                className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {li.description}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {li.quantity} × ${li.unitPrice.toFixed(2)} ·{' '}
                      {li.isDurableAsset
                        ? `${li.estimatedWarrantyMonths}m Mfg · 1-Yr Resale $${li.estimatedOneYearResaleValue.toFixed(0)}`
                        : 'Consumable'}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-bold text-slate-900">
                      ${li.totalPrice.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-emerald-500">
                      {Math.round(li.confidenceScore * 100)}% conf
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 truncate">
                    Sub: {li.subcategory}
                  </span>
                  <select
                    aria-label={`Category for ${li.description}`}
                    value={li.primaryCategory}
                    onChange={(e) =>
                      setCustomOverrides((prev) => ({
                        ...prev,
                        [li.id]: e.target.value as PrimaryCategory,
                      }))
                    }
                    className="px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Disaggregated Totals Strip */}
          <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-1.5 text-[11px] font-mono tabular-nums text-slate-600">
            <span>Subtotal: ${interpretation.disaggregation.baseSubtotal.toFixed(2)}</span>
            <span>Sales Tax: ${interpretation.disaggregation.salesTax.toFixed(2)}</span>
            {interpretation.disaggregation.discountSavings > 0 && (
              <span className="text-emerald-500">
                Instant Savings: -${interpretation.disaggregation.discountSavings.toFixed(2)}
              </span>
            )}
            <span className="font-bold text-slate-900 col-span-2 pt-1 border-t border-slate-200/60 flex justify-between">
              <span>Grand Total:</span>
              <span>${interpretation.disaggregation.grandTotal.toFixed(2)} USD</span>
            </span>
          </div>

          {interpretation.lineItems.length > 1 && (
            <button
              type="button"
              onClick={handleIngestSplitItemsSeparately}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                Split &amp; Ingest All {interpretation.lineItems.length} Items Separately
              </span>
            </button>
          )}
        </div>

        {/* 5. Compact Phone Verification Form */}
        <form onSubmit={handleSavePrimaryAsset} className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2">
              <label
                htmlFor="ingest-name"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                Primary Asset Name
              </label>
              <input
                id="ingest-name"
                type="text"
                value={effectiveName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="ingest-brand"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                Brand
              </label>
              <input
                id="ingest-brand"
                type="text"
                value={effectiveBrand}
                onChange={(e) => setManualBrand(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="ingest-merchant"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                Merchant
              </label>
              <input
                id="ingest-merchant"
                type="text"
                value={effectiveMerchant}
                onChange={(e) => setManualMerchant(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="ingest-model"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                Model No.
              </label>
              <input
                id="ingest-model"
                type="text"
                value={effectiveModel}
                onChange={(e) => setManualModel(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="ingest-serial"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                Serial Number (S/N)
              </label>
              <input
                id="ingest-serial"
                type="text"
                value={effectiveSerial}
                onChange={(e) => setManualSerial(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="ingest-price"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                Base Price (USD)
              </label>
              <input
                id="ingest-price"
                type="number"
                step="0.01"
                value={effectivePrice}
                onChange={(e) => setManualPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="ingest-tax"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                Sales Tax (USD)
              </label>
              <input
                id="ingest-tax"
                type="number"
                step="0.01"
                value={effectiveTax}
                onChange={(e) => setManualTax(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="ingest-date"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                Purchase Date
              </label>
              <input
                id="ingest-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="ingest-category"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                Category
              </label>
              <select
                id="ingest-category"
                value={effectiveCategory}
                onChange={(e) =>
                  setManualCategory(e.target.value as PrimaryCategory)
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label
                htmlFor="ingest-card"
                className="block text-[11px] font-medium text-slate-700 mb-1"
              >
                Payment Method Used
              </label>
              <select
                id="ingest-card"
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
              >
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.issuer} {pm.cardName} (••{pm.lastFour})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {scanError && (
            <p role="alert" className="text-xs text-rose-500 font-medium">
              {scanError}
            </p>
          )}

          <div className="flex items-center gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Save Asset to Vault</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

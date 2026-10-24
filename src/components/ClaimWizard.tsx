import React, { useState, useMemo } from 'react';
import { triggerHaptic } from '../lib/haptics';
import {
  Cpu,
  Droplets,
  Zap,
  ShieldAlert,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Mic,
  Printer,
  Copy,
  Check,
  X,
  FileText,
} from 'lucide-react';
import {
  Asset,
  PaymentMethod,
  ClaimRecord,
  IncidentType,
  ClaimRoute,
} from '../types/schema';
import {
  selectOptimalClaimRoute,
  generateClaimDossier,
} from '../lib/claimGenerator';
import { formatProtectedField } from '../lib/vaultCrypto';
import { REFERENCE_DATE } from '../lib/seedData';

export interface ClaimWizardProps {
  asset: Asset | null;
  onClose: () => void;
  paymentMethods: PaymentMethod[];
  isPiiRevealed: boolean;
  onFileClaim: (newClaim: ClaimRecord) => void;
}

const INCIDENT_CARDS: {
  type: IncidentType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: 'Hardware Defect',
    label: 'Hardware Defect',
    desc: 'Internal component or display fault',
    icon: Cpu,
  },
  {
    type: 'Accidental Drop/Spill',
    label: 'Accidental Drop',
    desc: 'Cracked screen or liquid spill',
    icon: Droplets,
  },
  {
    type: 'Power Surge',
    label: 'Electrical Surge',
    desc: 'Voltage transient failure',
    icon: Zap,
  },
  {
    type: 'Theft',
    label: 'Theft / Burglary',
    desc: '120d card theft protection',
    icon: ShieldAlert,
  },
  {
    type: 'Normal Wear and Tear',
    label: 'Mechanical Wear',
    desc: 'Battery or hinge degradation',
    icon: Wrench,
  },
];

const CLAIM_ROUTES: ClaimRoute[] = [
  'Retailer Return',
  'Manufacturer RMA',
  'Credit Card Extended Warranty',
  'Credit Card Purchase Protection',
  'Credit Card Return Protection',
];

export const ClaimWizard: React.FC<ClaimWizardProps> = ({
  asset,
  onClose,
  paymentMethods,
  isPiiRevealed,
  onFileClaim,
}) => {
  const [incidentType, setIncidentType] =
    useState<IncidentType>('Hardware Defect');
  const [incidentDate, setIncidentDate] = useState<string>(REFERENCE_DATE);
  const [diagnosticNotes, setDiagnosticNotes] = useState<string>('');
  const [photoEvidenceNames, setPhotoEvidenceNames] = useState<string[]>([
    'device_serial_plate_highres.jpg',
    'merchant_receipt_verified.pdf',
  ]);
  const [selectedRouteOverride, setSelectedRouteOverride] =
    useState<ClaimRoute | null>(null);
  const [generatedDossier, setGeneratedDossier] = useState<ClaimRecord | null>(
    null
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedDossier, setCopiedDossier] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  const currentRecommendation = useMemo(() => {
    if (!asset) return null;
    return selectOptimalClaimRoute(asset, incidentType);
  }, [asset, incidentType]);

  if (!asset) return null;


  const handleVoiceDictationAssist = () => {
    triggerHaptic(15);
    setIsDictating(true);
    setTimeout(() => {
      setIsDictating(false);
      const sampleNarrative =
        incidentType === 'Accidental Drop/Spill'
          ? `Accidental impact damage to ${asset.name} (${asset.modelNumber}) occurred on ${incidentDate}. Display assembly fractured upon drop; device serial plate ${asset.serialNumber} verified intact.`
          : `Intermittent hardware failure observed on ${asset.name} (${asset.modelNumber}) during normal operation on ${incidentDate}. Unit fails hardware self-test diagnostic with no external physical damage or liquid exposure.`;
      setDiagnosticNotes(sampleNarrative);
      setFormError(null);
    }, 300);
  };

  const handleCompileClaimDossier = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(20);
    if (!diagnosticNotes.trim() || diagnosticNotes.trim().length < 10) {
      setFormError(
        'Please provide at least 10 characters of diagnostic notes describing the failure.'
      );
      return;
    }

    const card =
      paymentMethods.find((pm) => pm.id === asset.paymentMethodId) ||
      paymentMethods[0];

    const compiled = generateClaimDossier({
      userId: asset.userId,
      claimantName: 'Alex Mercer',
      claimantEmail: 'star.hope673@gmail.com',
      asset,
      paymentMethod: card,
      incidentType,
      incidentDate,
      diagnosticNotes: diagnosticNotes.trim(),
      photoEvidenceNames,
      selectedRoute: selectedRouteOverride || undefined,
    });

    setGeneratedDossier(compiled);
    setFormError(null);
    onFileClaim(compiled);
    triggerHaptic('claimSubmission');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center"
    >
      <div className="bg-white border-t border-slate-200 rounded-t-3xl max-w-[430px] w-full p-4 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
        <div className="w-10 h-1.5 bg-slate-500/40 rounded-full mx-auto" />

        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="text-[11px] font-medium text-sky-400">
              Autonomous Claim &amp; RMA Compiler
            </div>
            <h2
              id="claim-modal-title"
              className="text-base font-bold text-slate-900 mt-0.5"
            >
              File Coverage Claim: {asset.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close claim modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!generatedDossier ? (
          <form onSubmit={handleCompileClaimDossier} className="space-y-4">
            {/* Autonomous Route Recommendation Banner */}
            {currentRecommendation && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{currentRecommendation.recommendedRoute}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {currentRecommendation.estimatedApprovalProbability}% est · $0 ded
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  {currentRecommendation.rationale}
                </p>
              </div>
            )}

            {/* Step 1: Incident Category Cards (2-Column Phone Grid) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="incident-type-select"
                  className="text-xs font-semibold text-slate-800"
                >
                  Step 1. Select Incident Type
                </label>
                <select
                  id="incident-type-select"
                  value={incidentType}
                  onChange={(e) => {
                    triggerHaptic(10);
                    setIncidentType(e.target.value as IncidentType);
                    setSelectedRouteOverride(null);
                  }}
                  className="px-2 py-1 text-[11px] bg-slate-100 border border-slate-300 rounded-lg text-slate-900"
                >
                  {INCIDENT_CARDS.map((c) => (
                    <option key={c.type} value={c.type}>
                      {c.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {INCIDENT_CARDS.map((card) => {
                  const Icon = card.icon;
                  const active = incidentType === card.type;
                  return (
                    <button
                      key={card.type}
                      type="button"
                      onClick={() => {
                        triggerHaptic(12);
                        setIncidentType(card.type);
                        setSelectedRouteOverride(null);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-slate-900 text-white border-sky-400'
                          : 'bg-slate-50 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            active ? 'text-sky-400' : 'text-slate-500'
                          }`}
                        />
                        <span className="text-xs font-bold truncate">
                          {card.label}
                        </span>
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5 line-clamp-1">
                        {card.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Date & Route */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="incident-date-input"
                  className="block text-[11px] font-semibold text-slate-800 mb-1"
                >
                  Step 2a. Incident Date
                </label>
                <input
                  id="incident-date-input"
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="claim-route-select"
                  className="block text-[11px] font-semibold text-slate-800 mb-1"
                >
                  Step 2b. Coverage Route
                </label>
                <select
                  id="claim-route-select"
                  value={
                    selectedRouteOverride ||
                    currentRecommendation?.recommendedRoute ||
                    'Manufacturer RMA'
                  }
                  onChange={(e) =>
                    setSelectedRouteOverride(e.target.value as ClaimRoute)
                  }
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                >
                  {CLAIM_ROUTES.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="diagnostic-notes-textarea"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Diagnostic Failure Narrative
                </label>
                <button
                  type="button"
                  onClick={handleVoiceDictationAssist}
                  className="text-[11px] font-medium text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Mic className="w-3 h-3" />
                  <span>
                    {isDictating
                      ? 'Transcribing...'
                      : 'Voice Dictate / Auto-Draft'}
                  </span>
                </button>
              </div>
              <textarea
                id="diagnostic-notes-textarea"
                rows={3}
                value={diagnosticNotes}
                onChange={(e) => setDiagnosticNotes(e.target.value)}
                placeholder="Describe symptom, error codes, or accidental damage..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400"
              />
            </div>

            {/* Step 3: Evidence Strip */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-800">
                  Step 3. Evidence Exhibits ({photoEvidenceNames.length})
                </span>
                <label className="text-[11px] font-medium text-sky-400 underline cursor-pointer flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>Attach File</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPhotoEvidenceNames((prev) => [...prev, file.name]);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {photoEvidenceNames.map((name, i) => (
                  <div
                    key={i}
                    className="text-[11px] font-mono bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5"
                  >
                    <FileText className="w-3 h-3 text-sky-400 shrink-0" />
                    <span className="truncate max-w-[180px]">{name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPhotoEvidenceNames((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                      aria-label={`Remove ${name}`}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {formError && (
              <div
                role="alert"
                className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl cursor-pointer"
              >
                Compile Formal Claim Dossier
              </button>
            </div>
          </form>
        ) : (
          /* One-Tap Dossier Export & Preview */
          <div className="space-y-3.5">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
              <span className="font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Dossier {generatedDossier.id} compiled ($
                  {generatedDossier.claimAmount.toFixed(2)})
                </span>
              </span>
              <span className="font-mono font-bold">
                {generatedDossier.status}
              </span>
            </div>

            <pre className="bg-slate-950 text-slate-100 p-3.5 rounded-2xl font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto border border-slate-800">
              {isPiiRevealed
                ? generatedDossier.dossierMarkdown
                : generatedDossier.dossierMarkdown
                    .replace(
                      /S\/N:\*\* ([A-Z0-9-]+)/g,
                      (_, sn) =>
                        `S/N:** ${formatProtectedField(sn, false, 'serial')}`
                    )
                    .replace(
                      /\(([^)]+@[^)]+)\)/g,
                      (_, em) =>
                        `(${formatProtectedField(em, false, 'email')})`
                    )}
            </pre>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setGeneratedDossier(null)}
                className="min-h-[42px] px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl cursor-pointer"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    generatedDossier.dossierMarkdown
                  );
                  setCopiedDossier(true);
                  setTimeout(() => setCopiedDossier(false), 2000);
                }}
                className="min-h-[42px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl flex items-center gap-1 cursor-pointer"
              >
                {copiedDossier ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Share PDF Packet</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Printer,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { ClaimRecord, Asset, PaymentMethod } from '../types/schema';
import { formatProtectedField } from '../lib/vaultCrypto';
import { ClaimWizard } from './ClaimWizard';

interface ClaimsWorkspaceViewProps {
  claims: ClaimRecord[];
  assets?: Asset[];
  paymentMethods?: PaymentMethod[];
  isPiiRevealed: boolean;
  onUpdateClaimStatus: (claimId: string, status: ClaimRecord['status']) => void;
  onFileClaim?: (newClaim: ClaimRecord) => void;
}

type ClaimFilterSegment =
  | 'ALL'
  | 'Active / Under Review'
  | 'Drafts'
  | 'Resolved / Paid';

const CLAIM_STATUS_STEPS: ClaimRecord['status'][] = [
  'Draft',
  'Ready to Submit',
  'Submitted',
  'Approved',
];

export const ClaimsWorkspaceView: React.FC<ClaimsWorkspaceViewProps> = ({
  claims,
  assets = [],
  paymentMethods = [],
  isPiiRevealed,
  onUpdateClaimStatus,
  onFileClaim,
}) => {
  const [statusSegment, setStatusSegment] =
    useState<ClaimFilterSegment>('ALL');
  const [selectedClaimId, setSelectedClaimId] = useState<string>(
    claims[0]?.id || ''
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [wizardAssetId, setWizardAssetId] = useState<string>(
    assets[0]?.id || ''
  );
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const filteredClaims = useMemo(() => {
    if (statusSegment === 'ALL') return claims;
    if (statusSegment === 'Drafts') {
      return claims.filter((c) => c.status === 'Draft');
    }
    if (statusSegment === 'Resolved / Paid') {
      return claims.filter(
        (c) => c.status === 'Approved' || c.status === 'Resolved'
      );
    }
    return claims.filter(
      (c) =>
        c.status === 'Ready to Submit' ||
        c.status === 'Submitted' ||
        c.status === 'Under Review'
    );
  }, [claims, statusSegment]);

  const activeClaim =
    filteredClaims.find((c) => c.id === selectedClaimId) ||
    filteredClaims[0] ||
    claims[0] ||
    null;

  const targetWizardAsset =
    assets.find((a) => a.id === wizardAssetId) || assets[0] || null;

  return (
    <div className="space-y-4 animate-tab-transition">
      {/* Top Phone Claim Launcher & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Disputes &amp; RMA Lifecycle Center
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Statutory citations, receipt exhibits, and autonomous card benefit routing
          </p>
        </div>

        {/* Direct Claim Generator Launcher */}
        {assets.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              aria-label="Select asset for new claim packet"
              value={wizardAssetId || assets[0]?.id}
              onChange={(e) => setWizardAssetId(e.target.value)}
              className="flex-1 min-w-0 min-h-[38px] px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (${a.purchasePrice.toFixed(0)})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Launch Claim Generator</span>
            </button>
          </div>
        )}

        {/* Horizontal Touch-Scroll Status Pills */}
        <div
          role="group"
          aria-label="Filter claims by lifecycle stage"
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 border-t border-slate-100"
        >
          {(
            [
              'ALL',
              'Active / Under Review',
              'Drafts',
              'Resolved / Paid',
            ] as ClaimFilterSegment[]
          ).map((seg) => (
            <button
              key={seg}
              type="button"
              onClick={() => setStatusSegment(seg)}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusSegment === seg
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {seg === 'ALL' ? `All (${claims.length})` : seg}
            </button>
          ))}
        </div>
      </div>

      {filteredClaims.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <FileText className="w-8 h-8 text-sky-400 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-900">
            No Claim Dossiers in &ldquo;{statusSegment}&rdquo;
          </h3>
          <p className="text-xs text-slate-500">
            Launch the Claim Generator above or switch filter tabs to inspect compiled RMA and card benefit packets.
          </p>
          {statusSegment !== 'ALL' && (
            <button
              type="button"
              onClick={() => setStatusSegment('ALL')}
              className="min-h-[36px] px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl cursor-pointer"
            >
              Show All Packets
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Mobile Claim Cards Queue */}
          <div className="space-y-2.5">
            {filteredClaims.map((c) => {
              const isSelected = activeClaim?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClaimId(c.id)}
                  className={`w-full text-left m3-card-pad p-4 rounded-2xl border transition-all cursor-pointer bg-white text-slate-900 ${
                    isSelected
                      ? 'border-sky-500 ring-1 ring-sky-500/30 ambient-active-glow'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-mono font-semibold text-slate-500">
                      {c.id} · {c.incidentDate}
                    </span>
                    <span className="font-semibold text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{c.status}</span>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {c.assetName}
                  </h3>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {c.incidentType} · {c.selectedRoute}
                  </div>
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-xs font-mono tabular-nums text-slate-700">
                    <span>Claim Value:</span>
                    <span className="font-bold text-slate-900">
                      ${c.claimAmount.toFixed(2)} USD
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Claim Formal Dossier Inspector (Phone Card) */}
          {activeClaim && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-sky-400 font-mono truncate">
                    {activeClaim.id} · {activeClaim.selectedRoute}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 truncate mt-0.5">
                    {activeClaim.assetName}
                  </h3>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    Admin: {activeClaim.administratorContact}
                  </div>
                </div>

                <div>
                  <label htmlFor="claim-status-select" className="sr-only">
                    Update Claim Status
                  </label>
                  <select
                    id="claim-status-select"
                    value={activeClaim.status}
                    onChange={(e) =>
                      onUpdateClaimStatus(
                        activeClaim.id,
                        e.target.value as ClaimRecord['status']
                      )
                    }
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 border border-slate-200 rounded-xl text-slate-800"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Ready to Submit">Ready to Submit</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Approved">Approved</option>
                    <option value="Denied">Denied</option>
                  </select>
                </div>
              </div>

              {/* 2x2 Stage Progress Grid for Phone */}
              <div className="grid grid-cols-2 gap-2">
                {CLAIM_STATUS_STEPS.map((step, i) => {
                  const isCurrent = activeClaim.status === step;
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => onUpdateClaimStatus(activeClaim.id, step)}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="text-[10px] font-mono text-slate-500">
                        0{i + 1}. Stage
                      </div>
                      <div className="text-xs truncate mt-0.5">{step}</div>
                    </button>
                  );
                })}
              </div>

              {/* Statutory Citations */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Enforced Statutory Citations</span>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                  {activeClaim.statutoryCitations.map((cit, idx) => (
                    <li key={idx}>{cit}</li>
                  ))}
                </ul>
              </div>

              {/* Dossier Statement & Export Buttons */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Compiled Dossier Statement
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          activeClaim.dossierMarkdown
                        );
                        setCopiedId(activeClaim.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="min-h-[34px] px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === activeClaim.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
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
                      className="min-h-[34px] px-3 py-1 text-xs font-semibold text-white bg-slate-900 rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>

                <pre className="bg-slate-950 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] whitespace-pre-wrap leading-relaxed overflow-x-auto border border-slate-800 max-h-72">
                  {isPiiRevealed
                    ? activeClaim.dossierMarkdown
                    : activeClaim.dossierMarkdown.replace(
                        /S\/N:\*\* ([A-Z0-9-]+)/g,
                        (_, sn) =>
                          `S/N:** ${formatProtectedField(sn, false, 'serial')}`
                      )}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive ClaimWizard Bottom Sheet Modal */}
      {isWizardOpen && targetWizardAsset && (
        <ClaimWizard
          asset={targetWizardAsset}
          paymentMethods={paymentMethods}
          isPiiRevealed={isPiiRevealed}
          onClose={() => setIsWizardOpen(false)}
          onFileClaim={(claim) => {
            if (onFileClaim) onFileClaim(claim);
            setSelectedClaimId(claim.id);
            setIsWizardOpen(false);
          }}
        />
      )}
    </div>
  );
};

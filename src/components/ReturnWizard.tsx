import React, { useState } from 'react';
import { RotateCcw, CheckCircle2, ShieldCheck, DollarSign, X } from 'lucide-react';
import { Asset } from '../types/schema';
import { triggerHaptic } from '../lib/haptics';

export interface ReturnWizardProps {
  assets: Asset[];
  isOpen: boolean;
  onClose: () => void;
  onProcessReturn: (assetId: string, refundedAmount: number, reason: string) => void;
}

export const ReturnWizard: React.FC<ReturnWizardProps> = ({
  assets,
  isOpen,
  onClose,
  onProcessReturn,
}) => {
  const eligibleAssets = assets.filter((a) => a.status !== 'Returned' && a.status !== 'Expired');
  const [selectedAssetId, setSelectedAssetId] = useState<string>(eligibleAssets[0]?.id || '');
  const [returnReason, setReturnReason] = useState<string>('Unwanted / Changed Mind');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState(false);

  if (!isOpen) return null;

  const targetAsset = assets.find((a) => a.id === selectedAssetId) || eligibleAssets[0];

  const handleExecuteReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAsset) return;
    triggerHaptic('scanSuccess');
    const amt = parseFloat(refundAmount) || targetAsset.purchasePrice;
    onProcessReturn(targetAsset.id, amt, returnReason);
    setSuccessMsg(true);
    setTimeout(() => {
      setSuccessMsg(false);
      onClose();
    }, 1500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center"
    >
      <div className="bg-white border-t border-slate-200 rounded-t-3xl max-w-[430px] w-full p-4 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-200">
        <div className="w-10 h-1.5 bg-slate-500/40 rounded-full mx-auto" />

        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="text-[11px] font-mono text-emerald-500 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retailer Return &amp; Refund Assistant</span>
            </div>
            <h2 id="return-modal-title" className="text-base font-bold text-slate-900 mt-0.5">
              Process Product Return
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <div className="text-base font-bold text-slate-900">Return Processed Successfully!</div>
            <div className="text-xs text-slate-500">
              Refund of ${refundAmount || targetAsset?.purchasePrice} recorded and asset status updated to Returned.
            </div>
          </div>
        ) : eligibleAssets.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-800">No Eligible Assets Found</div>
            <div className="text-xs text-slate-500">All tracked assets are already returned or expired.</div>
          </div>
        ) : (
          <form onSubmit={handleExecuteReturn} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-800">Select Product / Asset to Return:</label>
              <select
                aria-label="Select Product to Return"
                value={selectedAssetId}
                onChange={(e) => {
                  triggerHaptic(8);
                  setSelectedAssetId(e.target.value);
                  const found = assets.find((a) => a.id === e.target.value);
                  if (found) setRefundAmount(String(found.purchasePrice));
                }}
                className="w-full min-h-[38px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
              >
                {eligibleAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.merchantName} · ${a.purchasePrice.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {targetAsset && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Merchant:</span>
                  <span className="font-bold text-slate-900">{targetAsset.merchantName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Purchase Price:</span>
                  <span className="font-bold text-emerald-600">${targetAsset.purchasePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Return Window:</span>
                  <span className="font-bold text-slate-900">Eligible</span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="font-semibold text-slate-800">Return Reason:</label>
              <select
                aria-label="Return Reason"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full min-h-[38px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="Unwanted / Changed Mind">Unwanted / Changed Mind</option>
                <option value="Defective / Broken on Arrival">Defective / Broken on Arrival</option>
                <option value="Wrong Size / Specification">Wrong Size / Specification</option>
                <option value="Better Price Found (Price Match)">Better Price Found (Price Match)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="return-refund-input" className="font-semibold text-slate-800">Refund Amount ($):</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="return-refund-input"
                  type="number"
                  step="0.01"
                  value={refundAmount || (targetAsset ? String(targetAsset.purchasePrice) : '')}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[42px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Confirm &amp; Record Return</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

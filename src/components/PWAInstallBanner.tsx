import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, X } from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Installed on Phone</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (isInstallable) {
            await install();
          } else {
            setShowGuideModal(true);
          }
        }}
        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install Android App</span>
      </button>

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="android-install-title"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="android-install-title"
                    className="text-base font-bold text-slate-900"
                  >
                    Install ReceiptVault on Your Phone
                  </h3>
                  <p className="text-xs text-slate-500">
                    Standalone Android &amp; iOS Home Screen App
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install guide"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4">
              {isIOS ? (
                <>
                  <p className="font-semibold text-slate-900">
                    iOS Safari Installation:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>
                      Tap the <strong>Share</strong> icon in the bottom browser bar.
                    </li>
                    <li>
                      Select <strong>Add to Home Screen</strong> to launch ReceiptVault fullscreen with Face ID.
                    </li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-900">
                    Android Chrome Installation:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>
                      Open this URL directly in <strong>Chrome on Android</strong> (or click the browser address bar install icon).
                    </li>
                    <li>
                      Tap the Chrome menu (<strong>...</strong>) and choose <strong>Install app</strong> / <strong>Add to Home screen</strong>.
                    </li>
                    <li>
                      Launch <strong>ReceiptVault</strong> from your app drawer for full-screen biometric access and offline receipt storage.
                    </li>
                  </ol>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full min-h-[44px] py-2.5 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

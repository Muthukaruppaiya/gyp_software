import { createContext, useContext, useState } from 'react';
import { Check, Copy } from 'lucide-react';

const TransactionPopupContext = createContext(null);

export function TransactionPopupProvider({ children }) {
  const [popup, setPopup] = useState(null);
  const [copied, setCopied] = useState(false);

  function showSuccess({ title = 'Successfully Completed', message, details = [], copyValue, copyLabel = 'Access Code' }) {
    setCopied(false);
    setPopup({ title, message, details, copyValue, copyLabel });
  }

  function closePopup() {
    setPopup(null);
  }

  async function handleCopy() {
    if (!popup?.copyValue) return;
    try {
      await navigator.clipboard.writeText(popup.copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  }

  return (
    <TransactionPopupContext.Provider value={{ showSuccess, closePopup }}>
      {children}

      {popup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-[30px] border border-white/15 bg-[#141416]/75 backdrop-blur-2xl p-6 shadow-[0_28px_70px_-15px_rgba(17,19,23,0.35)]">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-15 w-15 items-center justify-center rounded-full glass-chip text-white shadow-lg shadow-[#E56717]/25 mb-3.5 ring-4 ring-[#E56717]/25">
                <Check className="h-7 w-7 text-[#E56717]" strokeWidth={3} />
              </div>
              <h3 className="text-lg font-extrabold tracking-tight text-white">{popup.title}</h3>
              {popup.message && (
                <p className="mt-1.5 text-sm text-white/75 leading-relaxed">{popup.message}</p>
              )}
            </div>

            {popup.copyValue && (
              <div className="mt-4 rounded-2xl glass-chip p-4 text-center space-y-2 shadow-inner">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  {popup.copyLabel}
                </p>
                <div className="flex items-center justify-center gap-2.5">
                  <span className="text-xl font-mono font-extrabold tracking-widest text-[#FF9A5A]">
                    {popup.copyValue}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-[#FF9A5A]" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {popup.details?.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 p-3.5 space-y-2 text-xs">
                {popup.details.map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <span className="text-white/55">{d.label}</span>
                    <span className="font-bold text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={closePopup}
              className="mt-5 w-full rounded-full bg-[#E56717] py-3 text-sm font-bold text-white hover:bg-[#C8560F] transition-colors shadow-lg shadow-[#E56717]/30"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </TransactionPopupContext.Provider>
  );
}

export function useTransactionPopup() {
  const ctx = useContext(TransactionPopupContext);
  if (!ctx) throw new Error('useTransactionPopup must be used inside TransactionPopupProvider');
  return ctx;
}

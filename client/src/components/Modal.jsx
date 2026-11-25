import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4">
      <div
        className={`w-full ${maxWidth} max-h-[92vh] overflow-y-auto rounded-t-[30px] sm:rounded-[30px] border border-white/15 bg-[#141416]/75 backdrop-blur-2xl shadow-[0_24px_60px_-15px_rgba(17,19,23,0.35)]`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl">
          <h3 className="text-base sm:text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full bg-white/8 border border-white/10 p-2 text-white/80 hover:glass-chip hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

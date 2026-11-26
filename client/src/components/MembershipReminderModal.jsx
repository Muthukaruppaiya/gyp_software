import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Phone, Wallet } from 'lucide-react';
import { formatCurrency, formatDate } from '../api/client';

/** Login-time popup shown when the membership ends within 3 days (or has already expired). */
export default function MembershipReminderModal({ countdown, profile, gym, onClose }) {
  const navigate = useNavigate();
  const primaryRef = useRef(null);
  const currency = gym?.currency_symbol || '₹';
  const expired = countdown.level === 'expired';

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = expired
    ? 'Your membership has expired'
    : countdown.days === 0
      ? 'Your membership ends today'
      : `Your membership ends in ${countdown.days} day${countdown.days === 1 ? '' : 's'}`;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 backdrop-blur-md p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="renewal-title"
        className="w-full max-w-md rounded-[30px] border border-rose-500/40 bg-[#1a1012]/85 backdrop-blur-2xl p-6 shadow-[0_28px_70px_-15px_rgba(244,63,94,0.35)]"
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-3.5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20 ring-4 ring-rose-500/25">
            <AlertTriangle className="h-8 w-8 text-rose-300" />
          </div>
          {!expired && (
            <p className="text-5xl font-extrabold leading-none text-rose-300 tabular-nums">{countdown.days}</p>
          )}
          <h3 id="renewal-title" className="mt-2 text-lg font-extrabold tracking-tight text-white">
            {title}
          </h3>
          <p className="mt-1.5 text-sm text-white/70 leading-relaxed">
            {expired
              ? 'Self check-in is paused until you renew. Please renew at the front desk or pay online.'
              : 'Renew now so your gym access continues without a break.'}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/6 p-3.5 space-y-2 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-white/55">Plan</span>
            <span className="font-bold text-white">{profile?.plan_name || '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-white/55">{expired ? 'Ended on' : 'Ends on'}</span>
            <span className="font-bold text-white">{formatDate(profile?.plan_end_date)}</span>
          </div>
          {profile?.plan_price != null && (
            <div className="flex justify-between gap-2">
              <span className="text-white/55">Renewal price</span>
              <span className="font-bold text-white">
                {formatCurrency(profile.plan_price, currency)}
                {profile.plan_duration_days ? ` / ${profile.plan_duration_days} days` : ''}
              </span>
            </div>
          )}
          {gym?.upi_id && (
            <div className="flex justify-between gap-2">
              <span className="flex items-center gap-1 text-white/55">
                <Wallet className="h-3.5 w-3.5" /> Pay via UPI
              </span>
              <span className="font-mono font-bold text-[#FF9A5A]">{gym.upi_id}</span>
            </div>
          )}
          {gym?.phone && (
            <div className="flex justify-between gap-2">
              <span className="flex items-center gap-1 text-white/55">
                <Phone className="h-3.5 w-3.5" /> Front desk
              </span>
              <a href={`tel:${gym.phone}`} className="font-bold text-white hover:underline">
                {gym.phone}
              </a>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 bg-white/8 py-3 text-sm font-bold text-white hover:bg-white/15 transition-colors"
          >
            Later
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={() => {
              onClose();
              navigate('/member/fees');
            }}
            className="rounded-full bg-rose-500 py-3 text-sm font-bold text-white hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/30"
          >
            View Fees & Renew
          </button>
        </div>
      </div>
    </div>
  );
}

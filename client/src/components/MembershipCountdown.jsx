import { Link } from 'react-router-dom';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { formatDate } from '../api/client';
import { membershipCountdown } from '../utils/membership';

// Visual style per countdown band.
const STYLES = {
  green: {
    card: 'border-emerald-400/40 bg-emerald-400/10 blink-green',
    icon: 'bg-emerald-400/20 text-emerald-300',
    number: 'text-emerald-300',
    text: 'text-emerald-100/80',
    dot: 'bg-emerald-400 blink-dot',
  },
  neutral: {
    card: 'border-white/15 bg-white/6',
    icon: 'bg-white/12 text-white/80',
    number: 'text-white',
    text: 'text-white/60',
    dot: 'bg-white/50',
  },
  red: {
    card: 'border-rose-500/45 bg-rose-500/12',
    icon: 'bg-rose-500/20 text-rose-300',
    number: 'text-rose-300',
    text: 'text-rose-100/80',
    dot: 'bg-rose-400',
  },
  expired: {
    card: 'border-rose-500/60 bg-rose-500/15',
    icon: 'bg-rose-500/25 text-rose-200',
    number: 'text-rose-200',
    text: 'text-rose-100/80',
    dot: 'bg-rose-400',
  },
  frozen: {
    card: 'border-sky-400/35 bg-sky-400/10',
    icon: 'bg-sky-400/20 text-sky-300',
    number: 'text-sky-200',
    text: 'text-sky-100/75',
    dot: 'bg-sky-300',
  },
};

/**
 * "Membership ends in N days" card for the member dashboard.
 * > 20 days: green + blinking · 11–20 days: neutral · 0–10 days: red · past end date: expired.
 */
export default function MembershipCountdown({ profile }) {
  const cd = membershipCountdown(profile);
  if (!cd.level) return null;
  const s = STYLES[cd.level];
  const showNumber = cd.level !== 'expired' && cd.level !== 'frozen';

  return (
    <div
      role="status"
      aria-label={cd.headline}
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[24px] border backdrop-blur-xl p-4 sm:p-5 ${s.card}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${s.icon}`}>
          <CalendarClock className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/55">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {profile.plan_name || 'Membership'} • ends {formatDate(profile.plan_end_date)}
          </p>
          <p className={`text-lg sm:text-xl font-extrabold ${s.number}`}>{cd.headline}</p>
          <p className={`text-xs ${s.text}`}>{cd.detail}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:shrink-0">
        {showNumber && (
          <div className="text-center">
            <p className={`text-3xl sm:text-4xl font-extrabold leading-none tabular-nums ${s.number}`}>{cd.days}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
              day{cd.days === 1 ? '' : 's'} left
            </p>
          </div>
        )}
        {(cd.level === 'red' || cd.level === 'expired') && (
          <Link
            to="/member/fees"
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-600 transition-colors"
          >
            Renew <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

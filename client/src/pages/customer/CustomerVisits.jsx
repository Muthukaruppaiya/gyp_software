import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { apiFetch, formatDuration, formatTime } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function CustomerVisits() {
  const { profile, user } = useAuth();
  const today = startOfDay(new Date());
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(dayKey(today));

  // Days before the member joined are left unmarked (no ✗).
  const memberSince = startOfDay(new Date(profile?.plan_start_date || user?.created_at || 0));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  useEffect(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    setLoading(true);
    setError('');
    apiFetch(`/attendance?from=${dayKey(first)}&to=${dayKey(last)}&limit=500`)
      .then((r) => setLogs(r.logs || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, month]);

  const byDay = useMemo(() => {
    const map = {};
    for (const l of logs) {
      const k = dayKey(new Date(l.check_in_time));
      (map[k] ||= []).push(l);
    }
    return map;
  }, [logs]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first grid
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = dayKey(date);
      const sessions = byDay[key] || [];
      let state;
      if (sessions.length > 0) state = 'visited';
      else if (date > today) state = 'future';
      else if (date < memberSince) state = 'before';
      else if (date.getTime() === today.getTime()) state = 'today';
      else state = 'missed';
      out.push({
        d,
        key,
        state,
        sessions,
        autoOut: sessions.some((s) => s.auto_checked_out),
        isToday: date.getTime() === today.getTime(),
      });
    }
    return out;
  }, [year, month, byDay, today.getTime(), memberSince.getTime()]);

  const visited = cells.filter((c) => c?.state === 'visited').length;
  const missed = cells.filter((c) => c?.state === 'missed').length;
  const counted = visited + missed;
  const rate = counted ? Math.round((visited / counted) * 100) : 0;
  const selectedCell = cells.find((c) => c?.key === selected);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/member"
          className="flex h-10 w-10 items-center justify-center rounded-full glass-pill text-white hover:bg-white/15"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
            My <span className="font-normal italic text-[#FFD2B3]">Visits</span>
          </h2>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-[11px] font-semibold text-white/55">Days visited</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-300">{visited}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[11px] font-semibold text-white/55">Days missed</p>
          <p className="mt-1 text-2xl font-extrabold text-rose-300">{missed}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[11px] font-semibold text-white/55">Attendance</p>
          <p className="mt-1 text-2xl font-extrabold text-[#FF8F4A]">{rate}%</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}

      {/* Calendar */}
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full glass-chip hover:bg-white/20"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="text-base sm:text-lg font-extrabold text-white">
            {cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            disabled={isCurrentMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full glass-chip hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 mb-2">
          {WEEKDAYS.map((w) => (
            <p key={w} className="text-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/45">
              {w}
            </p>
          ))}
        </div>

        <div className={`grid grid-cols-7 gap-1.5 sm:gap-2.5 transition-opacity ${loading ? 'opacity-40' : ''}`}>
          {cells.map((c, i) =>
            c === null ? (
              <div key={`b${i}`} />
            ) : (
              <button
                key={c.key}
                onClick={() => setSelected(c.key)}
                className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-0.5 sm:gap-1 border transition-all ${
                  selected === c.key ? 'border-[#E56717] bg-[#E56717]/10' : 'border-white/8 bg-white/4 hover:bg-white/8'
                } ${c.state === 'future' || c.state === 'before' ? 'opacity-40' : ''}`}
              >
                <span className={`text-[11px] sm:text-xs font-bold ${c.isToday ? 'text-[#FF8F4A]' : 'text-white/75'}`}>
                  {c.d}
                </span>
                {c.state === 'visited' && (
                  <span className="flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-emerald-500/90 shadow-[0_0_12px_rgba(16,185,129,0.45)]">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4 text-white" strokeWidth={3.5} />
                  </span>
                )}
                {c.state === 'missed' && (
                  <span className="flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-rose-500/85 shadow-[0_0_12px_rgba(244,63,94,0.35)]">
                    <X className="h-3 w-3 sm:h-4 sm:w-4 text-white" strokeWidth={3.5} />
                  </span>
                )}
                {c.state === 'today' && (
                  <span className="h-5 w-5 sm:h-7 sm:w-7 rounded-full border-2 border-dashed border-[#E56717]/70" />
                )}
                {c.autoOut && (
                  <span
                    className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-400"
                    title="Forgot to check out"
                  />
                )}
              </button>
            )
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-white/60">
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/90">
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
            </span>
            Checked in
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/85">
              <X className="h-2.5 w-2.5 text-white" strokeWidth={4} />
            </span>
            No check-in
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-4 w-4 rounded-full border-2 border-dashed border-[#E56717]/70" />
            Today (not yet)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Forgot to check out
          </span>
        </div>
      </div>

      {/* Selected day details */}
      {selectedCell && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-extrabold text-white mb-3">
            {new Date(year, month, selectedCell.d).toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h3>
          {selectedCell.sessions.length === 0 ? (
            <p className="text-xs text-white/55">
              {selectedCell.state === 'missed'
                ? 'No check-in on this day.'
                : selectedCell.state === 'future'
                ? 'This day is still ahead.'
                : selectedCell.state === 'today'
                ? 'You have not checked in yet today.'
                : 'Before your membership started.'}
            </p>
          ) : (
            <div className="space-y-2">
              {selectedCell.sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/6 border border-white/10 p-3"
                >
                  <div className="text-xs text-white/80">
                    In <span className="font-bold text-[#FF8F4A]">{formatTime(s.check_in_time)}</span>
                    {' • '}
                    Out{' '}
                    <span className="font-bold text-white">
                      {s.check_out_time ? formatTime(s.check_out_time) : 'In progress'}
                    </span>
                    {s.auto_checked_out && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        <AlertTriangle className="h-3 w-3" /> Auto check-out
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-white/70">{formatDuration(s.duration_minutes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

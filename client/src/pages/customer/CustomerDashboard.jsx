import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, Clock, CalendarCheck, CreditCard, Flame, ArrowRight, Timer, AlertTriangle } from 'lucide-react';
import { apiFetch, formatCurrency, formatDate, formatDuration, formatTime } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTransactionPopup } from '../../context/TransactionPopupContext';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import MembershipCountdown from '../../components/MembershipCountdown';

export default function CustomerDashboard() {
  const { user, profile, gym, refreshSession } = useAuth();
  const { showSuccess } = useTransactionPopup();
  const currency = gym?.currency_symbol || '₹';

  const [statusData, setStatusData] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [error, setError] = useState('');

  async function loadDashboard() {
    try {
      const [st, logsRes, invRes] = await Promise.all([
        apiFetch('/attendance/status'),
        apiFetch('/attendance?limit=5'),
        apiFetch('/fees/invoices'),
      ]);
      setStatusData(st);
      setRecentLogs(logsRes.logs || []);
      setInvoices(invRes.invoices || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // Pick up renewals the owner recorded since sign-in, so the countdown is current.
    refreshSession();
  }, []);

  useEffect(() => {
    if (!statusData?.activeSession) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [statusData?.activeSession]);

  async function handleCheckIn() {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ notes: 'Mobile / Web self check-in' }),
      });
      showSuccess({
        title: 'Checked In Successfully!',
        message: 'Your workout session has started. Have a great session!',
        details: [{ label: 'In-Time', value: formatTime(res.log?.check_in_time) }],
      });
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ attendanceId: statusData?.activeSession?.id }),
      });
      showSuccess({
        title: 'Checked Out Successfully!',
        message: 'Your Out-Time and workout duration have been saved.',
        details: [
          { label: 'In-Time', value: formatTime(res.log?.check_in_time) },
          { label: 'Out-Time', value: formatTime(res.log?.check_out_time) },
          { label: 'Workout Duration', value: formatDuration(res.log?.duration_minutes) },
        ],
      });
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const activeSession = statusData?.activeSession;
  const missed = statusData?.missedCheckouts;
  let elapsedLabel = '00:00:00';
  if (activeSession) {
    const diffSec = Math.max(0, Math.floor((nowTick - new Date(activeSession.check_in_time).getTime()) / 1000));
    const hrs = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    elapsedLabel = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  const pendingInvoices = invoices.filter((i) => i.status !== 'paid');
  const pendingTotal = pendingInvoices.reduce((acc, i) => acc + Number(i.balance_due || 0), 0);

  // Build 5-day calendar strip centered on today (Screen 2 style)
  const dayStrip = [-2, -1, 0, 1, 2].map((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return {
      isToday: offset === 0,
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayNum: d.getDate(),
    };
  });

  const visits = statusData?.monthSummary?.visits ?? 0;
  const totalMins = statusData?.monthSummary?.total_minutes ?? 0;

  if (loading) {
    return <div className="py-16 text-center text-sm text-white/55">Loading your gym dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header + Apple Calendar Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {profile?.profile_image ? (
            <img
              src={profile.profile_image}
              alt={user?.full_name}
              className="h-14 w-14 rounded-full object-cover border-2 border-white/15 shadow-md"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#FF9A5A] to-[#E56717] text-base font-extrabold text-white shadow-md">
              {user?.full_name?.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-white/55">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Recent <span className="font-normal italic text-white/60">Activity</span>
            </h2>
            <p className="text-xs text-white/55">
              ID: {profile?.member_code || '—'} • {profile?.fitness_goal || 'General Fitness'}
            </p>
          </div>
        </div>

        {/* 5-Day Date Pill Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {dayStrip.map((d) => (
            <div
              key={d.dayNum}
              className={`flex flex-col items-center justify-center rounded-[20px] px-4 py-2.5 min-w-[58px] transition-all ${
                d.isToday
                  ? 'bg-[#E56717] text-white shadow-lg shadow-[#E56717]/30'
                  : 'glass-subtle text-white/80'
              }`}
            >
              <span className={`text-[11px] font-semibold ${d.isToday ? 'text-white/90' : 'text-white/50'}`}>
                {d.weekday}
              </span>
              <span className="text-sm font-extrabold">{d.dayNum}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}

      {missed?.warn && (
        <div className="flex items-start gap-3 rounded-[22px] border border-amber-400/35 bg-amber-400/10 backdrop-blur-xl p-4 sm:p-5 shadow-[0_10px_30px_-12px_rgba(251,191,36,0.35)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-amber-200">
              You have not checked out for your last {missed.streak} visits
            </p>
            <p className="mt-0.5 text-xs text-amber-100/75 leading-relaxed">
              You are continuously not checking out, so the system closed those sessions automatically at 12:00 AM and
              your workout time is not accurate. Please tap <span className="font-bold">Check Out Now</span> before you
              leave the gym.
            </p>
          </div>
        </div>
      )}

      <MembershipCountdown profile={profile} />

      {/* Dark Liquid Glass Check-In / Live Timer Panel (Screen 3 Style) */}
      <div className="relative overflow-hidden glass-dark p-6 sm:p-7">
        <img
          src="/images/workout-session.jpg"
          alt="Workout session"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#111216]/95 via-[#111216]/80 to-[#E56717]/20" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold ${
                  activeSession ? 'bg-[#E56717] text-white' : 'bg-white/15 text-white'
                }`}
              >
                {activeSession && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                {activeSession ? 'Session In Progress' : 'Ready to Train'}
              </span>
              {activeSession && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-mono font-bold text-[#FF9A5A]">
                  <Timer className="h-3.5 w-3.5" />
                  {elapsedLabel}
                </span>
              )}
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-white">
              {activeSession
                ? `Checked In since ${formatTime(activeSession.check_in_time)}`
                : 'Start Your Gym Session'}
            </h3>
            <p className="text-xs sm:text-sm text-white/70 max-w-lg">
              {activeSession
                ? 'Tap Check Out when you wrap up to save your Out-Time and total duration.'
                : 'Tap Check In Now to record your gym In-Time and start tracking your workout.'}
            </p>
          </div>

          {activeSession ? (
            <button
              onClick={handleCheckOut}
              disabled={busy}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#E56717] px-7 py-4 text-sm font-extrabold text-white hover:bg-[#C8560F] transition-all disabled:opacity-50 shadow-xl shadow-[#E56717]/35"
            >
              <LogOut className="h-5 w-5" />
              {busy ? 'Updating...' : 'Check Out Now'}
            </button>
          ) : (
            <button
              onClick={handleCheckIn}
              disabled={busy}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-extrabold text-[#111317] hover:bg-[#FFD2B3] transition-all disabled:opacity-50 shadow-xl"
            >
              <LogIn className="h-5 w-5 text-[#E56717]" />
              {busy ? 'Checking In...' : 'Check In Now'}
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid with Progress Rings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Visits This Month"
          value={visits}
          subtitle="Monthly target: 20 visits"
          icon={Flame}
          accent="orange"
          to="/member/visits"
          ringPercent={Math.min(100, Math.round((visits / 20) * 100))}
        />
        <StatCard
          title="Workout Duration"
          value={formatDuration(totalMins)}
          subtitle="Monthly target: 20 hrs"
          icon={Clock}
          accent="black"
          ringPercent={Math.min(100, Math.round((totalMins / 1200) * 100))}
        />
        <StatCard
          title="Current Plan"
          value={profile?.plan_name || 'Standard'}
          subtitle={profile?.plan_end_date ? `Valid till ${formatDate(profile.plan_end_date)}` : 'Active membership'}
          icon={CalendarCheck}
          accent="peach"
        />
        <StatCard
          title="Pending Fee Due"
          value={formatCurrency(pendingTotal, currency)}
          subtitle={pendingTotal > 0 ? `${pendingInvoices.length} pending invoice(s)` : 'All fees settled'}
          icon={CreditCard}
          accent={pendingTotal > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Recent Attendance + Quick Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-extrabold text-white">Recent Sessions</h3>
            <Link to="/member/attendance" className="text-xs font-bold text-[#FF8F4A] hover:underline">
              Full History →
            </Link>
          </div>
          {recentLogs.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/50">No attendance sessions logged yet.</p>
          ) : (
            <div className="divide-y divide-white/10">
              {recentLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{formatDate(log.check_in_time)}</p>
                    <p className="text-xs text-white/55">
                      In: <span className="font-bold text-[#FF8F4A]">{formatTime(log.check_in_time)}</span>
                      {' • '}
                      Out: {log.check_out_time ? formatTime(log.check_out_time) : 'Active'}
                      {log.auto_checked_out && (
                        <span className="ml-1.5 font-bold text-amber-300">• Auto check-out</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={log.check_out_time ? 'completed' : 'in_gym'} />
                    <p className="mt-1 text-xs font-semibold text-white/80">{formatDuration(log.duration_minutes)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="text-base font-extrabold text-white">Quick Actions</h3>
          <Link
            to="/member/profile"
            className="flex items-center justify-between rounded-2xl bg-white/8 border border-white/15 p-3.5 hover:border-[#E56717]/50 transition-all shadow-sm"
          >
            <div>
              <p className="text-sm font-bold text-white">Maintain My Profile</p>
              <p className="text-xs text-white/55">Update photo, metrics & goals</p>
            </div>
            <ArrowRight className="h-4 w-4 text-[#E56717]" />
          </Link>
          <Link
            to="/member/fees"
            className="flex items-center justify-between rounded-2xl bg-white/8 border border-white/15 p-3.5 hover:border-[#E56717]/50 transition-all shadow-sm"
          >
            <div>
              <p className="text-sm font-bold text-white">Fees & Payment Receipts</p>
              <p className="text-xs text-white/55">View dues & download receipts</p>
            </div>
            <ArrowRight className="h-4 w-4 text-[#E56717]" />
          </Link>
          {gym && (
            <div className="rounded-2xl glass-chip text-white p-4 text-xs space-y-1">
              <p className="font-bold text-[#FF9A5A]">{gym.gym_name}</p>
              <p className="text-white/75">{gym.opening_hours}</p>
              <p className="text-white/60">{gym.phone}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

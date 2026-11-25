import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Activity,
  IndianRupee,
  AlertCircle,
  Clock,
  LogIn,
  LogOut,
  ArrowUpRight,
  Flame,
} from 'lucide-react';
import { apiFetch, formatCurrency, formatDate, formatTime } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTransactionPopup } from '../../context/TransactionPopupContext';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import Avatar from '../../components/Avatar';

export default function OwnerDashboard() {
  const { gym } = useAuth();
  const { showSuccess } = useTransactionPopup();
  const currency = gym?.currency_symbol || '₹';

  const [overview, setOverview] = useState(null);
  const [liveStatus, setLiveStatus] = useState({ activeMembers: [], totalToday: 0 });
  const [members, setMembers] = useState([]);
  const [quickMemberId, setQuickMemberId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadAll() {
    try {
      const [ov, live, mem] = await Promise.all([
        apiFetch('/reports/overview'),
        apiFetch('/attendance/status'),
        apiFetch('/members?status=active'),
      ]);
      setOverview(ov);
      setLiveStatus(live);
      setMembers(mem.members || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleQuickCheckIn(e) {
    e.preventDefault();
    if (!quickMemberId) return;
    setError('');
    try {
      const target = members.find((m) => String(m.id) === String(quickMemberId));
      const res = await apiFetch('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ memberId: Number(quickMemberId), notes: 'Front-desk check-in' }),
      });
      setQuickMemberId('');
      showSuccess({
        title: 'Check-In Completed Successfully!',
        message: `${target?.full_name || 'Member'} is now checked in.`,
        details: [{ label: 'In-Time', value: formatTime(res.log?.check_in_time) }],
      });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCheckOut(attendanceId) {
    setError('');
    try {
      const res = await apiFetch('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ attendanceId }),
      });
      showSuccess({
        title: 'Check-Out Completed Successfully!',
        message: 'Member out-time and workout duration have been recorded.',
        details: [
          { label: 'Out-Time', value: formatTime(res.log?.check_out_time) },
          { label: 'Duration', value: `${res.log?.duration_minutes ?? 1} mins` },
        ],
      });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-white/55">Loading gym dashboard...</div>;
  }

  const kpis = overview?.kpis || {};
  const maxTrend = Math.max(1, ...(overview?.dailyTrend || []).map((d) => d.checkins));
  const activePct = kpis.totalMembers ? Math.round((kpis.activeMembers / kpis.totalMembers) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Apple-Style Hero Studio Banner */}
      <div className="relative overflow-hidden rounded-[30px] border border-white/15 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] bg-[#0c0c0e]">
        <img
          src="/images/gym-studio.jpg"
          alt="Gym Studio"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#111317]/95 via-[#111317]/70 to-[#E56717]/30" />

        <div className="relative z-10 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#FF9A5A] flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {gym?.gym_name || 'IronPulse Studio'}{' '}
              <span className="font-normal italic text-[#FFD2B3]">Overview</span>
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-white/75">
              {liveStatus.activeMembers.length} athletes on the floor right now • {kpis.todayCheckins ?? 0} check-ins today
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              to="/owner/members"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/25 transition-colors"
            >
              Onboard / Members
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/owner/fees"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#E56717] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#C8560F] shadow-lg shadow-[#E56717]/35 transition-colors"
            >
              Collect Fees
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}

      {/* KPI Grid with Progress Rings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Currently In Gym"
          value={kpis.currentlyInGym ?? 0}
          subtitle={`${kpis.todayCheckins ?? 0} check-ins today`}
          icon={Activity}
          accent="orange"
          to="/owner/insights/in-gym"
          ringPercent={kpis.activeMembers ? Math.min(100, Math.round(((kpis.currentlyInGym ?? 0) / kpis.activeMembers) * 100)) : 0}
        />
        <StatCard
          title="Active Members"
          value={kpis.activeMembers ?? 0}
          subtitle={`${kpis.totalMembers ?? 0} total • ${kpis.expiredMembers ?? 0} expired`}
          icon={Users}
          accent="black"
          to="/owner/insights/active-members"
          ringPercent={activePct}
        />
        <StatCard
          title="Monthly Collection"
          value={formatCurrency(kpis.monthlyRevenue, currency)}
          subtitle="Current month revenue"
          icon={IndianRupee}
          accent="peach"
          to="/owner/insights/collection"
        />
        <StatCard
          title="Pending Dues"
          value={formatCurrency(kpis.pendingDues, currency)}
          subtitle={`${kpis.pendingInvoicesCount ?? 0} unpaid invoices`}
          icon={AlertCircle}
          accent="rose"
          to="/owner/insights/pending-dues"
        />
      </div>

      {/* Dark Liquid Glass Live Floor Panel + Orange Capsule 7-Day Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Live Floor Check-In / Out (Screen 3 Dark Glass Inspiration) */}
        <div className="lg:col-span-2 glass-dark p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E56717] px-3 py-1 text-[11px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Live Floor Attendance
              </span>
              <h3 className="mt-2 text-lg font-extrabold text-white">Quick Check-In & Check-Out</h3>
            </div>
            <Link to="/owner/attendance" className="text-xs font-semibold text-[#FF9A5A] hover:underline">
              Full Attendance Log →
            </Link>
          </div>

          <form onSubmit={handleQuickCheckIn} className="flex flex-col sm:flex-row gap-2.5">
            <select
              value={quickMemberId}
              onChange={(e) => setQuickMemberId(e.target.value)}
              className="flex-1 rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm text-white focus:border-[#E56717] focus:outline-none"
            >
              <option value="" className="glass-chip">Select member to mark In-Time...</option>
              {members
                .filter((m) => !m.open_attendance_id)
                .map((m) => (
                  <option key={m.id} value={m.id} className="glass-chip">
                    {m.full_name} ({m.member_code})
                  </option>
                ))}
            </select>
            <button
              type="submit"
              disabled={!quickMemberId}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#E56717] px-5 py-3 text-xs font-bold text-white hover:bg-[#C8560F] disabled:opacity-40 transition-colors shadow-lg shadow-[#E56717]/25"
            >
              <LogIn className="h-4 w-4" />
              Mark In-Time
            </button>
          </form>

          <div className="space-y-3">
            <Link to="/owner/insights/in-gym" className="text-[11px] font-bold uppercase tracking-wider text-white/55 hover:text-[#FF9A5A]">
              Currently Inside ({liveStatus.activeMembers.length}) →
            </Link>
            {liveStatus.activeMembers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 py-8 text-center text-xs text-white/50">
                No members currently checked in.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {liveStatus.activeMembers.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 p-3.5"
                  >
                    <Avatar src={a.profile_image} name={a.full_name} size="md" ring />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white truncate">{a.full_name}</p>
                        <StatusBadge status="in_gym" />
                      </div>
                      <p className="mt-1 text-xs text-white/65 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-[#FF9A5A]" />
                        In: {formatTime(a.check_in_time)} • {a.member_code}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCheckOut(a.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white text-[#111317] px-3.5 py-2 text-xs font-bold hover:bg-[#E56717]/20 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5 text-[#FF8F4A]" />
                      Out
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 7-Day Orange Capsule Bar Chart (Screen 2 Inspiration) */}
        <div className="glass-card p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-white">Recent Activity</h3>
              <p className="text-xs text-white/55">7-day check-ins capsule view</p>
            </div>
            <span className="rounded-full glass-chip px-3 py-1 text-[11px] font-bold text-white">7 Days</span>
          </div>

          <div className="my-6 flex items-end justify-between gap-2 h-40">
            {(overview?.dailyTrend || []).map((d) => {
              const pct = Math.round((d.checkins / maxTrend) * 100);
              const label = new Date(d.day).toLocaleDateString('en-IN', { weekday: 'narrow' });
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[11px] font-bold text-white">{d.checkins}</span>
                  <div className="w-full max-w-[26px] rounded-full bg-[#E56717]/15 h-28 flex items-end p-0.5 overflow-hidden">
                    <div
                      className="w-full rounded-full bg-gradient-to-t from-[#E56717] to-[#C8560F] transition-all"
                      style={{ height: `${Math.max(16, pct)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-white/55">{label}</span>
                </div>
              );
            })}
          </div>

          <Link
            to="/owner/reports"
            className="text-center rounded-full btn-papaya py-2.5 text-xs font-bold text-white hover:brightness-110 transition-colors"
          >
            Open Detailed Reports
          </Link>
        </div>
      </div>

      {/* Expiring Plans & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-extrabold text-white">Expiring Memberships (14 Days)</h3>
            <Link to="/owner/members" className="text-xs font-bold text-[#FF8F4A] hover:underline">
              Members →
            </Link>
          </div>
          {(overview?.expiringSoon || []).length === 0 ? (
            <p className="py-6 text-center text-xs text-white/55">No memberships expiring in the next 14 days.</p>
          ) : (
            <div className="divide-y divide-white/10">
              {overview.expiringSoon.map((m) => (
                <div key={m.id} className="py-3 flex items-center gap-3">
                  <Avatar src={m.profile_image} name={m.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{m.full_name}</p>
                    <p className="text-xs text-white/55 truncate">
                      {m.plan_name} • {m.phone || m.member_code}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#E56717]/20 px-3 py-1 text-xs font-bold text-[#FF8F4A]">
                    Ends {formatDate(m.plan_end_date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-extrabold text-white">Recent Check-Ins</h3>
            <Link to="/owner/attendance" className="text-xs font-bold text-[#FF8F4A] hover:underline">
              Full Log →
            </Link>
          </div>
          <div className="divide-y divide-white/10">
            {(overview?.recentCheckins || []).slice(0, 6).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center gap-3">
                <Avatar src={log.profile_image} name={log.full_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{log.full_name}</p>
                  <p className="text-xs text-white/55">
                    In: {formatTime(log.check_in_time)}
                    {log.check_out_time ? ` • Out: ${formatTime(log.check_out_time)}` : ''}
                  </p>
                </div>
                <StatusBadge status={log.check_out_time ? 'completed' : 'in_gym'} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

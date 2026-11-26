import { useEffect, useState } from 'react';
import { Download, Clock, Users, IndianRupee, BarChart3 } from 'lucide-react';
import { apiFetch, formatCurrency, formatDate, formatDuration, getToken, localDateKey } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import Avatar from '../../components/Avatar';

export default function OwnerReports() {
  const { gym } = useAuth();
  const currency = gym?.currency_symbol || '₹';

  const todayStr = localDateKey();
  const thirtyAgo = localDateKey(new Date(Date.now() - 30 * 86400000));

  const [fromDate, setFromDate] = useState(thirtyAgo);
  const [toDate, setToDate] = useState(todayStr);
  const [attendanceReport, setAttendanceReport] = useState(null);
  const [revenueReport, setRevenueReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadReports() {
    setLoading(true);
    setError('');
    try {
      const [att, rev] = await Promise.all([
        apiFetch(`/reports/attendance?from=${fromDate}&to=${toDate}`),
        apiFetch(`/reports/revenue?from=${fromDate}&to=${toDate}`),
      ]);
      setAttendanceReport(att);
      setRevenueReport(rev);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [fromDate, toDate]);

  async function downloadCsv(type) {
    const res = await fetch(`/api/reports/export?type=${type}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-${type}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxPeak = Math.max(1, ...(attendanceReport?.peakHours || []).map((h) => h.visits));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            Analytics <span className="font-normal italic text-white/60">& Reports</span>
          </h2>
          <p className="text-xs sm:text-sm text-white/55">
            Attendance trends, peak hours, fee collection breakdown, and CSV exports
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadCsv('attendance')}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/8 border border-white/12 px-4 py-2 text-xs font-bold text-white hover:glass-chip hover:text-white transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-[#E56717]" />
            Attendance CSV
          </button>
          <button
            onClick={() => downloadCsv('revenue')}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/8 border border-white/12 px-4 py-2 text-xs font-bold text-white hover:glass-chip hover:text-white transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-[#E56717]" />
            Payments CSV
          </button>
          <button
            onClick={() => downloadCsv('members')}
            className="inline-flex items-center gap-1.5 rounded-full btn-papaya px-4 py-2 text-xs font-bold text-white hover:brightness-110 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Members CSV
          </button>
        </div>
      </div>

      {/* Date Range */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-white/55">Report Range:</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="input-glass px-3.5 py-2 text-xs font-semibold"
        />
        <span className="text-xs text-white/50">to</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="input-glass px-3.5 py-2 text-xs font-semibold"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-white/55">Generating reports...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Total Visits"
              value={attendanceReport?.summary?.total_visits ?? 0}
              subtitle="In selected range"
              icon={BarChart3}
              accent="orange"
            />
            <StatCard
              title="Unique Members"
              value={attendanceReport?.summary?.unique_members ?? 0}
              subtitle="Active attendees"
              icon={Users}
              accent="black"
            />
            <StatCard
              title="Avg Workout Time"
              value={formatDuration(attendanceReport?.summary?.avg_duration_minutes ?? 0)}
              subtitle="Per session"
              icon={Clock}
              accent="peach"
            />
            <StatCard
              title="Fees Collected"
              value={formatCurrency(revenueReport?.totals?.total_collected, currency)}
              subtitle={`${revenueReport?.totals?.payment_count ?? 0} payments`}
              icon={IndianRupee}
              accent="emerald"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Peak Gym Hours */}
            <div className="glass-card p-5 space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-white">Peak Gym Hours</h3>
                <p className="text-xs text-white/55">Check-in distribution by hour of day</p>
              </div>
              {(attendanceReport?.peakHours || []).length === 0 ? (
                <p className="text-xs text-white/50 py-6 text-center">No check-in data in range.</p>
              ) : (
                <div className="space-y-3">
                  {attendanceReport.peakHours.map((h) => {
                    const pct = Math.round((h.visits / maxPeak) * 100);
                    const hourLabel = `${h.hour % 12 || 12}:00 ${h.hour >= 12 ? 'PM' : 'AM'}`;
                    return (
                      <div key={h.hour} className="flex items-center gap-3 text-xs">
                        <span className="w-16 font-semibold text-white/80 shrink-0">{hourLabel}</span>
                        <div className="flex-1 h-3 rounded-full bg-[#E56717]/15 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#E56717] to-[#C8560F]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-extrabold text-white">{h.visits}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment Method Breakdown */}
            <div className="glass-dark p-5 space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-white">Revenue by Payment Method</h3>
                <p className="text-xs text-white/60">Collection split across Cash, UPI, Card & Bank</p>
              </div>
              {(revenueReport?.byMethod || []).length === 0 ? (
                <p className="text-xs text-white/50 py-6 text-center">No payments recorded in range.</p>
              ) : (
                <div className="space-y-3">
                  {revenueReport.byMethod.map((m) => (
                    <div
                      key={m.payment_method}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/8 px-4 py-3.5"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{m.payment_method}</p>
                        <p className="text-xs text-white/60">{m.count} transactions</p>
                      </div>
                      <p className="text-base font-extrabold text-[#FF9A5A]">
                        {formatCurrency(m.total, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="glass-card p-5">
              <h3 className="text-base font-extrabold text-white mb-3">Top Regular Members</h3>
              <div className="divide-y divide-white/10">
                {(attendanceReport?.topMembers || []).map((m, idx) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full glass-chip text-xs font-extrabold text-[#E56717]">
                        {idx + 1}
                      </span>
                      <Avatar src={m.profile_image} name={m.full_name} size="sm" />
                      <div>
                        <p className="font-bold text-white">{m.full_name}</p>
                        <p className="text-xs text-white/55">{m.member_code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-[#FF8F4A]">{m.visits} visits</p>
                      <p className="text-xs text-white/55">{formatDuration(m.total_minutes)} total</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-base font-extrabold text-white mb-3">Pending & Overdue Fees</h3>
              {(revenueReport?.outstanding || []).length === 0 ? (
                <p className="py-6 text-center text-xs text-white/55">All member dues are cleared!</p>
              ) : (
                <div className="divide-y divide-white/10">
                  {revenueReport.outstanding.map((o) => (
                    <div key={o.id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
                      <Avatar src={o.profile_image} name={o.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate">{o.full_name}</p>
                        <p className="text-xs text-white/55 truncate">
                          {o.title} • Due {formatDate(o.due_date)}
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="font-extrabold text-[#FF8F4A]">{formatCurrency(o.balance_due, currency)}</p>
                        <StatusBadge status={o.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { apiFetch, formatDate, formatDuration, formatTime } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';

export default function CustomerAttendance() {
  const [logs, setLogs] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    apiFetch(`/attendance?${params.toString()}`)
      .then((res) => setLogs(res.logs || []))
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const totalMinutes = logs.reduce((acc, l) => acc + Number(l.duration_minutes || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            My Attendance <span className="font-normal italic text-white/60">History</span>
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full glass-chip px-4 py-2 text-xs text-white shadow-sm">
          <Clock className="h-4 w-4 text-[#E56717]" />
          <span className="text-white/70">Total:</span>
          <span className="font-bold">
            {logs.length} visits ({formatDuration(totalMinutes)})
          </span>
        </div>
      </div>

      <div className="glass-card p-4 flex flex-wrap items-center gap-2.5">
        <Calendar className="h-4 w-4 text-[#E56717]" />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="input-glass px-3.5 py-1.5 text-xs font-semibold"
        />
        <span className="text-xs text-white/50">to</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="input-glass px-3.5 py-1.5 text-xs font-semibold"
        />
        {(fromDate || toDate) && (
          <button
            onClick={() => {
              setFromDate('');
              setToDate('');
            }}
            className="text-xs font-bold text-[#FF8F4A] hover:underline ml-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden glass-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-[11px] font-bold uppercase tracking-wider text-white/55">
            <tr>
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">In Time</th>
              <th className="px-5 py-4">Out Time</th>
              <th className="px-5 py-4">Duration</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-white/55">
                  Loading logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-white/50">
                  No attendance logs found.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-white/5">
                  <td className="px-5 py-3.5 font-bold text-white">{formatDate(l.check_in_time)}</td>
                  <td className="px-5 py-3.5 text-[#FF8F4A] font-bold">{formatTime(l.check_in_time)}</td>
                  <td className="px-5 py-3.5 text-white/80">
                    {l.check_out_time ? formatTime(l.check_out_time) : '—'}
                    {l.auto_checked_out && <span className="ml-1.5 text-[11px] font-bold text-amber-300">Auto</span>}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-white">{formatDuration(l.duration_minutes)}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={l.check_out_time ? 'completed' : 'in_gym'} />
                  </td>
                  <td className="px-5 py-3.5 text-xs text-white/55">{l.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {logs.map((l) => (
          <div key={l.id} className="glass-card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">{formatDate(l.check_in_time)}</p>
              <StatusBadge status={l.check_out_time ? 'completed' : 'in_gym'} />
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/6 border border-white/15 p-3 text-xs">
              <div>
                <p className="text-white/50">In Time</p>
                <p className="font-bold text-[#FF8F4A]">{formatTime(l.check_in_time)}</p>
              </div>
              <div>
                <p className="text-white/50">Out Time</p>
                <p className="font-bold text-white">
                  {l.check_out_time ? formatTime(l.check_out_time) : 'Active'}
                </p>
              </div>
              <div>
                <p className="text-white/50">Duration</p>
                <p className="font-bold text-white">{formatDuration(l.duration_minutes)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

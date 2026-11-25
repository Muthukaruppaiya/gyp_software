import { useEffect, useState } from 'react';
import { LogIn, LogOut, Search, Calendar } from 'lucide-react';
import { apiFetch, formatDate, formatDuration, formatTime } from '../../api/client';
import { useTransactionPopup } from '../../context/TransactionPopupContext';
import StatusBadge from '../../components/StatusBadge';
import Avatar from '../../components/Avatar';

export default function OwnerAttendance() {
  const { showSuccess } = useTransactionPopup();
  const [logs, setLogs] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [notes, setNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const [logRes, memRes] = await Promise.all([
        apiFetch(`/attendance?${params.toString()}`),
        apiFetch('/members?status=active'),
      ]);
      setLogs(logRes.logs || []);
      setMembers(memRes.members || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [statusFilter, fromDate, toDate]);

  async function handleCheckIn(e) {
    e.preventDefault();
    if (!selectedMemberId) return;
    setError('');
    try {
      const target = members.find((m) => String(m.id) === String(selectedMemberId));
      const res = await apiFetch('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ memberId: Number(selectedMemberId), notes: notes || 'Desk check-in' }),
      });
      setSelectedMemberId('');
      setNotes('');
      showSuccess({
        title: 'Check-In Recorded Successfully!',
        message: `${target?.full_name || 'Member'} checked in.`,
        details: [{ label: 'In-Time', value: formatTime(res.log?.check_in_time) }],
      });
      loadData();
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
        message: 'Member out-time and workout duration have been saved.',
        details: [
          { label: 'Out-Time', value: formatTime(res.log?.check_out_time) },
          { label: 'Duration', value: formatDuration(res.log?.duration_minutes) },
        ],
      });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredLogs = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.full_name?.toLowerCase().includes(q) ||
      l.member_code?.toLowerCase().includes(q) ||
      l.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white">
          Attendance <span className="font-normal italic text-white/60">Management</span>
        </h2>
        <p className="text-xs sm:text-sm text-white/55">
          Track member In-Time, Out-Time, and total workout duration
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}

      {/* Manual Check-In Bar */}
      <form
        onSubmit={handleCheckIn}
        className="glass-card p-4 grid grid-cols-1 sm:grid-cols-12 gap-3"
      >
        <div className="sm:col-span-5">
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="input-glass w-full px-4 py-3 text-sm"
          >
            <option value="">Select member for Check-In...</option>
            {members
              .filter((m) => !m.open_attendance_id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.member_code})
                </option>
              ))}
          </select>
        </div>
        <div className="sm:col-span-4">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Session note (optional)"
            className="input-glass w-full px-4 py-3 text-sm"
          />
        </div>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={!selectedMemberId}
            className="flex w-full items-center justify-center gap-2 rounded-full btn-papaya px-4 py-3 text-sm font-bold text-white hover:brightness-110 disabled:opacity-40 shadow-md"
          >
            <LogIn className="h-4 w-4 text-white" />
            Check In
          </button>
        </div>
      </form>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-white/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member name or code..."
            className="input-glass w-full pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-glass px-3.5 py-2.5 text-xs font-semibold"
          >
            <option value="all">All Sessions</option>
            <option value="active">Currently In Gym</option>
            <option value="completed">Checked Out</option>
          </select>
          <div className="input-glass flex items-center gap-1.5 px-3 py-2">
            <Calendar className="h-4 w-4 text-[#E56717]" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none"
            />
            <span className="text-white/50 text-xs">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Desktop Glass Table */}
      <div className="hidden md:block overflow-hidden glass-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-[11px] font-bold uppercase tracking-wider text-white/55">
            <tr>
              <th className="px-5 py-4">Member</th>
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">In Time</th>
              <th className="px-5 py-4">Out Time</th>
              <th className="px-5 py-4">Duration</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-white/55">
                  Loading attendance logs...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-white/50">
                  No attendance records match your filters.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar src={log.profile_image} name={log.full_name} size="sm" ring={!log.check_out_time} />
                      <div>
                        <p className="font-bold text-white">{log.full_name}</p>
                        <p className="text-xs text-white/55">
                          {log.member_code}
                          {log.auto_checked_out && <span className="ml-1.5 font-bold text-amber-300">• Auto out</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-white/80">{formatDate(log.check_in_time)}</td>
                  <td className="px-5 py-3.5 font-bold text-[#FF8F4A]">{formatTime(log.check_in_time)}</td>
                  <td className="px-5 py-3.5 text-white/80">
                    {log.check_out_time ? formatTime(log.check_out_time) : '—'}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-white">{formatDuration(log.duration_minutes)}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={log.check_out_time ? 'completed' : 'in_gym'} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {!log.check_out_time ? (
                      <button
                        onClick={() => handleCheckOut(log.id)}
                        className="inline-flex items-center gap-1 rounded-full btn-papaya px-3.5 py-1.5 text-xs font-bold text-white hover:brightness-110 transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Check Out
                      </button>
                    ) : (
                      <span className="text-xs text-white/50 capitalize">via {log.marked_by}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredLogs.map((log) => (
          <div key={log.id} className="glass-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <Avatar src={log.profile_image} name={log.full_name} size="md" ring={!log.check_out_time} />
                <div>
                  <p className="text-sm font-bold text-white">{log.full_name}</p>
                  <p className="text-xs text-white/55">
                    {log.member_code} • {formatDate(log.check_in_time)}
                    {log.auto_checked_out && <span className="ml-1.5 font-bold text-amber-300">• Auto out</span>}
                  </p>
                </div>
              </div>
              <StatusBadge status={log.check_out_time ? 'completed' : 'in_gym'} />
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/6 border border-white/15 p-3 text-xs">
              <div>
                <p className="text-white/50">In Time</p>
                <p className="font-bold text-[#FF8F4A]">{formatTime(log.check_in_time)}</p>
              </div>
              <div>
                <p className="text-white/50">Out Time</p>
                <p className="font-bold text-white">
                  {log.check_out_time ? formatTime(log.check_out_time) : 'Active'}
                </p>
              </div>
              <div>
                <p className="text-white/50">Duration</p>
                <p className="font-bold text-white">{formatDuration(log.duration_minutes)}</p>
              </div>
            </div>
            {!log.check_out_time && (
              <button
                onClick={() => handleCheckOut(log.id)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-full glass-chip py-2.5 text-xs font-bold text-white"
              >
                <LogOut className="h-3.5 w-3.5 text-[#E56717]" />
                Mark Out-Time Now
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

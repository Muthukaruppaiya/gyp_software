import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Activity, AlertCircle, ArrowLeft, Clock, IndianRupee, LogOut, Timer, Users } from 'lucide-react';
import { apiFetch, formatCurrency, formatDate, formatDuration, formatTime } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTransactionPopup } from '../../context/TransactionPopupContext';
import Avatar from '../../components/Avatar';
import StatusBadge from '../../components/StatusBadge';

const VIEWS = {
  'in-gym': { title: 'Currently In Gym', subtitle: 'Members on the floor right now', icon: Activity },
  'active-members': { title: 'Active Members', subtitle: 'Everyone with a running membership', icon: Users },
  collection: { title: 'Monthly Collection', subtitle: 'Payments received this month', icon: IndianRupee },
  'pending-dues': { title: 'Pending Dues', subtitle: 'Unpaid and partially paid invoices', icon: AlertCircle },
};

function localISODate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function elapsed(fromIso, now) {
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

function Empty({ children }) {
  return (
    <div className="glass-card py-14 text-center text-sm text-white/55">{children}</div>
  );
}

function InGymView() {
  const { showSuccess } = useTransactionPopup();
  const [active, setActive] = useState([]);
  const [todayDone, setTodayDone] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  async function load() {
    try {
      const today = localISODate();
      const [st, logs] = await Promise.all([
        apiFetch('/attendance/status'),
        apiFetch(`/attendance?from=${today}&to=${today}&status=completed&limit=200`),
      ]);
      setActive(st.activeMembers || []);
      setTodayDone(logs.logs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    const r = setInterval(load, 60000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, []);

  async function checkOut(a) {
    setError('');
    try {
      const res = await apiFetch('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ attendanceId: a.id }),
      });
      showSuccess({
        title: 'Check-Out Completed Successfully!',
        message: `${a.full_name} has been checked out.`,
        details: [
          { label: 'In-Time', value: formatTime(res.log?.check_in_time) },
          { label: 'Out-Time', value: formatTime(res.log?.check_out_time) },
          { label: 'Duration', value: formatDuration(res.log?.duration_minutes) },
        ],
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="py-16 text-center text-sm text-white/55">Loading live floor...</p>;

  return (
    <div className="space-y-6">
      {error && <ErrorBox msg={error} />}

      {active.length === 0 ? (
        <Empty>No members are checked in right now.</Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {active.map((a) => (
            <div key={a.id} className="glass-card p-5 flex flex-col items-center text-center gap-3">
              <Avatar src={a.profile_image} name={a.full_name} size="xl" ring />
              <div>
                <p className="text-base font-extrabold text-white">{a.full_name}</p>
                <p className="text-xs text-white/55">
                  {a.member_code}
                  {a.plan_name ? ` • ${a.plan_name}` : ''}
                </p>
              </div>
              <StatusBadge status="in_gym" />
              <div className="grid grid-cols-2 gap-2 w-full">
                <div className="rounded-2xl bg-white/6 border border-white/10 p-3">
                  <p className="text-[11px] font-semibold text-white/50 flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" /> In-Time
                  </p>
                  <p className="mt-0.5 text-sm font-extrabold text-[#FF8F4A]">{formatTime(a.check_in_time)}</p>
                </div>
                <div className="rounded-2xl bg-white/6 border border-white/10 p-3">
                  <p className="text-[11px] font-semibold text-white/50 flex items-center justify-center gap-1">
                    <Timer className="h-3 w-3" /> On floor
                  </p>
                  <p className="mt-0.5 text-sm font-extrabold font-mono text-white">{elapsed(a.check_in_time, now)}</p>
                </div>
              </div>
              <button
                onClick={() => checkOut(a)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full btn-papaya py-2.5 text-xs font-bold hover:brightness-110"
              >
                <LogOut className="h-4 w-4" /> Mark Out-Time
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card p-5">
        <h3 className="text-base font-extrabold text-white mb-3">Completed Today ({todayDone.length})</h3>
        {todayDone.length === 0 ? (
          <p className="py-6 text-center text-xs text-white/55">No completed sessions yet today.</p>
        ) : (
          <div className="divide-y divide-white/10">
            {todayDone.map((l) => (
              <div key={l.id} className="py-3 flex items-center gap-3">
                <Avatar src={l.profile_image} name={l.full_name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{l.full_name}</p>
                  <p className="text-xs text-white/55">
                    In {formatTime(l.check_in_time)} • Out {formatTime(l.check_out_time)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-white/80">{formatDuration(l.duration_minutes)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveMembersView() {
  const [members, setMembers] = useState([]);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiFetch(`/members?status=${filter}`)
      .then((r) => setMembers(r.members || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full bg-white/6 border border-white/10 p-1">
        {['active', 'expired', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-all ${
              filter === f ? 'glass-chip' : 'text-white/60 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {error && <ErrorBox msg={error} />}
      {loading ? (
        <p className="py-16 text-center text-sm text-white/55">Loading members...</p>
      ) : members.length === 0 ? (
        <Empty>No members in this list.</Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {members.map((m) => (
            <div key={m.id} className="glass-card p-4 flex items-center gap-4">
              <Avatar src={m.profile_image} name={m.full_name} size="lg" ring={!!m.open_attendance_id} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-white truncate">{m.full_name}</p>
                </div>
                <p className="text-xs text-white/55 truncate">
                  {m.member_code} • {m.plan_name || 'No plan'}
                </p>
                <p className="mt-1 text-[11px] text-white/50">
                  Valid till <span className="font-bold text-white/80">{formatDate(m.plan_end_date)}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge status={m.membership_status} />
                  {m.open_attendance_id && <StatusBadge status="in_gym" label={`In since ${formatTime(m.active_check_in_time)}`} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionView({ currency }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/fees/payments')
      .then((r) => setPayments(r.payments || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const thisMonth = useMemo(() => {
    const n = new Date();
    return payments.filter((p) => {
      const d = new Date(p.payment_date);
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
    });
  }, [payments]);
  const total = thisMonth.reduce((s, p) => s + Number(p.amount || 0), 0);

  if (loading) return <p className="py-16 text-center text-sm text-white/55">Loading payments...</p>;

  return (
    <div className="space-y-4">
      {error && <ErrorBox msg={error} />}
      <div className="glass-dark p-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white/70">
            {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
          <p className="text-3xl font-extrabold text-white">{formatCurrency(total, currency)}</p>
        </div>
        <p className="text-sm font-bold text-[#FFD2B3]">{thisMonth.length} payment(s)</p>
      </div>
      {thisMonth.length === 0 ? (
        <Empty>No payments received this month yet.</Empty>
      ) : (
        <div className="glass-card divide-y divide-white/10">
          {thisMonth.map((p) => (
            <div key={p.id} className="p-4 flex items-center gap-3">
              <Avatar src={p.profile_image} name={p.full_name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{p.full_name}</p>
                <p className="text-xs text-white/55 truncate">
                  {p.receipt_number} • {p.payment_method} • {formatDate(p.payment_date)}
                </p>
              </div>
              <p className="text-sm font-extrabold text-emerald-300">{formatCurrency(p.amount, currency)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingDuesView({ currency }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/fees/invoices')
      .then((r) => setInvoices((r.invoices || []).filter((i) => i.status !== 'paid')))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const total = invoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);

  if (loading) return <p className="py-16 text-center text-sm text-white/55">Loading dues...</p>;

  return (
    <div className="space-y-4">
      {error && <ErrorBox msg={error} />}
      <div className="glass-card p-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white/60">Total outstanding</p>
          <p className="text-3xl font-extrabold text-rose-300">{formatCurrency(total, currency)}</p>
        </div>
        <Link to="/owner/fees" className="rounded-full btn-papaya px-4 py-2.5 text-xs font-bold hover:brightness-110">
          Collect Fees
        </Link>
      </div>
      {invoices.length === 0 ? (
        <Empty>All invoices are settled.</Empty>
      ) : (
        <div className="glass-card divide-y divide-white/10">
          {invoices.map((i) => (
            <div key={i.id} className="p-4 flex items-center gap-3">
              <Avatar src={i.profile_image} name={i.full_name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{i.full_name}</p>
                <p className="text-xs text-white/55 truncate">
                  {i.title} • Due {formatDate(i.due_date)}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm font-extrabold text-white">{formatCurrency(i.balance_due, currency)}</p>
                <StatusBadge status={i.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
      {msg}
    </div>
  );
}

export default function OwnerInsights() {
  const { kind } = useParams();
  const { gym } = useAuth();
  const currency = gym?.currency_symbol || '₹';
  const view = VIEWS[kind];
  if (!view) return <Navigate to="/owner" replace />;
  const Icon = view.icon;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/owner"
          className="flex h-10 w-10 items-center justify-center rounded-full glass-pill text-white hover:bg-white/15"
          aria-label="Back to overview"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#E56717]/15 border border-[#E56717]/30 text-[#FF8F4A]">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">{view.title}</h2>
          <p className="text-xs text-white/55">{view.subtitle}</p>
        </div>
      </div>

      {kind === 'in-gym' && <InGymView />}
      {kind === 'active-members' && <ActiveMembersView />}
      {kind === 'collection' && <CollectionView currency={currency} />}
      {kind === 'pending-dues' && <PendingDuesView currency={currency} />}
    </div>
  );
}

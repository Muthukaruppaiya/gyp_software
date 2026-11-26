import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Building2,
  Users,
  Activity,
  IndianRupee,
  AlertCircle,
  Search,
  ChevronRight,
  Dumbbell,
  KeyRound,
} from 'lucide-react';
import { apiFetch, formatCurrency, formatDate } from '../../api/client';
import { useTransactionPopup } from '../../context/TransactionPopupContext';
import StatCard from '../../components/StatCard';
import Modal from '../../components/Modal';

export function GymStatusBadge({ gym }) {
  const [label, cls] =
    gym.status === 'suspended'
      ? ['Suspended', 'bg-rose-500/15 text-rose-300 border-rose-500/30']
      : !gym.owner_onboarded
      ? ['Awaiting activation', 'bg-amber-400/15 text-amber-200 border-amber-400/30']
      : ['Active', 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'];
  return <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${cls}`}>{label}</span>;
}

export function GymLogo({ gym, size = 'h-11 w-11' }) {
  return gym.logo_image ? (
    <img src={gym.logo_image} alt="" className={`${size} shrink-0 rounded-2xl object-cover border border-white/15`} />
  ) : (
    <span className={`${size} shrink-0 flex items-center justify-center rounded-2xl glass-chip`}>
      <Dumbbell className="h-5 w-5 text-[#E56717]" />
    </span>
  );
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Awaiting' },
  { id: 'suspended', label: 'Suspended' },
];

export default function AdminDashboard() {
  const { showSuccess } = useTransactionPopup();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ gym_name: '', owner_name: '', owner_phone: '', address: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setData(await apiFetch('/admin/overview'));
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const gyms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.gyms || []).filter((g) => {
      if (filter === 'active' && !(g.status === 'active' && g.owner_onboarded)) return false;
      if (filter === 'pending' && g.owner_onboarded) return false;
      if (filter === 'suspended' && g.status !== 'suspended') return false;
      if (!q) return true;
      return [g.gym_name, g.owner_name, g.owner_phone, g.address].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, search, filter]);

  async function createGym(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const res = await apiFetch('/admin/gyms', { method: 'POST', body: JSON.stringify(form) });
      setModalOpen(false);
      setForm({ gym_name: '', owner_name: '', owner_phone: '', address: '' });
      showSuccess({
        title: 'Gym Created!',
        message: `Share this code with ${res.gym.owner_name}. They sign in with it under "Access Code".`,
        copyValue: res.access_code,
        copyLabel: 'Owner Access Code',
        details: [
          { label: 'Gym', value: res.gym.gym_name },
          { label: 'Owner Phone', value: res.gym.owner_phone },
        ],
      });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const t = data?.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight text-white">
          Platform <span className="font-normal italic text-white/60">Overview</span>
        </h2>
        <button
          onClick={() => {
            setFormError('');
            setModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-full btn-papaya px-5 py-2.5 text-xs font-bold hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Add Gym
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">{error}</div>
      )}

      {!data ? (
        <p className="py-16 text-center text-sm text-white/55">Loading platform...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Gyms"
              value={t.gyms}
              subtitle={`${t.activeGyms} active • ${t.pendingActivation} awaiting`}
              icon={Building2}
              accent="orange"
            />
            <StatCard
              title="Members"
              value={t.members}
              subtitle={`${t.activeMembers} active plans`}
              icon={Users}
              accent="black"
            />
            <StatCard
              title="Check-ins Today"
              value={t.checkinsToday}
              subtitle={`${t.inGymNow} in gyms now`}
              icon={Activity}
              accent="emerald"
            />
            <StatCard
              title="Revenue (Month)"
              value={formatCurrency(t.revenueMonth)}
              subtitle={`${formatCurrency(t.pendingDues)} pending`}
              icon={IndianRupee}
              accent="peach"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="inline-flex max-w-full overflow-x-auto rounded-full glass-subtle p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-all ${
                    filter === f.id ? 'btn-papaya' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search gym, owner, phone"
                aria-label="Search gyms"
                className="input-glass w-full pl-10 pr-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {gyms.length === 0 ? (
            <div className="glass-card py-14 text-center text-sm text-white/55">
              {data.gyms.length === 0 ? 'No gyms yet.' : 'No gyms match.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {gyms.map((g) => (
                <Link key={g.id} to={`/admin/gyms/${g.id}`} className="glass-card group p-5 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <GymLogo gym={g} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-extrabold text-white">{g.gym_name}</p>
                      <p className="truncate text-xs text-white/55">
                        {g.owner_name} • {g.owner_phone}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:text-[#FF8F4A]" />
                  </div>

                  {!g.owner_onboarded ? (
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/8 px-3.5 py-2.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-200">
                        <KeyRound className="h-3.5 w-3.5" /> Access code
                      </span>
                      <span className="font-mono text-sm font-extrabold tracking-wider text-white">{g.onboarding_code}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Metric label="Members" value={g.total_members} />
                      <Metric label="Today" value={g.checkins_today} />
                      <Metric label="Month" value={formatCurrency(g.revenue_month, g.currency_symbol || '₹')} />
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2">
                    <GymStatusBadge gym={g} />
                    <span className="flex items-center gap-2 text-[11px] font-semibold text-white/45">
                      {Number(g.pending_dues) > 0 && (
                        <span className="flex items-center gap-1 text-rose-300">
                          <AlertCircle className="h-3 w-3" />
                          {formatCurrency(g.pending_dues, g.currency_symbol || '₹')}
                        </span>
                      )}
                      Since {formatDate(g.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Gym" maxWidth="max-w-md">
        {formError && (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
            {formError}
          </div>
        )}
        <form onSubmit={createGym} className="space-y-4">
          <AdminField label="Gym Name">
            <input
              required
              maxLength={150}
              value={form.gym_name}
              onChange={(e) => setForm({ ...form, gym_name: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </AdminField>
          <AdminField label="Owner Name">
            <input
              required
              maxLength={120}
              value={form.owner_name}
              onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </AdminField>
          <AdminField label="Owner Phone">
            <input
              required
              type="tel"
              value={form.owner_phone}
              onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
              placeholder="+91 98765 43210"
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </AdminField>
          <AdminField label="City / Address (optional)">
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </AdminField>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full btn-papaya py-3 text-sm font-bold hover:brightness-110 disabled:opacity-60"
          >
            {saving ? 'Creating...' : 'Create Gym & Generate Code'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 px-2 py-2.5">
      <p className="truncate text-sm font-extrabold text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</p>
    </div>
  );
}

export function AdminField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-white/80 mb-1">{label}</label>
      {children}
    </div>
  );
}

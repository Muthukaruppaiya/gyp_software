import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Activity,
  IndianRupee,
  AlertCircle,
  KeyRound,
  Ban,
  CheckCircle2,
  Pencil,
  Phone,
  Mail,
  MapPin,
  Copy,
  Check,
} from 'lucide-react';
import { apiFetch, formatCurrency, formatDate, formatDuration, formatTime } from '../../api/client';
import { useTransactionPopup } from '../../context/TransactionPopupContext';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import Avatar from '../../components/Avatar';
import Modal from '../../components/Modal';
import { AdminField, GymLogo, GymStatusBadge } from './AdminDashboard';

const TABS = [
  { id: 'members', label: 'Members' },
  { id: 'attendance', label: 'Check-ins' },
  { id: 'payments', label: 'Payments' },
  { id: 'dues', label: 'Dues' },
  { id: 'plans', label: 'Plans' },
];

export default function AdminGymDetail() {
  const { id } = useParams();
  const { showSuccess } = useTransactionPopup();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('members');
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ gym_name: '', owner_name: '', owner_phone: '' });
  const [editError, setEditError] = useState('');
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      setError('');
      setData(await apiFetch(`/admin/gyms/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  const gym = data?.gym;
  const cur = gym?.currency_symbol || '₹';

  async function setStatus(status) {
    const verb = status === 'suspended' ? 'Suspend' : 'Reactivate';
    if (status === 'suspended' && !window.confirm(`Suspend ${gym.gym_name}? The owner and all members will be signed out.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/gyms/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
      showSuccess({ title: `${verb}d`, message: `${gym.gym_name} is now ${status}.` });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetCode() {
    const msg = gym.owner_onboarded
      ? `Issue a new access code for ${gym.owner_name}? They will re-activate and set a new password. Gym data is kept.`
      : 'Replace the current access code with a new one?';
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/admin/gyms/${id}/reset-code`, { method: 'POST' });
      await load();
      showSuccess({
        title: 'New Access Code',
        message: `Share this with ${gym.owner_name}.`,
        copyValue: res.access_code,
        copyLabel: 'Owner Access Code',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditError('');
    try {
      await apiFetch(`/admin/gyms/${id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditOpen(false);
      load();
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(gym.onboarding_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">{error}</div>
      </div>
    );
  }
  if (!data) return <p className="py-16 text-center text-sm text-white/55">Loading gym...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <BackLink />
        <GymLogo gym={gym} size="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl sm:text-2xl font-extrabold tracking-tight text-white">{gym.gym_name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <GymStatusBadge gym={gym} />
            {!gym.location_set && gym.owner_onboarded && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-bold text-white/60">
                <MapPin className="h-3 w-3" /> No check-in location
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Owner card */}
        <div className="glass-card p-5 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">Owner</p>
            <button
              onClick={() => {
                setEditForm({ gym_name: gym.gym_name, owner_name: gym.owner_name || '', owner_phone: gym.owner_phone || '' });
                setEditError('');
                setEditOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
          <p className="text-lg font-extrabold text-white">{gym.owner_name || '—'}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-white/65">
            {gym.owner_phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[#FF8F4A]" /> {gym.owner_phone}
              </span>
            )}
            {gym.owner_email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[#FF8F4A]" /> {gym.owner_email}
              </span>
            )}
            {gym.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#FF8F4A]" /> {gym.address}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/40">
            Created {formatDate(gym.created_at)}
            {gym.last_activity ? ` • Last check-in ${formatDate(gym.last_activity)}` : ''}
          </p>
        </div>

        {/* Actions / access code */}
        <div className="glass-card p-5 flex flex-col gap-3">
          {!gym.owner_onboarded && gym.onboarding_code && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-200">
                <KeyRound className="h-3.5 w-3.5" /> Owner access code
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="font-mono text-xl font-extrabold tracking-widest text-white">{gym.onboarding_code}</span>
                <button
                  onClick={copyCode}
                  aria-label="Copy access code"
                  className="rounded-full glass-chip p-2 text-white hover:bg-white/20"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          <button
            onClick={resetCode}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-full glass-chip px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#FF8F4A]" />
            {gym.owner_onboarded ? 'Reset Owner Access' : 'New Access Code'}
          </button>
          {gym.status === 'suspended' ? (
            <button
              onClick={() => setStatus('active')}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-500/90 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Reactivate Gym
            </button>
          ) : (
            <button
              onClick={() => setStatus('suspended')}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" /> Suspend Gym
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Members" value={gym.total_members} subtitle={`${gym.active_members} active`} icon={Users} accent="orange" />
        <StatCard title="Check-ins Today" value={gym.checkins_today} subtitle={`${gym.in_gym_now} in gym now`} icon={Activity} accent="emerald" />
        <StatCard title="Revenue (Month)" value={formatCurrency(gym.revenue_month, cur)} icon={IndianRupee} accent="peach" />
        <StatCard title="Pending Dues" value={formatCurrency(gym.pending_dues, cur)} subtitle={`${data.dues.length} invoices`} icon={AlertCircle} accent="rose" />
      </div>

      <div className="inline-flex max-w-full overflow-x-auto rounded-full glass-subtle p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-all ${
              tab === t.id ? 'btn-papaya' : 'text-white/60 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass-card p-2 sm:p-3">
        {tab === 'members' && (
          <List empty="No members yet." rows={data.members}>
            {(m) => (
              <Row
                key={m.id}
                left={<Avatar src={m.profile_image} name={m.full_name} />}
                title={m.full_name}
                sub={`${m.member_code} • ${m.phone || '—'}${m.plan_name ? ` • ${m.plan_name}` : ''}`}
                right={
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={m.onboarding_completed ? m.membership_status : 'pending'} label={m.onboarding_completed ? undefined : 'Not activated'} />
                    {m.plan_end_date && <span className="text-[11px] text-white/45">Ends {formatDate(m.plan_end_date)}</span>}
                  </div>
                }
              />
            )}
          </List>
        )}
        {tab === 'attendance' && (
          <List empty="No check-ins yet." rows={data.attendance}>
            {(a) => (
              <Row
                key={a.id}
                left={<Avatar src={a.profile_image} name={a.full_name} />}
                title={a.full_name}
                sub={`${formatDate(a.check_in_time)} • In ${formatTime(a.check_in_time)}${a.check_out_time ? ` • Out ${formatTime(a.check_out_time)}` : ''}${a.auto_checked_out ? ' • Auto out' : ''}`}
                right={
                  a.check_out_time ? (
                    <span className="text-sm font-bold text-white/80">{formatDuration(a.duration_minutes)}</span>
                  ) : (
                    <StatusBadge status="in_gym" />
                  )
                }
              />
            )}
          </List>
        )}
        {tab === 'payments' && (
          <List empty="No payments yet." rows={data.payments}>
            {(p) => (
              <Row
                key={p.id}
                title={p.full_name}
                sub={`${p.receipt_number} • ${p.payment_method} • ${formatDate(p.payment_date)}`}
                right={<span className="text-sm font-extrabold text-emerald-300">{formatCurrency(p.amount, cur)}</span>}
              />
            )}
          </List>
        )}
        {tab === 'dues' && (
          <List empty="No pending dues." rows={data.dues}>
            {(d) => (
              <Row
                key={d.id}
                title={d.full_name}
                sub={`${d.title} • Due ${formatDate(d.due_date)}`}
                right={
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-extrabold text-rose-300">{formatCurrency(d.balance_due, cur)}</span>
                    <StatusBadge status={d.status} />
                  </div>
                }
              />
            )}
          </List>
        )}
        {tab === 'plans' && (
          <List empty="No plans yet." rows={data.plans}>
            {(pl) => (
              <Row
                key={pl.id}
                title={pl.name}
                sub={`${pl.duration_days} days${pl.first_month_price != null ? ` • First month ${formatCurrency(pl.first_month_price, cur)}` : ''}`}
                right={
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-extrabold text-[#FF8F4A]">{formatCurrency(pl.price, cur)}</span>
                    {!pl.is_active && <StatusBadge status="expired" label="Off" />}
                  </div>
                }
              />
            )}
          </List>
        )}
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Gym" maxWidth="max-w-md">
        {editError && (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
            {editError}
          </div>
        )}
        <form onSubmit={saveEdit} className="space-y-4">
          <AdminField label="Gym Name">
            <input
              required
              value={editForm.gym_name}
              onChange={(e) => setEditForm({ ...editForm, gym_name: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </AdminField>
          <AdminField label="Owner Name">
            <input
              required
              value={editForm.owner_name}
              onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </AdminField>
          <AdminField label="Owner Phone">
            <input
              required
              type="tel"
              value={editForm.owner_phone}
              onChange={(e) => setEditForm({ ...editForm, owner_phone: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </AdminField>
          <button type="submit" className="w-full rounded-full btn-papaya py-3 text-sm font-bold hover:brightness-110">
            Save
          </button>
        </form>
      </Modal>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/admin"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full glass-pill text-white hover:bg-white/15"
      aria-label="Back to all gyms"
    >
      <ArrowLeft className="h-4 w-4" />
    </Link>
  );
}

function List({ rows, empty, children }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-white/50">{empty}</p>;
  return <div className="divide-y divide-white/8">{rows.map(children)}</div>;
}

function Row({ left, title, sub, right }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      {left}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{title}</p>
        <p className="truncate text-xs text-white/55">{sub}</p>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

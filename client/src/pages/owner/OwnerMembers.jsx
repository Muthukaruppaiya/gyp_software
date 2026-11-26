import { useEffect, useState } from 'react';
import { UserPlus, Search, Edit2, Phone, Mail, KeyRound, Copy } from 'lucide-react';
import { apiFetch, formatCurrency, formatDate } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTransactionPopup } from '../../context/TransactionPopupContext';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

export default function OwnerMembers() {
  const { gym } = useAuth();
  const { showSuccess } = useTransactionPopup();
  const currency = gym?.currency_symbol || '₹';

  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    plan_id: '',
    membership_status: 'active',
    gender: 'Male',
    fitness_goal: 'General Fitness',
    height_cm: '',
    weight_kg: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    initial_payment_amount: '',
    payment_method: 'UPI',
  });

  async function loadAll() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const [memRes, planRes] = await Promise.all([
        apiFetch(`/members?${params.toString()}`),
        apiFetch('/plans'),
      ]);
      setMembers(memRes.members || []);
      setPlans(planRes.plans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [statusFilter]);

  function openOnboardModal() {
    setEditingMember(null);
    const defaultPlan = plans[0];
    setForm({
      full_name: '',
      phone: '',
      plan_id: defaultPlan ? String(defaultPlan.id) : '',
      membership_status: 'active',
      gender: 'Male',
      fitness_goal: 'General Fitness',
      height_cm: '',
      weight_kg: '',
      address: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      initial_payment_amount: '0',
      payment_method: 'UPI',
    });
    setError('');
    setModalOpen(true);
  }

  function openEditModal(m) {
    setEditingMember(m);
    setForm({
      full_name: m.full_name || '',
      phone: m.phone || '',
      plan_id: m.plan_id ? String(m.plan_id) : '',
      membership_status: m.membership_status || 'active',
      gender: m.gender || 'Male',
      fitness_goal: m.fitness_goal || '',
      height_cm: m.height_cm || '',
      weight_kg: m.weight_kg || '',
      address: m.address || '',
      emergency_contact_name: m.emergency_contact_name || '',
      emergency_contact_phone: m.emergency_contact_phone || '',
      initial_payment_amount: '',
      payment_method: 'UPI',
    });
    setError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingMember) {
        await apiFetch(`/members/${editingMember.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            full_name: form.full_name,
            phone: form.phone,
            plan_id: form.plan_id ? Number(form.plan_id) : null,
            membership_status: form.membership_status,
            gender: form.gender,
            fitness_goal: form.fitness_goal,
            height_cm: form.height_cm || null,
            weight_kg: form.weight_kg || null,
            address: form.address,
            emergency_contact_name: form.emergency_contact_name,
            emergency_contact_phone: form.emergency_contact_phone,
          }),
        });
        setModalOpen(false);
        showSuccess({
          title: 'Member Updated Successfully!',
          message: `${form.full_name}'s details have been saved.`,
        });
      } else {
        const res = await apiFetch('/members', {
          method: 'POST',
          body: JSON.stringify({
            full_name: form.full_name,
            phone: form.phone,
            plan_id: form.plan_id ? Number(form.plan_id) : null,
            initial_payment_amount: Number(form.initial_payment_amount || 0),
            payment_method: form.payment_method,
          }),
        });
        setModalOpen(false);
        showSuccess({
          title: 'Client Onboarded Successfully!',
          message: `Share this onboarding code manually with ${form.full_name}. They will use it on their first login to complete their profile.`,
          copyValue: res.onboarding_code,
          copyLabel: 'One-Time Onboarding Code',
          details: [
            { label: 'Client Name', value: form.full_name },
            { label: 'Phone Number', value: form.phone },
            { label: 'Member ID', value: res.member?.member_code || '—' },
          ],
        });
      }
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function showCodePopup(m) {
    showSuccess({
      title: 'Client Onboarding Code',
      message: `Share this code with ${m.full_name} (${m.phone}) so they can sign in and complete their profile.`,
      copyValue: m.onboarding_code,
      copyLabel: 'One-Time Onboarding Code',
      details: [
        { label: 'Member ID', value: m.member_code },
        { label: 'Onboarding Status', value: 'Pending First Login' },
      ],
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            Gym Members <span className="font-normal italic text-white/60">& Onboarding</span>
          </h2>
        </div>
        <button
          onClick={openOnboardModal}
          className="inline-flex items-center justify-center gap-2 rounded-full btn-papaya px-5 py-3 text-xs font-bold text-white hover:brightness-110 shadow-lg transition-all"
        >
          <UserPlus className="h-4 w-4 text-white" />
          Onboard New Client
        </button>
      </div>

      {/* Search & Filter */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadAll();
        }}
        className="glass-card p-4 flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-white/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, member ID, or onboarding code..."
            className="input-glass w-full pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-glass px-4 py-2.5 text-xs font-semibold"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="frozen">Frozen</option>
        </select>
        <button
          type="submit"
          className="rounded-full bg-[#E56717] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#C8560F]"
        >
          Search
        </button>
      </form>

      {/* Desktop Glass Table */}
      <div className="hidden lg:block overflow-hidden glass-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-[11px] font-bold uppercase tracking-wider text-white/55">
            <tr>
              <th className="px-5 py-4">Member</th>
              <th className="px-5 py-4">Contact</th>
              <th className="px-5 py-4">Plan / Onboarding</th>
              <th className="px-5 py-4">Valid Until</th>
              <th className="px-5 py-4">Balance Due</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-white/55">
                  Loading members...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-white/50">
                  No members found.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {m.profile_image ? (
                        <img
                          src={m.profile_image}
                          alt={m.full_name}
                          className="h-10 w-10 rounded-full object-cover border-2 border-white/15 shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#FF9A5A] to-[#E56717] text-xs font-extrabold text-white shrink-0">
                          {m.full_name?.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-white">{m.full_name}</p>
                        <p className="text-xs text-white/55">
                          {m.member_code} • {m.fitness_goal || 'Pending profile'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-white/80 space-y-0.5">
                    <p className="font-semibold text-white">{m.phone || '—'}</p>
                    <p className="text-white/55">{m.email || 'Awaiting onboarding'}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-white">{m.plan_name || 'No Plan'}</p>
                    {m.onboarding_completed === false && m.onboarding_code && (
                      <button
                        type="button"
                        onClick={() => showCodePopup(m)}
                        className="mt-1 inline-flex items-center gap-1 rounded-full btn-papaya px-2.5 py-0.5 text-[11px] font-mono text-[#FF9A5A] hover:brightness-110"
                      >
                        <KeyRound className="h-3 w-3" />
                        {m.onboarding_code}
                        <Copy className="h-2.5 w-2.5 ml-0.5" />
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-white/80">{formatDate(m.plan_end_date)}</td>
                  <td className="px-5 py-3.5 font-bold">
                    {Number(m.balance_due) > 0 ? (
                      <span className="text-[#FF8F4A]">{formatCurrency(m.balance_due, currency)}</span>
                    ) : (
                      <span className="text-emerald-300">Settled</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {m.onboarding_completed === false ? (
                      <StatusBadge status="pending" label="Onboarding Pending" />
                    ) : (
                      <StatusBadge status={m.membership_status} />
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => openEditModal(m)}
                      className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-bold text-white hover:glass-chip hover:text-white transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile / Tablet Cards */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {members.map((m) => (
          <div key={m.id} className="glass-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                {m.profile_image ? (
                  <img
                    src={m.profile_image}
                    alt={m.full_name}
                    className="h-11 w-11 rounded-full object-cover border-2 border-white/15 shadow-sm"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#FF9A5A] to-[#E56717] text-xs font-extrabold text-white">
                    {m.full_name?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-bold text-white">{m.full_name}</p>
                  <p className="text-xs text-white/55">{m.member_code} • {m.plan_name || 'No Plan'}</p>
                </div>
              </div>
              {m.onboarding_completed === false ? (
                <StatusBadge status="pending" label="Pending Code" />
              ) : (
                <StatusBadge status={m.membership_status} />
              )}
            </div>
            <div className="text-xs text-white/80 space-y-1">
              <p className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[#E56717]" />
                {m.phone || 'No phone'}
              </p>
              <p className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[#E56717]" />
                {m.email || 'Awaiting onboarding'}
              </p>
            </div>
            {m.onboarding_completed === false && m.onboarding_code && (
              <button
                type="button"
                onClick={() => showCodePopup(m)}
                className="w-full flex items-center justify-center gap-1.5 rounded-full glass-chip py-2 text-xs font-mono font-bold text-[#FF9A5A]"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Code: {m.onboarding_code} (Tap to copy)
              </button>
            )}
            <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-xs">
              <span className="text-white/55">Ends: {formatDate(m.plan_end_date)}</span>
              <button
                onClick={() => openEditModal(m)}
                className="inline-flex items-center gap-1 rounded-full bg-white/8 border border-white/12 px-3 py-1 font-bold text-white"
              >
                <Edit2 className="h-3 w-3" /> Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Onboard New Client / Edit Member Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMember ? `Edit Member: ${editingMember.full_name}` : 'Onboard New Client'}
        maxWidth={editingMember ? 'max-w-2xl' : 'max-w-md'}
      >
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
            {error}
          </div>
        )}

        {!editingMember ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Client Full Name *</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Suresh Raina"
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +91 98765 43210"
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Assign Plan (Optional)</label>
              <select
                value={form.plan_id}
                onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                className="input-glass w-full px-4 py-2.5 text-sm"
              >
                <option value="">Assign later</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} —{' '}
                    {p.first_month_price != null
                      ? `${formatCurrency(p.first_month_price, currency)} first month, then ${formatCurrency(p.price, currency)}`
                      : formatCurrency(p.price, currency)}{' '}
                    ({p.duration_days}d)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full btn-papaya px-5 py-2.5 text-xs font-bold text-white hover:brightness-110 transition-colors disabled:opacity-50"
              >
                {saving ? 'Generating Code...' : 'Generate Onboarding Code'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="input-glass w-full px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input-glass w-full px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">Membership Status</label>
                <select
                  value={form.membership_status}
                  onChange={(e) => setForm({ ...form, membership_status: e.target.value })}
                  className="input-glass w-full px-3.5 py-2.5 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="frozen">Frozen</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">Membership Plan</label>
                <select
                  value={form.plan_id}
                  onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                  className="input-glass w-full px-3.5 py-2.5 text-sm"
                >
                  <option value="">No Plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.price, currency)} ({p.duration_days}d)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">Fitness Goal</label>
                <input
                  type="text"
                  value={form.fitness_goal}
                  onChange={(e) => setForm({ ...form, fitness_goal: e.target.value })}
                  className="input-glass w-full px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={form.emergency_contact_name}
                  onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                  className="input-glass w-full px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full btn-papaya px-5 py-2.5 text-xs font-bold text-white hover:brightness-110 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Plus, Pencil, Power, Tag, Repeat } from 'lucide-react';
import { apiFetch, formatCurrency } from '../api/client';
import { useTransactionPopup } from '../context/TransactionPopupContext';
import StatusBadge from './StatusBadge';
import Modal from './Modal';

const EMPTY_FORM = {
  name: '',
  duration_days: '30',
  price: '',
  use_first_month_price: false,
  first_month_price: '',
  description: '',
  is_active: true,
};

const DURATION_PRESETS = [
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
];

function durationLabel(days) {
  const preset = DURATION_PRESETS.find((p) => p.days === Number(days));
  return preset ? preset.label : `${days} days`;
}

/** Owner settings: create, edit, price and enable/disable membership plans (two-tier pricing). */
export default function PlanPricingManager({ currency = '₹' }) {
  const { showSuccess } = useTransactionPopup();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function loadPlans() {
    try {
      const res = await apiFetch('/plans?all=true');
      setPlans(res.plans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  }

  function openEdit(plan) {
    setEditing(plan);
    setForm({
      name: plan.name,
      duration_days: String(plan.duration_days),
      price: String(Number(plan.price)),
      use_first_month_price: plan.first_month_price !== null && plan.first_month_price !== undefined,
      first_month_price: plan.first_month_price != null ? String(Number(plan.first_month_price)) : '',
      description: plan.description || '',
      is_active: plan.is_active,
    });
    setError('');
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      name: form.name,
      duration_days: Number(form.duration_days),
      price: form.price,
      first_month_price: form.use_first_month_price ? form.first_month_price : null,
      description: form.description,
      is_active: form.is_active,
    };
    try {
      await apiFetch(editing ? `/plans/${editing.id}` : '/plans', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      showSuccess({
        title: editing ? 'Plan Pricing Updated!' : 'Membership Plan Created!',
        message: `${form.name} is saved. New fee dues will use this pricing.`,
        details: [
          ...(form.use_first_month_price
            ? [{ label: 'First month (joining)', value: formatCurrency(form.first_month_price, currency) }]
            : []),
          { label: 'Regular price', value: `${formatCurrency(form.price, currency)} / ${durationLabel(form.duration_days)}` },
        ],
      });
      loadPlans();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(plan) {
    setError('');
    try {
      await apiFetch(`/plans/${plan.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !plan.is_active }),
      });
      loadPlans();
    } catch (err) {
      setError(err.message);
    }
  }

  const previewFirst = form.use_first_month_price && form.first_month_price !== '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-white">Membership Plans & Pricing</h3>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-1.5 rounded-full btn-papaya px-4 py-2.5 text-xs font-bold text-white hover:brightness-110 shadow-md shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Plan
        </button>
      </div>

      {error && !modalOpen && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-white/55">Loading plans...</p>
      ) : plans.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-white/60">
          No membership plans yet. Add your first plan to start onboarding members.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((pl) => {
            const hasFirst = pl.first_month_price !== null && pl.first_month_price !== undefined;
            return (
              <div key={pl.id} className={`glass-card p-5 flex flex-col gap-4 ${pl.is_active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-base font-extrabold text-white truncate">{pl.name}</h4>
                    <p className="text-xs text-white/55">{durationLabel(pl.duration_days)} • {pl.duration_days} days</p>
                  </div>
                  <StatusBadge status={pl.is_active ? 'active' : 'expired'} label={pl.is_active ? 'Active' : 'Off'} />
                </div>

                <div className="space-y-2">
                  {hasFirst && (
                    <div className="flex items-center justify-between rounded-2xl border border-[#E56717]/30 bg-[#E56717]/10 px-3.5 py-2.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-[#FFB98A]">
                        <Tag className="h-3.5 w-3.5" /> First month (joining)
                      </span>
                      <span className="text-base font-extrabold text-[#FF9A5A]">
                        {formatCurrency(pl.first_month_price, currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/6 px-3.5 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
                      <Repeat className="h-3.5 w-3.5" /> {hasFirst ? 'Regular (renewals)' : 'Price'}
                    </span>
                    <span className="text-base font-extrabold text-white">
                      {formatCurrency(pl.price, currency)}
                      <span className="text-[11px] font-normal text-white/50"> / {durationLabel(pl.duration_days)}</span>
                    </span>
                  </div>
                </div>

                {pl.description && <p className="text-xs leading-relaxed text-white/60">{pl.description}</p>}

                <div className="mt-auto flex gap-2">
                  <button
                    onClick={() => openEdit(pl)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-white/10 border border-white/12 py-2 text-xs font-bold text-white hover:bg-white/15"
                  >
                    <Pencil className="h-3.5 w-3.5 text-[#E56717]" /> Edit Pricing
                  </button>
                  <button
                    onClick={() => toggleActive(pl)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs font-bold text-white/70 hover:text-white hover:bg-white/10"
                    title={pl.is_active ? 'Hide this plan from new sign-ups' : 'Make this plan available again'}
                  >
                    <Power className="h-3.5 w-3.5" /> {pl.is_active ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Pricing — ${editing.name}` : 'Add Membership Plan'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Plan Name</label>
            <input
              type="text"
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Monthly Standard"
              className="input-glass w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Duration (days)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.days}
                  onClick={() => setForm({ ...form, duration_days: String(p.days) })}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                    Number(form.duration_days) === p.days
                      ? 'bg-[#E56717] text-white'
                      : 'border border-white/12 bg-white/6 text-white/70 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="number"
              required
              min="1"
              max="3650"
              step="1"
              value={form.duration_days}
              onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
              className="input-glass w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Regular Price ({currency})</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="Charged on every renewal"
              className="input-glass w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 p-3.5 space-y-3">
            <label className="flex items-start gap-2.5 text-xs font-medium text-white/85 cursor-pointer">
              <input
                type="checkbox"
                checked={form.use_first_month_price}
                onChange={(e) => setForm({ ...form, use_first_month_price: e.target.checked })}
                className="mt-0.5 rounded accent-[#E56717]"
              />
              <span>
                <span className="font-bold text-white">Charge a different price for the first month</span>
              </span>
            </label>
            {form.use_first_month_price && (
              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">First-Month Price ({currency})</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.first_month_price}
                  onChange={(e) => setForm({ ...form, first_month_price: e.target.value })}
                  placeholder="Charged once, on the member's joining bill"
                  className="input-glass w-full px-3.5 py-2.5 text-sm"
                />
              </div>
            )}
          </div>

          {form.price !== '' && (
            <p className="rounded-2xl bg-[#E56717]/10 border border-[#E56717]/25 px-3.5 py-2.5 text-xs text-[#FFD2B3]">
              {previewFirst ? (
                <>
                  A new member pays <b>{formatCurrency(form.first_month_price, currency)}</b> when joining, then{' '}
                  <b>{formatCurrency(form.price, currency)}</b> every {durationLabel(form.duration_days)}.
                </>
              ) : (
                <>
                  Members pay <b>{formatCurrency(form.price, currency)}</b> every {durationLabel(form.duration_days)}.
                </>
              )}
            </p>
          )}

          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What's included"
              className="input-glass w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-white/80">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded accent-[#E56717]"
            />
            Available for new sign-ups and renewals
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full btn-papaya py-3 text-sm font-bold text-white hover:brightness-110 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving...' : editing ? 'Save Pricing' : 'Create Plan'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, IndianRupee, Settings, Tag, Repeat } from 'lucide-react';
import { apiFetch, formatCurrency, formatDate, localDateKey } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTransactionPopup } from '../../context/TransactionPopupContext';
import StatusBadge from '../../components/StatusBadge';
import Avatar from '../../components/Avatar';
import Modal from '../../components/Modal';

export default function OwnerFees() {
  const { gym } = useAuth();
  const { showSuccess } = useTransactionPopup();
  const currency = gym?.currency_symbol || '₹';

  const [tab, setTab] = useState('invoices');
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [members, setMembers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'UPI', reference_note: '', extend_membership: true });
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invForm, setInvForm] = useState({ member_id: '', plan_id: '', title: '', amount_due: '', due_date: '' });
  // Which price tier the server says applies to the selected member + plan.
  const [quote, setQuote] = useState(null);

  const activePlans = plans.filter((p) => p.is_active);

  async function loadAll() {
    setLoading(true);
    try {
      const invQuery = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const [invRes, payRes, planRes, memRes] = await Promise.all([
        apiFetch(`/fees/invoices${invQuery}`),
        apiFetch('/fees/payments'),
        apiFetch('/plans?all=true'),
        apiFetch('/members'),
      ]);
      setInvoices(invRes.invoices || []);
      setPayments(payRes.payments || []);
      setPlans(planRes.plans || []);
      setMembers(memRes.members || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [statusFilter]);

  function openPayModal(inv) {
    setPayModal(inv);
    setPayForm({
      amount: String(inv.balance_due),
      payment_method: 'UPI',
      reference_note: '',
      extend_membership: true,
    });
    setError('');
  }

  async function submitPayment(e) {
    e.preventDefault();
    try {
      const res = await apiFetch('/fees/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoice_id: payModal.id,
          member_id: payModal.member_id,
          amount: Number(payForm.amount),
          payment_method: payForm.payment_method,
          reference_note: payForm.reference_note,
          extend_membership: payForm.extend_membership,
        }),
      });
      const memberName = payModal.full_name;
      setPayModal(null);
      showSuccess({
        title: 'Payment Completed Successfully!',
        message: `Fee payment from ${memberName} has been recorded and receipt issued.`,
        details: [
          { label: 'Receipt Number', value: res.payment?.receipt_number || '—' },
          { label: 'Amount Paid', value: formatCurrency(payForm.amount, currency) },
          { label: 'Method', value: payForm.payment_method },
        ],
      });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitInvoice(e) {
    e.preventDefault();
    try {
      await apiFetch('/fees/invoices', {
        method: 'POST',
        body: JSON.stringify(invForm),
      });
      setInvoiceModal(false);
      showSuccess({
        title: 'Fee Invoice Created Successfully!',
        message: `${invForm.title} has been added to member dues.`,
        details: [
          { label: 'Amount Due', value: formatCurrency(invForm.amount_due, currency) },
          { label: 'Due Date', value: invForm.due_date },
        ],
      });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  // Ask the server which price applies (first-month for a member's first plan bill, regular after).
  async function applyPlanQuote(nextForm) {
    setInvForm(nextForm);
    setQuote(null);
    if (!nextForm.plan_id) return;
    try {
      const q = await apiFetch(`/plans/${nextForm.plan_id}/quote?memberId=${nextForm.member_id || ''}`);
      setQuote(q);
      setInvForm((f) =>
        f.plan_id === nextForm.plan_id && f.member_id === nextForm.member_id
          ? { ...f, amount_due: String(q.amount), title: q.title }
          : f
      );
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            Fees & <span className="font-normal italic text-white/60">Membership Plans</span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/owner/profile?tab=pricing"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/15"
          >
            <Settings className="h-3.5 w-3.5 text-[#E56717]" />
            Manage Pricing
          </Link>
          <button
            onClick={() => {
              const today = localDateKey();
              const firstMember = members[0];
              // Default to the member's current plan when they have one.
              const defaultPlan = activePlans.find((p) => p.id === firstMember?.plan_id) || activePlans[0];
              setInvoiceModal(true);
              applyPlanQuote({
                member_id: firstMember?.id ? String(firstMember.id) : '',
                plan_id: defaultPlan ? String(defaultPlan.id) : '',
                title: defaultPlan ? `${defaultPlan.name} Membership` : 'Monthly Membership Fee',
                amount_due: defaultPlan ? String(defaultPlan.price) : '',
                due_date: today,
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-full btn-papaya px-4 py-2.5 text-xs font-bold text-white hover:brightness-110 shadow-md"
          >
            <Plus className="h-3.5 w-3.5 text-white" />
            Create Fee Due
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}

      {/* Pill Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full glass-subtle p-1">
          {[
            { id: 'invoices', label: 'Fee Dues & Invoices' },
            { id: 'payments', label: 'Payment History' },
            { id: 'plans', label: 'Membership Plans' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                tab === t.id ? 'glass-chip text-white shadow-sm' : 'text-white/60 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'invoices' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-glass px-4 py-2 text-xs font-semibold"
          >
            <option value="all">All Invoices</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-white/55">Loading fee records...</div>
      ) : tab === 'invoices' ? (
        <>
          <div className="hidden md:block overflow-hidden glass-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-[11px] font-bold uppercase tracking-wider text-white/55">
                <tr>
                  <th className="px-5 py-4">Member</th>
                  <th className="px-5 py-4">Fee Title</th>
                  <th className="px-5 py-4">Due Date</th>
                  <th className="px-5 py-4">Total</th>
                  <th className="px-5 py-4">Paid</th>
                  <th className="px-5 py-4">Balance</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/5">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar src={inv.profile_image} name={inv.full_name} size="sm" />
                        <div>
                          <p className="font-bold text-white">{inv.full_name}</p>
                          <p className="text-xs text-white/55">{inv.member_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-white/80">{inv.title}</td>
                    <td className="px-5 py-3.5 text-white/80">{formatDate(inv.due_date)}</td>
                    <td className="px-5 py-3.5 text-white/80">{formatCurrency(inv.amount_due, currency)}</td>
                    <td className="px-5 py-3.5 font-semibold text-emerald-300">{formatCurrency(inv.amount_paid, currency)}</td>
                    <td className="px-5 py-3.5 font-bold text-[#FF8F4A]">
                      {formatCurrency(inv.balance_due, currency)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {inv.status !== 'paid' && (
                        <button
                          onClick={() => openPayModal(inv)}
                          className="inline-flex items-center gap-1 rounded-full bg-[#E56717] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#C8560F]"
                        >
                          <IndianRupee className="h-3.5 w-3.5" />
                          Record Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="glass-card p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar src={inv.profile_image} name={inv.full_name} size="md" />
                    <div>
                      <p className="text-sm font-bold text-white">{inv.full_name}</p>
                      <p className="text-xs text-white/55">{inv.title} • Due {formatDate(inv.due_date)}</p>
                    </div>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/6 border border-white/15 p-2.5 text-xs">
                  <div>
                    <p className="text-white/50">Total</p>
                    <p className="font-bold text-white">{formatCurrency(inv.amount_due, currency)}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Paid</p>
                    <p className="font-bold text-emerald-300">{formatCurrency(inv.amount_paid, currency)}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Balance</p>
                    <p className="font-bold text-[#FF8F4A]">{formatCurrency(inv.balance_due, currency)}</p>
                  </div>
                </div>
                {inv.status !== 'paid' && (
                  <button
                    onClick={() => openPayModal(inv)}
                    className="w-full rounded-full bg-[#E56717] py-2.5 text-xs font-bold text-white"
                  >
                    Record Payment
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : tab === 'payments' ? (
        <div className="space-y-3">
          {payments.map((p) => (
            <div
              key={p.id}
              className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <Avatar src={p.profile_image} name={p.full_name} size="md" />
                <div>
                  <p className="text-sm font-bold text-white">
                    {p.full_name} <span className="text-xs font-mono font-normal text-white/55">({p.receipt_number})</span>
                  </p>
                  <p className="text-xs text-white/55">
                    {p.invoice_title || 'Gym Fee'} • {p.payment_method} • {formatDate(p.payment_date)}
                  </p>
                  {p.reference_note && <p className="text-xs text-white/50 mt-0.5">{p.reference_note}</p>}
                </div>
              </div>
              <p className="text-base font-extrabold text-white">{formatCurrency(p.amount, currency)}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((pl) => {
              const hasFirst = pl.first_month_price !== null && pl.first_month_price !== undefined;
              return (
                <div key={pl.id} className={`glass-card p-5 flex flex-col gap-3 ${pl.is_active ? '' : 'opacity-60'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-extrabold text-white">{pl.name}</h3>
                    <StatusBadge status={pl.is_active ? 'active' : 'expired'} label={pl.is_active ? 'Active' : 'Off'} />
                  </div>
                  {hasFirst && (
                    <p className="flex items-center justify-between text-xs text-[#FFB98A]">
                      <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> First month</span>
                      <span className="text-base font-extrabold text-[#FF9A5A]">{formatCurrency(pl.first_month_price, currency)}</span>
                    </p>
                  )}
                  <p className="flex items-center justify-between text-xs text-white/60">
                    <span className="flex items-center gap-1"><Repeat className="h-3.5 w-3.5" /> {hasFirst ? 'Then regular' : 'Price'}</span>
                    <span className="text-xl font-extrabold text-[#E56717]">
                      {formatCurrency(pl.price, currency)}
                      <span className="text-xs font-normal text-white/55"> / {pl.duration_days} days</span>
                    </span>
                  </p>
                  {pl.description && <p className="text-xs leading-relaxed text-white/60">{pl.description}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal open={Boolean(payModal)} onClose={() => setPayModal(null)} title="Record Fee Payment">
        {payModal && (
          <form onSubmit={submitPayment} className="space-y-4">
            <div className="rounded-2xl bg-white/8 border border-white/10 p-4 text-xs space-y-1">
              <p className="text-white/55">
                Member: <span className="text-white font-bold">{payModal.full_name}</span>
              </p>
              <p className="text-white/55">
                Invoice: <span className="text-white font-semibold">{payModal.title}</span>
              </p>
              <p className="text-white/55">
                Remaining Balance:{' '}
                <span className="text-[#FF8F4A] font-extrabold">{formatCurrency(payModal.balance_due, currency)}</span>
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Amount Paid ({currency})</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                className="input-glass w-full px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Payment Method</label>
              <select
                value={payForm.payment_method}
                onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
                className="input-glass w-full px-3.5 py-2.5 text-sm"
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Reference / Transaction Note</label>
              <input
                type="text"
                value={payForm.reference_note}
                onChange={(e) => setPayForm({ ...payForm, reference_note: e.target.value })}
                placeholder="e.g. GPay ref #4592"
                className="input-glass w-full px-3.5 py-2.5 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-white/80">
              <input
                type="checkbox"
                checked={payForm.extend_membership}
                onChange={(e) => setPayForm({ ...payForm, extend_membership: e.target.checked })}
                className="rounded accent-[#E56717]"
              />
              Activate/extend member plan once fully paid
            </label>
            <button
              type="submit"
              className="w-full rounded-full btn-papaya py-3 text-sm font-bold text-white hover:brightness-110 transition-colors"
            >
              Confirm Payment & Issue Receipt
            </button>
          </form>
        )}
      </Modal>

      {/* Create Invoice Modal */}
      <Modal open={invoiceModal} onClose={() => setInvoiceModal(false)} title="Create New Fee Due">
        <form onSubmit={submitInvoice} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Member</label>
            <select
              required
              value={invForm.member_id}
              onChange={(e) => applyPlanQuote({ ...invForm, member_id: e.target.value })}
              className="input-glass w-full px-3.5 py-2.5 text-sm"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.member_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Plan (Optional)</label>
            <select
              value={invForm.plan_id}
              onChange={(e) => applyPlanQuote({ ...invForm, plan_id: e.target.value })}
              className="input-glass w-full px-3.5 py-2.5 text-sm"
            >
              <option value="">Custom Fee</option>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatCurrency(p.price, currency)}
                  {p.first_month_price != null ? `, first month ${formatCurrency(p.first_month_price, currency)}` : ''})
                </option>
              ))}
            </select>
            {invForm.plan_id && quote && (
              <p
                className={`mt-1.5 inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
                  quote.tier === 'first'
                    ? 'bg-[#E56717]/12 text-[#FFB98A] border border-[#E56717]/30'
                    : 'bg-white/6 text-white/65 border border-white/10'
                }`}
              >
                {quote.tier === 'first' ? 'First-month price' : 'Regular price'}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Fee Title</label>
            <input
              type="text"
              required
              value={invForm.title}
              onChange={(e) => setInvForm({ ...invForm, title: e.target.value })}
              className="input-glass w-full px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Amount ({currency})</label>
              <input
                type="number"
                required
                min="1"
                value={invForm.amount_due}
                onChange={(e) => setInvForm({ ...invForm, amount_due: e.target.value })}
                className="input-glass w-full px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Due Date</label>
              <input
                type="date"
                required
                value={invForm.due_date}
                onChange={(e) => setInvForm({ ...invForm, due_date: e.target.value })}
                className="input-glass w-full px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-full btn-papaya py-3 text-sm font-bold text-white hover:brightness-110 transition-colors"
          >
            Create Fee Invoice
          </button>
        </form>
      </Modal>

    </div>
  );
}

import { useEffect, useState } from 'react';
import { Receipt, CreditCard } from 'lucide-react';
import { apiFetch, formatCurrency, formatDate } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

export default function CustomerFees() {
  const { user, profile, gym } = useAuth();
  const currency = gym?.currency_symbol || '₹';

  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch('/fees/invoices'), apiFetch('/fees/payments')])
      .then(([invRes, payRes]) => {
        setInvoices(invRes.invoices || []);
        setPayments(payRes.payments || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white">
          Membership <span className="font-normal italic text-white/60">& Fees</span>
        </h2>
        <p className="text-xs sm:text-sm text-white/55">
          View your active plan, pending fee dues, and official payment receipts
        </p>
      </div>

      {/* Dark Liquid Glass Active Plan Banner */}
      <div className="glass-dark p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="rounded-2xl bg-[#E56717] p-3 text-white shadow-lg shadow-[#E56717]/30">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#FF9A5A]">Current Membership Plan</p>
            <h3 className="text-xl font-extrabold text-white">{profile?.plan_name || 'Standard Plan'}</h3>
            <p className="text-xs text-white/70 mt-0.5">
              Start: {formatDate(profile?.plan_start_date)} • Valid Until: {formatDate(profile?.plan_end_date)}
            </p>
          </div>
        </div>
        <StatusBadge status={profile?.membership_status || 'active'} />
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-white/55">Loading fee history...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-base font-extrabold text-white">Fee Dues & Invoices</h3>
            {invoices.length === 0 ? (
              <p className="py-6 text-center text-xs text-white/50">No invoices yet.</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-2xl bg-white/8 border border-white/15 p-4 space-y-2 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">{inv.title}</p>
                        <p className="text-xs text-white/55">Due Date: {formatDate(inv.due_date)}</p>
                      </div>
                      <StatusBadge status={inv.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
                      <span className="text-white/55">
                        Total: <strong className="text-white">{formatCurrency(inv.amount_due, currency)}</strong>
                      </span>
                      <span className="text-white/55">
                        Paid: <strong className="text-emerald-300">{formatCurrency(inv.amount_paid, currency)}</strong>
                      </span>
                      <span className="text-white/55">
                        Balance: <strong className="text-[#FF8F4A]">{formatCurrency(inv.balance_due, currency)}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card p-5 space-y-3">
            <h3 className="text-base font-extrabold text-white">Payment Receipts</h3>
            {payments.length === 0 ? (
              <p className="py-6 text-center text-xs text-white/50">No payments recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 border border-white/15 p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="rounded-2xl glass-chip p-2.5 text-[#E56717]">
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {p.invoice_title || 'Gym Membership Fee'}
                        </p>
                        <p className="text-xs text-white/55">
                          {p.receipt_number} • {p.payment_method} • {formatDate(p.payment_date)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-extrabold text-white">{formatCurrency(p.amount, currency)}</p>
                      <button
                        onClick={() => setSelectedReceipt(p)}
                        className="text-[11px] font-bold text-[#FF8F4A] hover:underline mt-0.5"
                      >
                        View Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      <Modal
        open={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        title="Official Fee Receipt"
      >
        {selectedReceipt && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <p className="font-extrabold text-white">{gym?.gym_name || 'IronPulse Fitness Studio'}</p>
                  <p className="text-xs text-white/55">{gym?.phone}</p>
                </div>
                <span className="rounded-full glass-chip px-3 py-1 text-xs font-mono font-bold text-[#FF9A5A]">
                  {selectedReceipt.receipt_number}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/55">Member Name</span>
                  <span className="text-white font-bold">{user?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Member Code</span>
                  <span className="text-white font-semibold">{profile?.member_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Payment Date</span>
                  <span className="text-white">{formatDate(selectedReceipt.payment_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Payment Method</span>
                  <span className="text-white">{selectedReceipt.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Description</span>
                  <span className="text-white">{selectedReceipt.invoice_title || 'Gym Fee'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-xs font-bold uppercase text-white/55">Amount Paid</span>
                <span className="text-xl font-extrabold text-[#FF8F4A]">
                  {formatCurrency(selectedReceipt.amount, currency)}
                </span>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="w-full rounded-full btn-papaya py-3 text-xs font-bold text-white hover:brightness-110 transition-colors"
            >
              Print / Save as PDF
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

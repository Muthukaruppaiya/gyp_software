import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, UserCog, Building2, Loader2, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTransactionPopup } from '../../context/TransactionPopupContext';

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-bold text-white/80 mb-1">{label}</label>
      {children}
    </div>
  );
}

/**
 * First sign-in of a gym owner created by the super admin: set login email + password,
 * confirm the gym's basic details, then continue to full Settings.
 */
export default function OwnerSetup() {
  const { user, gym, refreshSession } = useAuth();
  const { showSuccess } = useTransactionPopup();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    password: '',
    confirm: '',
    gym_name: gym?.gym_name || '',
    address: gym?.address || '',
    gym_phone: gym?.phone || '',
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.password !== form.confirm) return setError('Passwords do not match');

    setSaving(true);
    try {
      // 1. Account: this marks the owner as activated and spends the access code.
      await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          password: form.password,
        }),
      });
      // 2. Basic gym details (everything else lives in Settings).
      await apiFetch('/profile/gym', {
        method: 'PUT',
        body: JSON.stringify({ gym_name: form.gym_name, address: form.address, phone: form.gym_phone }),
      });
      await refreshSession();
      showSuccess({
        title: 'Account Activated!',
        message: 'Next: add your logo, check-in location and membership pricing.',
        details: [{ label: 'Login', value: form.email }],
      });
      navigate('/owner/profile');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="glass-dark p-6 flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl btn-papaya">
          <Rocket className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white truncate">
            Activate {gym?.gym_name || 'your gym'}
          </h2>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white border-b border-white/10 pb-3">
            <UserCog className="h-4 w-4 text-[#E56717]" />
            Your Login
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name">
              <input required value={form.full_name} onChange={set('full_name')} className="input-glass w-full px-4 py-2.5 text-sm" />
            </Field>
            <Field label="Phone">
              <input required type="tel" value={form.phone} onChange={set('phone')} className="input-glass w-full px-4 py-2.5 text-sm" />
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <input
                required
                type="email"
                autoComplete="username"
                value={form.email}
                onChange={set('email')}
                placeholder="you@yourgym.in"
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  required
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={6}
                  value={form.password}
                  onChange={set('password')}
                  className="input-glass w-full pl-4 pr-11 py-2.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/50 hover:text-white"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field label="Confirm Password">
              <input
                required
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirm}
                onChange={set('confirm')}
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </Field>
          </div>
        </div>

        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white border-b border-white/10 pb-3">
            <Building2 className="h-4 w-4 text-[#E56717]" />
            Gym
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Gym Name">
              <input required maxLength={150} value={form.gym_name} onChange={set('gym_name')} className="input-glass w-full px-4 py-2.5 text-sm" />
            </Field>
            <Field label="Front Desk Phone">
              <input type="tel" value={form.gym_phone} onChange={set('gym_phone')} className="input-glass w-full px-4 py-2.5 text-sm" />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <textarea rows={2} value={form.address} onChange={set('address')} className="input-glass w-full px-4 py-2.5 text-sm" />
            </Field>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-full btn-papaya py-3.5 text-sm font-bold hover:brightness-110 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Activate Account
        </button>
      </form>
    </div>
  );
}

import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, ArrowRight, Eye, EyeOff, ShieldHalf } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Unlisted sign-in for the platform super admin. Not linked from anywhere in the app;
 * the path is ADMIN_LOGIN_PATH (configurable via VITE_ADMIN_LOGIN_PATH).
 * Talks to /auth/admin-login, which refuses gym owner and member accounts.
 */
export default function AdminLoginPage() {
  const { user, adminLogin } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user?.role === 'superadmin') return <Navigate to="/admin" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await adminLogin(identifier, password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-[100dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm glass-card p-6 sm:p-7 login-rise">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl btn-papaya">
            <ShieldHalf className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight text-white">Console</h1>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E56717]" />
            <input
              aria-label="Email"
              type="email"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email"
              className="input-glass w-full pl-11 pr-4 py-3.5 text-sm"
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E56717]" />
            <input
              aria-label="Password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="input-glass w-full pl-11 pr-12 py-3.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="group flex w-full items-center justify-center gap-2 rounded-full btn-papaya px-5 py-3.5 text-sm font-bold hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign In <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

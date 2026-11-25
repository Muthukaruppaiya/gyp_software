import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, ShieldCheck, User, ArrowRight, KeyRound, Check, ChevronRight, Flame } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTransactionPopup } from '../context/TransactionPopupContext';

export default function LoginPage() {
  const { login, onboardLogin } = useAuth();
  const { showSuccess } = useTransactionPopup();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'onboard'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [onboardingCode, setOnboardingCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const { user, profile } = await login(identifier, password);
        if (user.role === 'owner') {
          navigate('/owner');
        } else if (profile && profile.onboarding_completed === false) {
          navigate('/member/profile');
        } else {
          navigate('/member');
        }
      } else {
        const res = await onboardLogin(onboardingCode);
        showSuccess({
          title: 'Successfully Onboarded!',
          message: `Welcome ${res.user.full_name}! Please complete your profile details and set your password to enter the portal.`,
          details: [
            { label: 'Member Code', value: res.profile?.member_code || '—' },
            { label: 'Phone', value: res.user?.phone || '—' },
          ],
        });
        navigate('/member/profile');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function quickDemoLogin(demoEmail, demoPassword) {
    setError('');
    setSubmitting(true);
    try {
      const { user } = await login(demoEmail, demoPassword);
      navigate(user.role === 'owner' ? '/owner' : '/member');
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row p-3 sm:p-5 lg:p-7 gap-5 max-w-[1440px] mx-auto">
      {/* Left Apple-Style Hero Card with Athletic Image & Liquid Glass Overlay */}
      <div className="relative overflow-hidden lg:w-1/2 min-h-[380px] lg:min-h-[680px] rounded-[34px] border border-white/15 shadow-[0_24px_60px_-18px_rgba(17,19,23,0.22)] flex flex-col justify-between bg-[#E56717]/20">
        <img
          src="/images/hero-athlete.jpg"
          alt="Athletic studio training"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111317]/90 via-[#111317]/25 to-[#E56717]/25" />

        {/* Top Bar */}
        <div className="relative z-10 flex items-center justify-between p-6 sm:p-8">
          <div className="flex items-center gap-2.5 glass-pill rounded-full px-3.5 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full glass-chip text-white">
              <Dumbbell className="h-3.5 w-3.5 text-[#E56717]" />
            </div>
            <span className="text-xs font-extrabold tracking-tight text-white">IronPulse Studio</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="h-1.5 w-6 rounded-full bg-[#E56717]" />
          </div>
        </div>

        {/* Bottom Editorial Copy + Liquid Glass Pill */}
        <div className="relative z-10 p-6 sm:p-8 lg:p-10 space-y-5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E56717] px-3 py-1 text-[11px] font-bold text-white shadow-lg shadow-[#E56717]/40">
            <Flame className="h-3.5 w-3.5" />
            Apple-Inspired Liquid Glass Suite
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.08]">
            Workout <span className="font-normal italic text-[#FFD2B3]">Get Better As You</span>
          </h2>
          <p className="text-xs sm:text-sm text-white/80 max-w-md leading-relaxed">
            Seamless gym attendance tracking (In-Time & Out-Time), fee collections, interactive analytics, and
            one-code client onboarding for desktop and mobile.
          </p>

          <div className="inline-flex items-center gap-3 rounded-full bg-white/25 backdrop-blur-2xl border border-white/40 p-1.5 pr-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full glass-chip text-white">
              <Check className="h-4 w-4 text-[#E56717]" strokeWidth={3} />
            </span>
            <span className="text-xs font-semibold text-white">Ready for Owner & Member Access</span>
            <ChevronRight className="h-4 w-4 text-white/75" />
          </div>
        </div>
      </div>

      {/* Right Liquid Glass Auth Panel */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-6">
        <div className="w-full max-w-md space-y-5">
          {/* Quick Demo Buttons */}
          <div className="glass-card p-5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">
              1-Tap Proposal Demo Access
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => quickDemoLogin('owner@ironpulse.fit', 'owner123')}
                className="flex items-center justify-center gap-2 rounded-full glass-chip px-4 py-3 text-xs font-bold text-white hover:bg-white/20 transition-all disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4 text-[#E56717]" />
                Gym Owner Login
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => quickDemoLogin('arjun@ironpulse.fit', 'member123')}
                className="flex items-center justify-center gap-2 rounded-full bg-[#E56717] px-4 py-3 text-xs font-bold text-white hover:bg-[#C8560F] shadow-md shadow-[#E56717]/30 transition-all disabled:opacity-50"
              >
                <User className="h-4 w-4" />
                Gym Customer Login
              </button>
            </div>
          </div>

          {/* Login / First-Time Onboarding Card */}
          <div className="glass-card p-6 sm:p-7">
            <div className="flex rounded-full bg-white/6 p-1 mb-6 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`flex-1 rounded-full py-2.5 text-xs font-bold transition-all ${
                  mode === 'login'
                    ? 'glass-chip text-white shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('onboard');
                  setError('');
                }}
                className={`flex-1 rounded-full py-2.5 text-xs font-bold transition-all ${
                  mode === 'onboard'
                    ? 'bg-[#E56717] text-white shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                First-Time Code Login
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'login' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-white/80 mb-1.5">
                      Email or Phone Number
                    </label>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com or +91 98765 43210"
                      className="input-glass w-full px-4 py-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/80 mb-1.5">Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-glass w-full px-4 py-3 text-sm"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#E56717]/25 bg-[#E56717]/12 p-3.5 text-xs text-[#FFC9A6] leading-relaxed">
                    Enter the unique <strong>Onboarding Code</strong> shared by the gym owner to activate your profile
                    and upload your photo.
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white/80 mb-1.5">Onboarding Access Code</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-[#E56717]" />
                      <input
                        type="text"
                        required
                        value={onboardingCode}
                        onChange={(e) => setOnboardingCode(e.target.value.toUpperCase())}
                        placeholder="e.g. KAR-210482"
                        className="input-glass w-full pl-10 pr-4 py-3 text-sm font-mono tracking-wider uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-full btn-papaya px-5 py-3.5 text-sm font-bold text-white hover:brightness-110  transition-all disabled:opacity-60"
              >
                {submitting
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In to Portal'
                  : 'Activate & Onboard'}
                <ArrowRight className="h-4 w-4 text-white" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

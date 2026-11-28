import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, ShieldCheck, User, ArrowRight, KeyRound, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { homePath } from '../utils/home';
import { useAuth } from '../context/AuthContext';
import { useTransactionPopup } from '../context/TransactionPopupContext';

export default function LoginPage() {
  const { login, onboardLogin } = useAuth();
  const { showSuccess } = useTransactionPopup();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'onboard'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [onboardingCode, setOnboardingCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const { user, profile, gym } = await login(identifier, password);
        navigate(homePath(user, profile, gym));
      } else {
        const res = await onboardLogin(onboardingCode);
        if (res.ownerOnboarding) {
          // Gym owner activating the account the super admin created.
          navigate('/owner/setup');
          return;
        }
        showSuccess({
          title: 'Welcome!',
          message: `Hi ${res.user.full_name}, finish your profile to continue.`,
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
      const { user, profile, gym } = await login(demoEmail, demoPassword);
      navigate(homePath(user, profile, gym));
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative h-[100dvh] overflow-hidden lg:flex lg:gap-6 lg:p-6 max-w-[1440px] mx-auto">
      {/* Hero: full-bleed background on mobile, left panel on desktop */}
      <div className="absolute inset-0 lg:relative lg:inset-auto lg:w-1/2 lg:rounded-[34px] overflow-hidden lg:border lg:border-white/15 lg:shadow-[0_24px_60px_-18px_rgba(0,0,0,0.6)]">
        <img
          src="/images/hero-athlete.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_20%] login-hero-zoom"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#08080a]/30 via-[#08080a]/45 to-[#08080a] lg:to-[#08080a]/85" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(229,103,23,0.35),transparent_60%)]" />

        <div className="relative z-10 hidden lg:flex h-full flex-col items-start justify-between p-10">
          <Brand />
          <Headline large />
        </div>
      </div>

      {/* Auth column */}
      <div className="relative z-10 flex h-full flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:flex-1 lg:items-center lg:justify-center lg:p-6">
        <div className="lg:hidden">
          <Brand />
        </div>

        <div className="flex flex-1 flex-col justify-end gap-5 lg:flex-none lg:w-full lg:max-w-md">
          <div className="lg:hidden [@media(max-height:600px)]:hidden">
            <Headline />
          </div>

          <div className="glass-card p-5 sm:p-7 login-rise">
            <div className="hidden lg:block mb-6">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                {mode === 'login' ? 'Welcome back' : 'Activate account'}
              </h1>
            </div>

            {/* Mode switch with sliding indicator */}
            <div className="relative grid grid-cols-2 rounded-full border border-white/10 bg-white/5 p-1 mb-5">
              <span
                aria-hidden
                className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full btn-papaya transition-transform duration-300 ease-out ${
                  mode === 'onboard' ? 'translate-x-full' : ''
                }`}
              />
              <TabButton active={mode === 'login'} onClick={() => switchMode('login')}>
                Sign In
              </TabButton>
              <TabButton active={mode === 'onboard'} onClick={() => switchMode('onboard')}>
                Access Code
              </TabButton>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-300"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'login' ? (
                <>
                  <IconInput
                    icon={Mail}
                    aria-label="Email or phone number"
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Email or phone"
                  />
                  <IconInput
                    icon={Lock}
                    aria-label="Password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                </>
              ) : (
                <IconInput
                  icon={KeyRound}
                  aria-label="Onboarding code"
                  type="text"
                  required
                  autoCapitalize="characters"
                  value={onboardingCode}
                  onChange={(e) => setOnboardingCode(e.target.value.toUpperCase())}
                  placeholder="KAR-210482"
                  className="font-mono tracking-[0.2em] uppercase"
                />
              )}

              <button
                type="submit"
                disabled={submitting}
                className="group flex w-full items-center justify-center gap-2 rounded-full btn-papaya px-5 py-3.5 text-sm font-bold hover:brightness-110 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Activate'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {/* Demo access */}
            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Demo</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <DemoButton
                icon={ShieldCheck}
                disabled={submitting}
                onClick={() => quickDemoLogin('owner@ironpulse.fit', 'owner123')}
              >
                Owner
              </DemoButton>
              <DemoButton
                icon={User}
                disabled={submitting}
                onClick={() => quickDemoLogin('arjun@ironpulse.fit', 'member123')}
              >
                Member
              </DemoButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="inline-flex items-center gap-2.5 glass-pill rounded-full pl-1.5 pr-4 py-1.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full btn-papaya">
        <Dumbbell className="h-4 w-4" />
      </span>
      <span className="text-sm font-extrabold tracking-tight text-white">IronPulse</span>
    </div>
  );
}

function Headline({ large = false }) {
  return (
    <h2
      className={`font-extrabold tracking-tight text-white leading-[1.02] ${
        large ? 'text-6xl xl:text-7xl' : 'text-4xl sm:text-5xl'
      }`}
    >
      Workout.
      <br />
      <span className="font-light italic bg-gradient-to-r from-[#FFD2B3] to-[#FF8F4A] bg-clip-text text-transparent">
        Get better as you.
      </span>
    </h2>
  );
}

function TabButton({ active, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`relative z-10 rounded-full py-2.5 text-xs font-bold transition-colors ${
        active ? 'text-white' : 'text-white/55 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function IconInput({ icon: Icon, trailing, className = '', ...props }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E56717]" />
      <input {...props} className={`input-glass w-full pl-11 ${trailing ? 'pr-12' : 'pr-4'} py-3.5 text-sm ${className}`} />
      {trailing}
    </div>
  );
}

function DemoButton({ icon: Icon, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="flex items-center justify-center gap-1.5 rounded-full glass-chip px-2 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-all disabled:opacity-50"
    >
      <Icon className="h-4 w-4 text-[#FF8F4A]" />
      {children}
    </button>
  );
}

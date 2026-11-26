import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Dumbbell,
  LayoutDashboard,
  Clock,
  Users,
  CreditCard,
  BarChart3,
  UserCircle,
  LogOut,
  ShieldCheck,
  Flame,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MembershipReminderModal from './MembershipReminderModal';
import { consumeReminderFlag, membershipCountdown, needsRenewalReminder } from '../utils/membership';

export default function Layout({ children }) {
  const { user, profile, gym, logout } = useAuth();
  const navigate = useNavigate();

  const isOwner = user?.role === 'owner';
  const onboardingLocked = !isOwner && profile && profile.onboarding_completed === false;

  // Renewal popup: once per sign-in, when ≤ 3 days remain or the membership has expired.
  const [reminder, setReminder] = useState(null);
  useEffect(() => {
    if (isOwner || !profile || onboardingLocked) return;
    if (!consumeReminderFlag()) return;
    const countdown = membershipCountdown(profile);
    if (needsRenewalReminder(countdown)) setReminder(countdown);
  }, [isOwner, profile, onboardingLocked]);

  const navItems = isOwner
    ? [
        { to: '/owner', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/owner/attendance', label: 'Attendance', icon: Clock },
        { to: '/owner/members', label: 'Members', icon: Users },
        { to: '/owner/fees', label: 'Fees', icon: CreditCard },
        { to: '/owner/reports', label: 'Reports', icon: BarChart3 },
        { to: '/owner/profile', label: 'Settings', icon: Settings },
      ]
    : onboardingLocked
    ? [{ to: '/member/profile', label: 'Setup', icon: UserCircle }]
    : [
        { to: '/member', label: 'Home', icon: LayoutDashboard, end: true },
        { to: '/member/attendance', label: 'Activity', icon: Clock },
        { to: '/member/fees', label: 'Fees', icon: CreditCard },
        { to: '/member/profile', label: 'Profile', icon: UserCircle },
      ];

  const initials = (user?.full_name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop Floating Liquid Glass Sidebar */}
      <aside className="hidden md:flex md:w-68 md:flex-col md:fixed md:inset-y-0 p-4 pr-0 z-20">
        <div className="glass-card flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
            {gym?.logo_image ? (
              <img
                src={gym.logo_image}
                alt={`${gym.gym_name || 'Gym'} logo`}
                className="h-11 w-11 shrink-0 rounded-2xl object-cover border border-white/15 shadow-md"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-chip text-white shadow-md">
                <Dumbbell className="h-5 w-5 text-[#E56717]" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold tracking-tight text-white truncate">
                {gym?.gym_name || 'IronPulse'}
              </h1>
              <p className="text-[11px] font-semibold text-[#FF8F4A] flex items-center gap-1">
                {isOwner ? <ShieldCheck className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
                {isOwner ? 'Owner Console' : 'Member App'}
              </p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                      isActive
                        ? 'glass-chip text-white shadow-[0_8px_20px_-6px_rgba(17,19,23,0.4)]'
                        : 'text-white/70 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-[#E56717]' : 'text-white/50'}`} />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10 space-y-3">
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/8 border border-white/15 p-2.5 shadow-sm">
              {profile?.profile_image ? (
                <img
                  src={profile.profile_image}
                  alt={user?.full_name}
                  className="h-10 w-10 rounded-xl object-cover border border-white/12 shrink-0"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF9A5A] to-[#E56717] text-xs font-extrabold text-white">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.full_name}</p>
                <p className="text-[11px] text-white/55 truncate">{user?.email || user?.phone}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2.5 text-xs font-semibold text-white/80 hover:glass-chip hover:text-white transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Apple-Style Header */}
      <header className="sticky top-0 z-30 flex md:hidden items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-2xl border-b border-white/15">
        <div className="flex items-center gap-3 min-w-0">
          {profile?.profile_image || (isOwner && gym?.logo_image) ? (
            <img
              src={profile?.profile_image || gym.logo_image}
              alt={isOwner ? `${gym?.gym_name || 'Gym'} logo` : user?.full_name}
              className="h-10 w-10 rounded-full object-cover border-2 border-white/15 shadow-sm shrink-0"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full glass-chip text-white text-xs font-bold shadow-sm">
              {isOwner ? <Dumbbell className="h-4 w-4 text-[#E56717]" /> : initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/55 truncate">
              Hi, {user?.full_name?.split(' ')[0]}
            </p>
            <p className="text-sm font-extrabold text-white truncate flex items-center gap-1">
              {isOwner ? gym?.gym_name || 'Owner Console' : 'Get Ready'}
              <Flame className="h-3.5 w-3.5 text-[#E56717]" />
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex h-10 w-10 items-center justify-center rounded-full glass-pill text-white hover:glass-chip hover:text-white transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:pl-68 pb-28 md:pb-8">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</div>
      </main>

      {/* Mobile Floating Apple Liquid Glass Bottom Tab Capsule */}
      <div className="fixed bottom-3 inset-x-0 z-30 flex justify-center md:hidden px-4 pointer-events-none">
        <nav className="pointer-events-auto glass-pill rounded-full px-2 py-1.5 flex items-center gap-1 shadow-xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-bold transition-all ${
                    isActive
                      ? 'glass-chip text-white shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#E56717]' : ''}`} />
                    {isActive && <span className="text-[11px]">{item.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {reminder && (
        <MembershipReminderModal countdown={reminder} profile={profile} gym={gym} onClose={() => setReminder(null)} />
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, UserCircle, Activity, Lock, Sparkles } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTransactionPopup } from '../../context/TransactionPopupContext';
import AvatarUpload from '../../components/AvatarUpload';

export default function CustomerProfile() {
  const { profile, setUser, setProfile } = useAuth();
  const { showSuccess } = useTransactionPopup();
  const navigate = useNavigate();

  const isOnboarding = profile && profile.onboarding_completed === false;

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    date_of_birth: '',
    gender: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    height_cm: '',
    weight_kg: '',
    fitness_goal: '',
    profile_image: '',
  });
  const [memberCode, setMemberCode] = useState('');
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiFetch('/profile').then((data) => {
      const u = data.user || {};
      const p = data.profile || {};
      setMemberCode(p.member_code || '');
      setForm({
        full_name: u.full_name || '',
        email: u.email || '',
        phone: u.phone || '',
        password: '',
        date_of_birth: p.date_of_birth ? String(p.date_of_birth).slice(0, 10) : '',
        gender: p.gender || '',
        address: p.address || '',
        emergency_contact_name: p.emergency_contact_name || '',
        emergency_contact_phone: p.emergency_contact_phone || '',
        height_cm: p.height_cm ?? '',
        weight_kg: p.weight_kg ?? '',
        fitness_goal: p.fitness_goal || '',
        profile_image: p.profile_image || '',
      });
    });
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const res = await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      if (res.user) setUser(res.user);
      if (res.profile) setProfile((prev) => ({ ...prev, ...res.profile }));

      if (res.onboardingCompletedNow) {
        showSuccess({
          title: 'Onboarding Completed!',
          message: 'Your profile and login credentials are set. You can now use all gym features normally.',
          details: [
            { label: 'Member ID', value: memberCode || '—' },
            { label: 'Login Email', value: res.user?.email || form.email },
          ],
        });
        navigate('/member');
      } else {
        showSuccess({
          title: 'Profile Updated Successfully!',
          message: 'Your personal details, photo, and fitness metrics have been saved.',
        });
      }
    } catch (error) {
      setErr(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setErr('');
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(pwForm),
      });
      setPwForm({ currentPassword: '', newPassword: '' });
      showSuccess({
        title: 'Password Updated Successfully!',
        message: 'Your account password has been changed.',
      });
    } catch (error) {
      setErr(error.message);
    }
  }

  const hMeters = Number(form.height_cm) / 100;
  const wKg = Number(form.weight_kg);
  const bmi = hMeters > 0 && wKg > 0 ? (wKg / (hMeters * hMeters)).toFixed(1) : null;

  return (
    <div className="space-y-6 max-w-4xl">
      {isOnboarding && (
        <div className="glass-dark p-5 flex items-start gap-3">
          <div className="rounded-full bg-[#E56717] p-2 text-white shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-white">Complete Your First-Time Onboarding Profile</p>
            <p className="text-xs text-white/75 mt-0.5 leading-relaxed">
              Your access code was verified! Fill in your email, set a password for future logins, upload your photo,
              and save your fitness details to unlock the normal member dashboard.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            {isOnboarding ? 'Complete Your' : 'My'}{' '}
            <span className="font-normal italic text-white/60">Profile</span>
          </h2>
          <p className="text-xs sm:text-sm text-white/55">
            Maintain your profile photo, personal details, emergency contacts, and fitness metrics
          </p>
        </div>
        {memberCode && (
          <span className="self-start rounded-full glass-chip px-4 py-1.5 text-xs font-mono font-bold text-[#FF9A5A]">
            ID: {memberCode}
          </span>
        )}
      </div>

      {err && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
          {err}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Profile Photo Upload */}
        <div className="glass-card p-6 space-y-3">
          <p className="text-sm font-extrabold text-white">Profile Photo</p>
          <AvatarUpload
            value={form.profile_image}
            name={form.full_name}
            onChange={(imgData) => setForm({ ...form, profile_image: imgData })}
          />
        </div>

        {/* Personal Info */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white border-b border-white/10 pb-3">
            <UserCircle className="h-4 w-4 text-[#E56717]" />
            Personal & Contact Details
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">
                Email {isOnboarding ? '*' : ''}
              </label>
              <input
                type="email"
                required={isOnboarding}
                disabled={!isOnboarding && Boolean(form.email)}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                className="input-glass w-full px-4 py-2.5 text-sm disabled:opacity-65"
              />
            </div>
            {isOnboarding && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-white/80 mb-1">
                  Set Login Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Create a password for future sign-ins"
                  className="input-glass w-full px-4 py-2.5 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">Gender</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className="input-glass w-full px-3.5 py-2.5 text-sm"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-white/80 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  className="input-glass w-full px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-white/80 mb-1">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Emergency Contact Name</label>
              <input
                type="text"
                value={form.emergency_contact_name}
                onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Emergency Contact Phone</label>
              <input
                type="tel"
                value={form.emergency_contact_phone}
                onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Fitness Metrics */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-white">
              <Activity className="h-4 w-4 text-[#E56717]" />
              Fitness & Body Metrics
            </div>
            {bmi && (
              <span className="rounded-full glass-chip px-3 py-1 text-xs font-bold text-[#FF9A5A]">
                BMI: {bmi}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Height (cm)</label>
              <input
                type="number"
                step="0.1"
                value={form.height_cm}
                onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={form.weight_kg}
                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1">Fitness Goal</label>
              <input
                type="text"
                value={form.fitness_goal}
                onChange={(e) => setForm({ ...form, fitness_goal: e.target.value })}
                placeholder="e.g. Lean Muscle Gain"
                className="input-glass w-full px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-[#E56717] px-6 py-3 text-xs font-bold text-white hover:bg-[#C8560F] shadow-lg shadow-[#E56717]/30 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : isOnboarding ? 'Complete Onboarding & Continue' : 'Save Profile'}
          </button>
        </div>
      </form>

      {!isOnboarding && (
        <form onSubmit={handlePasswordChange} className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white border-b border-white/10 pb-3">
            <Lock className="h-4 w-4 text-[#E56717]" />
            Account Password
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="password"
              required
              placeholder="Current Password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              className="input-glass px-4 py-2.5 text-sm"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="New Password (min 6 chars)"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              className="input-glass px-4 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-full btn-papaya px-5 py-2.5 text-xs font-bold text-white hover:brightness-110 transition-colors"
          >
            Update Password
          </button>
        </form>
      )}
    </div>
  );
}

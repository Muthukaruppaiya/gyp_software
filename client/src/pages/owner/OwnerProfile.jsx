import { useEffect, useState } from 'react';
import { Save, Building2, Lock } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTransactionPopup } from '../../context/TransactionPopupContext';

export default function OwnerProfile() {
  const { setGym, setUser } = useAuth();
  const { showSuccess } = useTransactionPopup();

  const [ownerForm, setOwnerForm] = useState({ full_name: '', phone: '', email: '' });
  const [gymForm, setGymForm] = useState({
    gym_name: '',
    tagline: '',
    phone: '',
    email: '',
    address: '',
    opening_hours: '',
    currency_symbol: '₹',
  });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [err, setErr] = useState('');

  useEffect(() => {
    apiFetch('/profile').then((data) => {
      setOwnerForm({
        full_name: data.user?.full_name || '',
        phone: data.user?.phone || '',
        email: data.user?.email || '',
      });
      if (data.gym) {
        setGymForm({
          gym_name: data.gym.gym_name || '',
          tagline: data.gym.tagline || '',
          phone: data.gym.phone || '',
          email: data.gym.email || '',
          address: data.gym.address || '',
          opening_hours: data.gym.opening_hours || '',
          currency_symbol: data.gym.currency_symbol || '₹',
        });
      }
    });
  }, []);

  async function saveOwnerAndGym(e) {
    e.preventDefault();
    setErr('');
    try {
      const [uRes, gRes] = await Promise.all([
        apiFetch('/profile', {
          method: 'PUT',
          body: JSON.stringify({ full_name: ownerForm.full_name, phone: ownerForm.phone }),
        }),
        apiFetch('/profile/gym', {
          method: 'PUT',
          body: JSON.stringify(gymForm),
        }),
      ]);
      setUser(uRes.user);
      setGym(gRes.gym);
      showSuccess({
        title: 'Gym & Owner Profile Saved!',
        message: 'Your studio branding, hours, and owner details have been updated.',
      });
    } catch (error) {
      setErr(error.message);
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
        message: 'Your owner account password has been changed.',
      });
    } catch (error) {
      setErr(error.message);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white">
          Studio <span className="font-normal italic text-white/60">& Owner Profile</span>
        </h2>
        <p className="text-xs sm:text-sm text-white/55">
          Maintain your gym branding, operating hours, contact details, and security
        </p>
      </div>

      {err && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
          {err}
        </div>
      )}

      <form onSubmit={saveOwnerAndGym} className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white border-b border-white/10 pb-3">
          <Building2 className="h-4 w-4 text-[#E56717]" />
          Owner & Studio Details
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Owner Name</label>
            <input
              type="text"
              required
              value={ownerForm.full_name}
              onChange={(e) => setOwnerForm({ ...ownerForm, full_name: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Owner Phone</label>
            <input
              type="tel"
              value={ownerForm.phone}
              onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Gym Name</label>
            <input
              type="text"
              required
              value={gymForm.gym_name}
              onChange={(e) => setGymForm({ ...gymForm, gym_name: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Tagline</label>
            <input
              type="text"
              value={gymForm.tagline}
              onChange={(e) => setGymForm({ ...gymForm, tagline: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Gym Contact Email</label>
            <input
              type="email"
              value={gymForm.email}
              onChange={(e) => setGymForm({ ...gymForm, email: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/80 mb-1">Currency Symbol</label>
            <input
              type="text"
              value={gymForm.currency_symbol}
              onChange={(e) => setGymForm({ ...gymForm, currency_symbol: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-white/80 mb-1">Opening Hours</label>
            <input
              type="text"
              value={gymForm.opening_hours}
              onChange={(e) => setGymForm({ ...gymForm, opening_hours: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-white/80 mb-1">Gym Address</label>
            <textarea
              rows={2}
              value={gymForm.address}
              onChange={(e) => setGymForm({ ...gymForm, address: e.target.value })}
              className="input-glass w-full px-4 py-2.5 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full btn-papaya px-6 py-3 text-xs font-bold text-white hover:brightness-110 transition-colors shadow-md"
        >
          <Save className="h-4 w-4" />
          Save Profile Settings
        </button>
      </form>

      <form onSubmit={handlePasswordChange} className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white border-b border-white/10 pb-3">
          <Lock className="h-4 w-4 text-[#E56717]" />
          Change Password
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
    </div>
  );
}

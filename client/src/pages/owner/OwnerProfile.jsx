import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, Building2, Lock, IndianRupee, UserCog, Share2, Wallet, ImageIcon } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTransactionPopup } from '../../context/TransactionPopupContext';
import AvatarUpload from '../../components/AvatarUpload';
import PlanPricingManager from '../../components/PlanPricingManager';

const TABS = [
  { id: 'gym', label: 'Gym Profile', icon: Building2 },
  { id: 'pricing', label: 'Membership Pricing', icon: IndianRupee },
  { id: 'account', label: 'Owner Account', icon: UserCog },
];

const EMPTY_GYM = {
  gym_name: '',
  tagline: '',
  phone: '',
  email: '',
  address: '',
  opening_hours: '',
  currency_symbol: '₹',
  logo_image: '',
  whatsapp: '',
  website: '',
  instagram: '',
  upi_id: '',
  gstin: '',
};

function Field({ label, hint, className = '', children }) {
  return (
    <div className={className}>
      <label className="block text-xs font-bold text-white/80 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-white/45">{hint}</p>}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 text-sm font-extrabold text-white border-b border-white/10 pb-3">
      <Icon className="h-4 w-4 text-[#E56717]" />
      {children}
    </div>
  );
}

export default function OwnerProfile() {
  const { gym, setGym, setUser } = useAuth();
  const { showSuccess } = useTransactionPopup();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'gym';

  const [ownerForm, setOwnerForm] = useState({ full_name: '', phone: '', email: '' });
  const [gymForm, setGymForm] = useState(EMPTY_GYM);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/profile').then((data) => {
      setOwnerForm({
        full_name: data.user?.full_name || '',
        phone: data.user?.phone || '',
        email: data.user?.email || '',
      });
      if (data.gym) {
        const next = { ...EMPTY_GYM };
        for (const key of Object.keys(EMPTY_GYM)) next[key] = data.gym[key] ?? EMPTY_GYM[key];
        setGymForm(next);
      }
    });
  }, []);

  function switchTab(id) {
    setErr('');
    setSearchParams(id === 'gym' ? {} : { tab: id });
  }

  const setG = (key) => (e) => setGymForm({ ...gymForm, [key]: e.target.value });

  async function saveGym(e) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const res = await apiFetch('/profile/gym', { method: 'PUT', body: JSON.stringify(gymForm) });
      setGym(res.gym);
      showSuccess({
        title: 'Gym Profile Saved!',
        message: 'Your gym branding, contact details and payment info have been updated for all members.',
      });
    } catch (error) {
      setErr(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveOwner(e) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const res = await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: ownerForm.full_name, phone: ownerForm.phone, email: ownerForm.email }),
      });
      setUser(res.user);
      showSuccess({ title: 'Owner Details Saved!', message: 'Your account details have been updated.' });
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
        message: 'Your owner account password has been changed.',
      });
    } catch (error) {
      setErr(error.message);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white">
          Gym <span className="font-normal italic text-white/60">Settings</span>
        </h2>
        <p className="text-xs sm:text-sm text-white/55">
          Manage your gym profile, membership pricing, and owner account
        </p>
      </div>

      <div className="inline-flex max-w-full overflow-x-auto rounded-full glass-subtle p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-all ${
                tab === t.id ? 'glass-chip text-white shadow-sm' : 'text-white/60 hover:text-white'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${tab === t.id ? 'text-[#E56717]' : ''}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {err && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
          {err}
        </div>
      )}

      {tab === 'pricing' && <PlanPricingManager currency={gym?.currency_symbol || '₹'} />}

      {tab === 'gym' && (
        <form onSubmit={saveGym} className="space-y-5">
          <div className="glass-card p-6 space-y-5">
            <SectionTitle icon={ImageIcon}>Branding</SectionTitle>
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="shrink-0">
                <p className="text-xs font-bold text-white/80 mb-2">Gym Logo</p>
                <AvatarUpload
                  value={gymForm.logo_image}
                  name={gymForm.gym_name || 'Gym'}
                  onChange={(img) => setGymForm({ ...gymForm, logo_image: img || '' })}
                />
              </div>
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Gym Name">
                  <input
                    type="text"
                    required
                    maxLength={150}
                    value={gymForm.gym_name}
                    onChange={setG('gym_name')}
                    className="input-glass w-full px-4 py-2.5 text-sm"
                  />
                </Field>
                <Field label="Tagline">
                  <input
                    type="text"
                    maxLength={255}
                    value={gymForm.tagline}
                    onChange={setG('tagline')}
                    className="input-glass w-full px-4 py-2.5 text-sm"
                  />
                </Field>
                <Field label="Opening Hours" className="sm:col-span-2">
                  <input
                    type="text"
                    value={gymForm.opening_hours}
                    onChange={setG('opening_hours')}
                    placeholder="e.g. Mon–Sat 05:30 AM - 10:30 PM, Sun 6 AM - 12 PM"
                    className="input-glass w-full px-4 py-2.5 text-sm"
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 space-y-5">
            <SectionTitle icon={Building2}>Contact & Location</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Front Desk Phone">
                <input type="tel" value={gymForm.phone} onChange={setG('phone')} className="input-glass w-full px-4 py-2.5 text-sm" />
              </Field>
              <Field label="WhatsApp Number">
                <input
                  type="tel"
                  value={gymForm.whatsapp}
                  onChange={setG('whatsapp')}
                  placeholder="+91 98765 43210"
                  className="input-glass w-full px-4 py-2.5 text-sm"
                />
              </Field>
              <Field label="Gym Contact Email">
                <input type="email" value={gymForm.email} onChange={setG('email')} className="input-glass w-full px-4 py-2.5 text-sm" />
              </Field>
              <Field label="Gym Address" className="sm:col-span-2">
                <textarea rows={2} value={gymForm.address} onChange={setG('address')} className="input-glass w-full px-4 py-2.5 text-sm" />
              </Field>
            </div>
          </div>

          <div className="glass-card p-6 space-y-5">
            <SectionTitle icon={Share2}>Online Presence</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Website">
                <input
                  type="text"
                  value={gymForm.website}
                  onChange={setG('website')}
                  placeholder="www.yourgym.in"
                  className="input-glass w-full px-4 py-2.5 text-sm"
                />
              </Field>
              <Field label="Instagram Handle">
                <input
                  type="text"
                  value={gymForm.instagram}
                  onChange={setG('instagram')}
                  placeholder="@yourgym"
                  className="input-glass w-full px-4 py-2.5 text-sm"
                />
              </Field>
            </div>
          </div>

          <div className="glass-card p-6 space-y-5">
            <SectionTitle icon={Wallet}>Payments & Billing</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="UPI ID" hint="Shown to members in their renewal reminder">
                <input
                  type="text"
                  value={gymForm.upi_id}
                  onChange={setG('upi_id')}
                  placeholder="yourgym@okhdfcbank"
                  className="input-glass w-full px-4 py-2.5 text-sm"
                />
              </Field>
              <Field label="GSTIN (optional)" hint="15-character GST number">
                <input
                  type="text"
                  maxLength={15}
                  value={gymForm.gstin}
                  onChange={(e) => setGymForm({ ...gymForm, gstin: e.target.value.toUpperCase() })}
                  placeholder="29ABCDE1234F1Z5"
                  className="input-glass w-full px-4 py-2.5 text-sm font-mono"
                />
              </Field>
              <Field label="Currency Symbol">
                <input
                  type="text"
                  maxLength={10}
                  value={gymForm.currency_symbol}
                  onChange={setG('currency_symbol')}
                  className="input-glass w-full px-4 py-2.5 text-sm"
                />
              </Field>
            </div>
            <p className="text-xs text-white/50">
              Plan prices (first-month and regular) are managed in the{' '}
              <button type="button" onClick={() => switchTab('pricing')} className="font-bold text-[#FF8F4A] hover:underline">
                Membership Pricing
              </button>{' '}
              tab.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full btn-papaya px-6 py-3 text-xs font-bold text-white hover:brightness-110 transition-colors shadow-md disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Gym Profile'}
          </button>
        </form>
      )}

      {tab === 'account' && (
        <>
          <form onSubmit={saveOwner} className="glass-card p-6 space-y-5">
            <SectionTitle icon={UserCog}>Owner Details</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Owner Name">
                <input
                  type="text"
                  required
                  value={ownerForm.full_name}
                  onChange={(e) => setOwnerForm({ ...ownerForm, full_name: e.target.value })}
                  className="input-glass w-full px-4 py-2.5 text-sm"
                />
              </Field>
              <Field label="Owner Phone">
                <input
                  type="tel"
                  value={ownerForm.phone}
                  onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })}
                  className="input-glass w-full px-4 py-2.5 text-sm"
                />
              </Field>
              <Field label="Login Email">
                <input
                  type="email"
                  value={ownerForm.email}
                  onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
                  className="input-glass w-full px-4 py-2.5 text-sm"
                />
              </Field>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full btn-papaya px-6 py-3 text-xs font-bold text-white hover:brightness-110 transition-colors shadow-md disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Save Owner Details
            </button>
          </form>

          <form onSubmit={handlePasswordChange} className="glass-card p-6 space-y-4">
            <SectionTitle icon={Lock}>Change Password</SectionTitle>
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
        </>
      )}
    </div>
  );
}

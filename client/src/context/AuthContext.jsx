import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch, getToken, setToken } from '../api/client';
import { markReminderPending } from '../utils/membership';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [gym, setGym] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch('/auth/me');
      setUser(data.user);
      setProfile(data.profile || null);
      setGym(data.gym || null);
    } catch {
      setToken(null);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  async function login(identifier, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setToken(data.token);
    setUser(data.user);
    setProfile(data.profile || null);
    setGym(data.gym || null);
    // Members get a one-time renewal reminder check right after signing in.
    if (data.user?.role === 'customer') markReminderPending();
    return { user: data.user, profile: data.profile, gym: data.gym };
  }

  // Platform super admin: separate endpoint, only reachable from the unlisted admin login page.
  async function adminLogin(identifier, password) {
    const data = await apiFetch('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setToken(data.token);
    setUser(data.user);
    setProfile(null);
    setGym(null);
    return data.user;
  }

  async function onboardLogin(onboardingCode) {
    const data = await apiFetch('/auth/onboard-login', {
      method: 'POST',
      body: JSON.stringify({ onboarding_code: onboardingCode }),
    });
    setToken(data.token);
    setUser(data.user);
    setProfile(data.profile || null);
    setGym(data.gym || null);
    return data;
  }

  function logout() {
    setToken(null);
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        gym,
        loading,
        login,
        onboardLogin,
        adminLogin,
        logout,
        refreshSession: loadSession,
        setGym,
        setUser,
        setProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

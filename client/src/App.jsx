import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TransactionPopupProvider } from './context/TransactionPopupContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import OwnerAttendance from './pages/owner/OwnerAttendance';
import OwnerMembers from './pages/owner/OwnerMembers';
import OwnerFees from './pages/owner/OwnerFees';
import OwnerReports from './pages/owner/OwnerReports';
import OwnerProfile from './pages/owner/OwnerProfile';
import OwnerInsights from './pages/owner/OwnerInsights';
import CustomerVisits from './pages/customer/CustomerVisits';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CustomerAttendance from './pages/customer/CustomerAttendance';
import CustomerFees from './pages/customer/CustomerFees';
import CustomerProfile from './pages/customer/CustomerProfile';

function ProtectedRoute({ allowedRole, children }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080A] flex items-center justify-center text-sm text-slate-400">
        Loading portal...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'owner' ? '/owner' : '/member'} replace />;
  }

  // Enforce first-time profile completion before entering normal customer flow
  if (
    user.role === 'customer' &&
    profile &&
    profile.onboarding_completed === false &&
    location.pathname !== '/member/profile'
  ) {
    return <Navigate to="/member/profile" replace />;
  }

  return <Layout>{children}</Layout>;
}

function HomeRedirect() {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080A] flex items-center justify-center text-sm text-slate-400">
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'owner') return <Navigate to="/owner" replace />;
  if (profile && profile.onboarding_completed === false) {
    return <Navigate to="/member/profile" replace />;
  }
  return <Navigate to="/member" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <TransactionPopupProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Gym Owner Portal */}
            <Route
              path="/owner"
              element={
                <ProtectedRoute allowedRole="owner">
                  <OwnerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/attendance"
              element={
                <ProtectedRoute allowedRole="owner">
                  <OwnerAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/members"
              element={
                <ProtectedRoute allowedRole="owner">
                  <OwnerMembers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/fees"
              element={
                <ProtectedRoute allowedRole="owner">
                  <OwnerFees />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/reports"
              element={
                <ProtectedRoute allowedRole="owner">
                  <OwnerReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/profile"
              element={
                <ProtectedRoute allowedRole="owner">
                  <OwnerProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/owner/insights/:kind"
              element={
                <ProtectedRoute allowedRole="owner">
                  <OwnerInsights />
                </ProtectedRoute>
              }
            />

            {/* Gym Customer Portal */}
            <Route
              path="/member"
              element={
                <ProtectedRoute allowedRole="customer">
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/member/attendance"
              element={
                <ProtectedRoute allowedRole="customer">
                  <CustomerAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/member/visits"
              element={
                <ProtectedRoute allowedRole="customer">
                  <CustomerVisits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/member/fees"
              element={
                <ProtectedRoute allowedRole="customer">
                  <CustomerFees />
                </ProtectedRoute>
              }
            />
            <Route
              path="/member/profile"
              element={
                <ProtectedRoute allowedRole="customer">
                  <CustomerProfile />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </BrowserRouter>
      </TransactionPopupProvider>
    </AuthProvider>
  );
}

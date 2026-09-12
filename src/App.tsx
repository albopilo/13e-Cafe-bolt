import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { CartProvider } from '@/context/CartContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { MenuPage } from '@/pages/customer/MenuPage';
import { CheckoutPage } from '@/pages/customer/CheckoutPage';
import { QrisPaymentPage } from '@/pages/customer/QrisPaymentPage';
import { OrderHistoryPage } from '@/pages/customer/OrderHistoryPage';
import { RegisterPage } from '@/pages/customer/RegisterPage';
import { LoginPage } from '@/pages/customer/LoginPage';
import { ProfilePage } from '@/pages/customer/ProfilePage';
import { StaffDashboard } from '@/pages/staff/StaffDashboard';
import { AdminPanel } from '@/pages/admin/AdminPanel';
import type { ReactNode } from 'react';

function AdminRoute({ children }: { children: ReactNode }) {
  const { session, isAdmin, isMainKitchen, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-espresso-300">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!isAdmin && !isMainKitchen) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function StaffRoute({ children }: { children: ReactNode }) {
  const { session, isAdmin, isStaff, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-espresso-300">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!isAdmin && !isStaff) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MenuPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/qris-payment" element={<QrisPaymentPage />} />
      <Route path="/orders" element={<OrderHistoryPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/staff" element={
        <StaffRoute>
          <StaffDashboard />
        </StaffRoute>
      } />
      <Route path="/admin" element={
        <AdminRoute>
          <AdminPanel />
        </AdminRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <CartProvider>
              <AppRoutes />
            </CartProvider>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

/**
 * App.jsx
 * ------------------------------------------------------------
 * Top-level router with code-splitting: every page is lazily
 * loaded via React.lazy so the initial bundle stays small and
 * each route is a separate chunk (better caching + performance).
 * A Suspense fallback shows a branded loader during chunk loads.
 */
import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/layout/Layout.jsx';
import Loader from './components/ui/Loader.jsx';

// Public pages
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));

// App pages
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const ScanHistory = lazy(() => import('./pages/ScanHistory.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const UrlScanner = lazy(() => import('./pages/modules/UrlScanner.jsx'));
const PasswordAnalyzer = lazy(() => import('./pages/modules/PasswordAnalyzer.jsx'));
const EmailPhishing = lazy(() => import('./pages/modules/EmailPhishing.jsx'));
const FileScanner = lazy(() => import('./pages/modules/FileScanner.jsx'));
const QrChecker = lazy(() => import('./pages/modules/QrChecker.jsx'));
const Chatbot = lazy(() => import('./pages/modules/Chatbot.jsx'));
const ReportGenerator = lazy(() => import('./pages/modules/ReportGenerator.jsx'));

// Admin
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics.jsx'));

const Fallback = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <Loader label="Loading…" />
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="history" element={<ScanHistory />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="scan/url" element={<UrlScanner />} />
          <Route path="scan/password" element={<PasswordAnalyzer />} />
          <Route path="scan/email" element={<EmailPhishing />} />
          <Route path="scan/file" element={<FileScanner />} />
          <Route path="scan/qr" element={<QrChecker />} />
          <Route path="chat" element={<Chatbot />} />
          <Route path="report" element={<ReportGenerator />} />

          {/* Admin-only */}
          <Route path="admin/users" element={<ProtectedRoute role="admin"><AdminUsers /></ProtectedRoute>} />
          <Route path="admin/analytics" element={<ProtectedRoute role="admin"><AdminAnalytics /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Suspense>
  );
}

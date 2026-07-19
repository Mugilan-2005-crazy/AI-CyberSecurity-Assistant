/**
 * components/ProtectedRoute.jsx
 * ------------------------------------------------------------
 * Route guard: redirects unauthenticated users to /login and
 * optionally restricts to a given role (e.g. 'admin'). Shows a
 * loader while the auth state is resolving.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return children;
}

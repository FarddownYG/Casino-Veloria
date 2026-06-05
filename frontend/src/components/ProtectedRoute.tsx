import { Navigate, useLocation } from 'react-router-dom';
import { useIsAuthenticated } from '@/hooks/useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuth = useIsAuthenticated();
  const location = useLocation();
  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

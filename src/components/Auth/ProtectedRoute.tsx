import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import useAuthStore from "../../stores/auth";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Gate for anything that needs a session.
 *
 * This is a UX guard, not a security boundary -- the API rejects unauthenticated
 * requests on its own. Its job is to stop the dashboard from mounting a dozen
 * panels that would each fire a request destined to 401.
 */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  // Subscribing to `token` (not calling isAuthenticated()) is what makes this
  // re-render when the 401 interceptor clears the session mid-session.
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!token || !isAuthenticated()) {
    // Remember where they were going so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { ROUTES } from "./routeConstants.js";

function RoleRoute({ allowedRoles, children }) {
  const { isAuthenticated, isInitialized, isLoading, role } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth is being initialized on app load
  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(role)) {
    // Redirect to the appropriate dashboard based on role
    const redirectPath =
      role === "owner"
        ? ROUTES.OWNER_DASHBOARD
        : role === "admin"
          ? ROUTES.ADMIN_DASHBOARD
          : ROUTES.CUSTOMER_DASHBOARD;

    return <Navigate to={redirectPath} replace />;
  }

  return children;
}

export default RoleRoute;

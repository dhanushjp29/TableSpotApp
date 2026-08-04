import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { ROUTES } from "./routeConstants.js";

function RoleRoute({ allowedRoles, children }) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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

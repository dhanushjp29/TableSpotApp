import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import Avatar from "../components/ui/Avatar.jsx";
import { ROUTES } from "../routes/routeConstants.js";

const roleDashboard = {
  customer: ROUTES.CUSTOMER_DASHBOARD,
  owner: ROUTES.OWNER_DASHBOARD,
  admin: ROUTES.ADMIN_DASHBOARD,
};

function PublicLayout() {
  const { isAuthenticated, user, role } = useAuth();
  const dashboardPath = roleDashboard[role] || ROUTES.CUSTOMER_DASHBOARD;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">TableSpot</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link to={ROUTES.RESTAURANTS} className="text-sm font-medium text-text hover:text-primary">
              Restaurants
            </Link>
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  to={dashboardPath}
                  className="text-sm font-medium text-text hover:text-primary"
                >
                  Dashboard
                </Link>
                <Link
                  to={dashboardPath}
                  className="flex items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-3 transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <Avatar user={user} size={28} />
                  <span className="text-sm font-medium text-text max-w-[120px] truncate">
                    {user?.fullName || user?.name || "My Account"}
                  </span>
                </Link>
              </div>
            ) : (
              <>
                <Link to={ROUTES.LOGIN} className="text-sm font-medium text-text hover:text-primary">
                  Login
                </Link>
                <Link to={ROUTES.REGISTER} className="btn-primary text-sm">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-gray-100 bg-surface py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted sm:px-6 lg:px-8">
          © {new Date().getFullYear()} TableSpot. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;

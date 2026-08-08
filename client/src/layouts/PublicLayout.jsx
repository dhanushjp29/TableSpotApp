import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import Avatar from "../components/ui/Avatar.jsx";
import ThemeToggle from "../components/theme/ThemeToggle.jsx";
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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-sm">
              T
            </span>
            <div className="leading-tight">
              <span className="block text-base font-bold tracking-tight text-text">
                TableSpot
              </span>
              <span className="block text-[11px] uppercase tracking-[0.28em] text-muted">
                Restaurant reservations
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link
              to={ROUTES.RESTAURANTS}
              className="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            >
              Restaurants
            </Link>
            <Link
              to={ROUTES.FOODS}
              className="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            >
              Food
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Link
                  to={dashboardPath}
                  className="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
                >
                  Dashboard
                </Link>
                <Link
                  to={dashboardPath}
                  className="flex items-center gap-2 rounded-full border border-border bg-surface px-1.5 py-1 pr-3 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-primary/30 hover:bg-surface-hover hover:shadow-md"
                >
                  <Avatar user={user} size={28} />
                  <span className="max-w-[120px] truncate text-sm font-medium text-text">
                    {user?.fullName || user?.name || "My Account"}
                  </span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Link
                  to={ROUTES.LOGIN}
                  className="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
                >
                  Login
                </Link>
                <Link to={ROUTES.REGISTER} className="btn-primary text-sm">
                  Register
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent" />
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface-secondary/60 py-10 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-text">TableSpot</p>
          <p className="mt-1 text-sm text-muted">
            (c) {new Date().getFullYear()} TableSpot. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;

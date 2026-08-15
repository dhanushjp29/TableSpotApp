import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import Avatar from "../components/ui/Avatar.jsx";
import ThemeToggle from "../components/theme/ThemeToggle.jsx";
import { useTheme } from "../hooks/useTheme.js";
import { ROUTES } from "../routes/routeConstants.js";

const roleDashboard = {
  customer: ROUTES.CUSTOMER_DASHBOARD,
  owner: ROUTES.OWNER_DASHBOARD,
  admin: ROUTES.ADMIN_DASHBOARD,
};

function PublicLayout() {
  const { isAuthenticated, user, role } = useAuth();
  const { resolvedTheme } = useTheme();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isListingPage =
    pathname === ROUTES.RESTAURANTS ||
    pathname.startsWith("/restaurants/") ||
    pathname === ROUTES.FOODS ||
    pathname.startsWith("/foods/");
  const dashboardPath = roleDashboard[role] || ROUTES.CUSTOMER_DASHBOARD;
  const logo =
    resolvedTheme === "dark"
      ? "/08_dark_horizontal_logo.png"
      : "/09_light_horizontal_logo.png";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinkClasses = (isActive) =>
    isListingPage
      ? isActive
        ? "inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
        : "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
      : "text-sm font-medium text-text-secondary transition-colors hover:text-primary";

  const mobileLinkClasses = (isActive) =>
    `flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
      isActive
        ? "bg-primary text-white shadow-sm"
        : "text-text-secondary hover:bg-surface-hover hover:text-primary"
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
          isListingPage
            ? "border-border bg-background/85"
            : "border-primary/20 bg-[rgba(74,11,22,.72)] shadow-[0_10px_32px_rgba(74,11,22,.14)]"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="TableSpot" className="h-12 w-auto object-contain" />
            <div className="leading-tight">
              <span className="block text-[11px] uppercase tracking-[0.28em] text-muted">
                Restaurant reservations
              </span>
            </div>
          </Link>

          <nav
            data-joyride="main-navbar"
            className={`hidden items-center md:flex ${isListingPage ? "gap-2" : "gap-6"}`}
          >
            <NavLink to={ROUTES.RESTAURANTS} className={({ isActive }) => navLinkClasses(isActive)}>
              Restaurants
            </NavLink>
            <NavLink to={ROUTES.FOODS} className={({ isActive }) => navLinkClasses(isActive)}>
              Food
            </NavLink>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Link
                  to={dashboardPath}
                  className={
                    isListingPage
                      ? "btn-outline text-sm"
                      : "text-sm font-medium text-text-secondary transition-colors hover:text-primary"
                  }
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
                  className={
                    isListingPage
                      ? "btn-outline text-sm"
                      : "text-sm font-medium text-text-secondary transition-colors hover:text-primary"
                  }
                >
                  Login
                </Link>
                <Link to={ROUTES.REGISTER} className="btn-primary text-sm">
                  Register
                </Link>
              </div>
            )}
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileOpen((current) => !current)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
                isListingPage
                  ? "border-border bg-surface text-text hover:bg-surface-hover"
                  : "border-white/15 bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border bg-background md:hidden">
            <nav className="mx-auto max-w-7xl space-y-1 px-4 py-4 sm:px-6">
              <NavLink
                to={ROUTES.RESTAURANTS}
                className={({ isActive }) => mobileLinkClasses(isActive)}
              >
                Restaurants
              </NavLink>
              <NavLink
                to={ROUTES.FOODS}
                className={({ isActive }) => mobileLinkClasses(isActive)}
              >
                Food
              </NavLink>

              {isAuthenticated ? (
                <>
                  <Link
                    to={dashboardPath}
                    className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-surface-hover"
                  >
                    Dashboard
                  </Link>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
                    <Avatar user={user} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                      {user?.fullName || user?.name || "My Account"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <Link
                    to={ROUTES.LOGIN}
                    className="btn-outline w-full text-sm"
                  >
                    Login
                  </Link>
                  <Link
                    to={ROUTES.REGISTER}
                    className="btn-primary w-full text-sm"
                  >
                    Register
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
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

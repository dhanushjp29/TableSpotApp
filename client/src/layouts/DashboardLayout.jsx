import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  LayoutDashboard,
  Building2,
  UtensilsCrossed,
  CalendarDays,
  ReceiptText,
  Star,
  BarChart3,
  Users,
  Heart,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  History,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { logoutUser } from "../store/slices/authSlice.js";
import { toggleSidebar } from "../store/slices/uiSlice.js";
import { fetchUnreadCount } from "../store/slices/notificationSlice.js";
import { ROUTES } from "../routes/routeConstants.js";
import Avatar from "../components/ui/Avatar.jsx";
import ThemeToggle from "../components/theme/ThemeToggle.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";

const roleNavConfig = {
  customer: [
    { to: ROUTES.CUSTOMER_DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
    { to: ROUTES.CUSTOMER_BOOKINGS, label: "My Bookings", icon: CalendarDays },
    { to: ROUTES.CUSTOMER_PAYMENTS, label: "Payments", icon: History },
    { to: ROUTES.CUSTOMER_REFUNDS, label: "Refunds", icon: RotateCcw },
    { to: ROUTES.CUSTOMER_FAVORITES, label: "Favorites", icon: Heart },
    { to: ROUTES.CUSTOMER_NOTIFICATIONS, label: "Notifications", icon: Bell },
    { to: ROUTES.CUSTOMER_PROFILE, label: "Profile", icon: User },
  ],
  owner: [
    { to: ROUTES.OWNER_DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
    { to: ROUTES.OWNER_RESTAURANT, label: "Restaurant", icon: Building2 },
    { to: ROUTES.OWNER_TABLES, label: "Tables", icon: LayoutDashboard },
    { to: ROUTES.OWNER_FOODS, label: "Food Menu", icon: UtensilsCrossed },
    { to: ROUTES.OWNER_RESERVATIONS, label: "Reservations", icon: CalendarDays },
    { to: ROUTES.OWNER_BILLING, label: "Billing", icon: ReceiptText },
    { to: ROUTES.OWNER_PAYMENTS, label: "Payments", icon: History },
    { to: ROUTES.OWNER_REFUNDS, label: "Refunds", icon: RotateCcw },
    { to: ROUTES.OWNER_REVIEWS, label: "Reviews", icon: Star },
    { to: ROUTES.OWNER_REPORTS, label: "Reports", icon: BarChart3 },
    { to: ROUTES.OWNER_NOTIFICATIONS, label: "Notifications", icon: Bell },
    { to: ROUTES.OWNER_PROFILE, label: "Profile", icon: User },
  ],
  admin: [
    { to: ROUTES.ADMIN_DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
    { to: ROUTES.ADMIN_USERS, label: "Users", icon: Users },
    { to: ROUTES.ADMIN_RESTAURANTS, label: "Restaurants", icon: Building2 },
    { to: ROUTES.ADMIN_REVIEWS, label: "Reviews", icon: Star },
    { to: ROUTES.ADMIN_REPORTS, label: "Reports", icon: BarChart3 },
    { to: ROUTES.ADMIN_NOTIFICATIONS, label: "Notifications", icon: Bell },
    { to: ROUTES.ADMIN_PROFILE, label: "Profile", icon: User },
  ],
};

const NOTIFICATION_ROUTE = {
  customer: ROUTES.CUSTOMER_NOTIFICATIONS,
  owner: ROUTES.OWNER_NOTIFICATIONS,
  admin: ROUTES.ADMIN_NOTIFICATIONS,
};

function DashboardLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const sidebarOpen = useSelector((state) => state.ui.sidebarOpen);
  const unreadCount = useSelector((state) => state.notification.unreadCount);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = roleNavConfig[role] || [];

  useEffect(() => {
    const poll = () => {
      dispatch(fetchUnreadCount()).catch(() => {});
    };

    poll();
    const interval = setInterval(poll, 20000);
    const handleUpdated = () => poll();
    window.addEventListener("notifications-updated", handleUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications-updated", handleUpdated);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!role) {
      navigate(ROUTES.LOGIN, { replace: true });
    }
  }, [role, navigate]);

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    await dispatch(logoutUser());
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(198,40,40,0.08),transparent_25%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.05),transparent_20%)]" />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => dispatch(toggleSidebar())}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 transform flex-col border-r border-border bg-surface/90 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-sm">
              T
            </span>
            <div className="leading-tight">
              <span className="block text-base font-bold tracking-tight text-text">
                TableSpot
              </span>
              <span className="block text-[11px] uppercase tracking-[0.28em] text-muted">
                {role} portal
              </span>
            </div>
          </Link>
          <button
            className="icon-btn lg:hidden"
            onClick={() => dispatch(toggleSidebar())}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "nav-item-active" : "nav-item-inactive"}`
                }
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
                {item.label === "Notifications" && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
            Signed in as
          </p>
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-surface-secondary/60 p-3">
            <Avatar user={user} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{user?.fullName}</p>
              <p className="truncate text-xs text-muted">{role}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <button
              className="icon-btn lg:hidden"
              onClick={() => dispatch(toggleSidebar())}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <Link
                to={NOTIFICATION_ROUTE[role] || ROUTES.CUSTOMER_NOTIFICATIONS}
                className="icon-btn relative"
                aria-label="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <div className="hidden items-center gap-3 sm:flex">
                <Avatar user={user} size={36} />
                <div>
                  <p className="text-sm font-medium text-text">{user?.fullName}</p>
                  <p className="text-xs capitalize text-muted">{role}</p>
                </div>
              </div>
              <button
                onClick={() => setLogoutOpen(true)}
                className="icon-btn"
                aria-label="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        isOpen={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogoutConfirm}
        title="Log out?"
        description="Are you sure you want to log out of your account?"
        confirmText="Log out"
        cancelText="Cancel"
        variant="danger"
        isLoading={isLoggingOut}
      />
    </div>
  );
}

export default DashboardLayout;

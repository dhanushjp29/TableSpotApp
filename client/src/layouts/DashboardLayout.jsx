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
} from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { logoutUser } from "../store/slices/authSlice.js";
import { toggleSidebar } from "../store/slices/uiSlice.js";
import { ROUTES } from "../routes/routeConstants.js";
import { notificationApi } from "../api/notification.api.js";
import Avatar from "../components/ui/Avatar.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";

const roleNavConfig = {
  customer: [
    { to: ROUTES.CUSTOMER_DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
    { to: ROUTES.CUSTOMER_BOOKINGS, label: "My Bookings", icon: CalendarDays },
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = roleNavConfig[role] || [];

  useEffect(() => {
    let cancelled = false;

    const fetchUnreadCount = async () => {
      try {
        const { data } = await notificationApi.getUnreadCount();
        if (!cancelled) setUnreadCount(data?.count || 0);
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 20000);
    const handleUpdated = () => fetchUnreadCount();
    window.addEventListener("notifications-updated", handleUpdated);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("notifications-updated", handleUpdated);
    };
  }, []);

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
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => dispatch(toggleSidebar())}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-surface border-r border-gray-100 transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-gray-100">
          <Link to="/" className="text-xl font-bold text-primary">
            TableSpot
          </Link>
          <button
            className="lg:hidden p-1 rounded-lg hover:bg-gray-100"
            onClick={() => dispatch(toggleSidebar())}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-text hover:bg-gray-50"
                  }`
                }
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
                {item.label === "Notifications" && unreadCount > 0 && (
                  <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-surface px-4 sm:px-6">
          <button
            className="p-1 rounded-lg hover:bg-gray-100 lg:hidden"
            onClick={() => dispatch(toggleSidebar())}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-4 ml-auto">
            <Link
              to={NOTIFICATION_ROUTE[role] || ROUTES.CUSTOMER_NOTIFICATIONS}
              className="relative p-2 rounded-lg hover:bg-gray-100 text-muted"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-3">
              <Avatar user={user} size={36} />
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-text">{user?.fullName}</p>
                <p className="text-xs text-muted capitalize">{role}</p>
              </div>
            </div>
            <button
              onClick={() => setLogoutOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 text-muted"
              aria-label="Logout"
            >
              <LogOut size={20} />
            </button>
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

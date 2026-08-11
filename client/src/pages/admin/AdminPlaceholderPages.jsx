import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  CheckCircle,
  Lock,
  Search,
  Shield,
  ShieldAlert,
  Star,
  Trash2,
  Unlock,
  Users,
  Utensils,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";

import { fetchBills } from "../../store/slices/billSlice.js";
import { fetchBookings } from "../../store/slices/reservationSlice.js";
import {
  fetchRestaurants,
  verifyRestaurant,
} from "../../store/slices/restaurantSlice.js";
import { fetchRestaurantReviews } from "../../store/slices/reviewSlice.js";
import { fetchReports, fetchWarnings } from "../../store/slices/reportSlice.js";
import {
  deleteUser,
  fetchUsers,
  toggleUserActive,
} from "../../store/slices/userSlice.js";

import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import { ROUTES } from "../../routes/routeConstants.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import ExportButton from "../../components/common/ExportButton.jsx";
import ReportsModeration from "../../components/admin/ReportsModeration.jsx";
import AdminWarningsSection from "../../components/admin/AdminWarningsSection.jsx";
import AdminRefundsSection from "../../components/admin/AdminRefundsSection.jsx";
import { useExcelExport } from "../../hooks/useExcelExport.js";
import { exportRestaurantsToExcel } from "../../utils/restaurantExport.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

/* ===== 1. ADMIN DASHBOARD PAGE ===== */
export function AdminDashboardPage() {
  const dispatch = useDispatch();
  const users = useSelector((state) => state.user.users);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const bookings = useSelector((state) => state.reservation.bookings);
  const bills = useSelector((state) => state.bill.bills);
  const restaurantReviews = useSelector(
    (state) => state.review.restaurantReviews
  );
  const reports = useSelector((state) => state.report.reports);
  const warnings = useSelector((state) => state.report.warnings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      dispatch(fetchUsers({ limit: 100 })).catch(() => null),
      dispatch(fetchRestaurants({ limit: 100 })).catch(() => null),
      dispatch(fetchBookings({ limit: 100 })).catch(() => null),
      dispatch(fetchBills({ limit: 100 })).catch(() => null),
      dispatch(fetchRestaurantReviews({ limit: 100 })).catch(() => null),
      dispatch(fetchReports({ limit: 100 })).catch(() => null),
      dispatch(fetchWarnings({ limit: 100 })).catch(() => null),
    ]).then(() => {
      if (isMounted) setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  const pendingRestaurants = useMemo(
    () =>
      restaurants.filter((r) => r.verificationStatus === "Pending").slice(0, 5),
    [restaurants]
  );
  const recentUsers = useMemo(() => users.slice(0, 6), [users]);

  const stats = useMemo(() => {
    const pending = restaurants.filter(
      (r) => r.verificationStatus === "Pending"
    );
    const paidRevenue = bills
      .filter(
        (b) => b.billStatus === "Paid" || b.payment?.paymentStatus === "Paid"
      )
      .reduce((sum, b) => sum + Number(b.grandTotal || 0), 0);
    return {
      usersCount: users.length,
      restaurantsCount: restaurants.length,
      bookingsCount: bookings.length,
      pendingVerifications: pending.length,
      revenue: paidRevenue,
      totalReviews: restaurantReviews.length,
      pendingReports: reports.filter((r) => r.status === "PENDING").length,
      activeWarnings: warnings.filter((w) => w.status === "ACTIVE").length,
    };
  }, [users, restaurants, bookings, bills, restaurantReviews, reports, warnings]);

  const handleApprove = async (r) => {
    try {
      await dispatch(verifyRestaurant(r._id, { verificationStatus: "Verified" }));
      toast.success(`${r.restaurantName} approved!`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Approval failed.");
    } finally {
      dispatch(fetchRestaurants({ limit: 100 })).catch(() => { });
    }
  };

  const kpis = [
    { label: "Total Users", value: stats.usersCount, color: "border-l-primary", icon: Users },
    { label: "Total Restaurants", value: stats.restaurantsCount, color: "border-l-amber-500", icon: Utensils },
    { label: "Total Reservations", value: stats.bookingsCount, color: "border-l-green-500", icon: Calendar },
    { label: "Pending Approvals", value: stats.pendingVerifications, color: "border-l-rose-500", icon: AlertTriangle },
    { label: "Platform Revenue", value: formatCurrency(stats.revenue), color: "border-l-blue-500", icon: BarChart2 },
    { label: "Total Reviews", value: stats.totalReviews, color: "border-l-violet-500", icon: Star },
    { label: "Pending Reports", value: stats.pendingReports, color: "border-l-orange-500", icon: AlertTriangle },
    { label: "Active Warnings", value: stats.activeWarnings, color: "border-l-red-500", icon: ShieldAlert },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <Shield className="text-primary" size={24} />
          System Admin Overview
        </h1>
        <p className="text-sm text-muted">Platform stats, user management, and restaurant approval control</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-5">
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.label} className={`p-5 flex items-center gap-4 border-l-4 ${kpi.color}`}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon size={24} />
                  </div>
                  <div>
                    <p className="text-xs uppercase font-medium tracking-wider text-muted">{kpi.label}</p>
                    <p className="text-2xl font-bold text-text">{kpi.value}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Pending Restaurant Verifications */}
            <Card className="p-6">
              <h3 className="font-bold text-text flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                Pending Restaurant Approvals
              </h3>
              {pendingRestaurants.length === 0 ? (
                <EmptyState
                  title="All caught up"
                  description="No restaurants waiting for verification."
                />
              ) : (
                <div className="mt-4 space-y-3">
                  {pendingRestaurants.map((r) => (
                    <div
                      key={r._id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text truncate">
                          {r.restaurantName}
                        </p>
                        <p className="text-xs text-muted">
                          {r.city}, {r.state} • {r.ownerId?.fullName || "Owner"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleApprove(r)}
                      >
                        <CheckCircle size={14} className="mr-1" /> Approve
                      </Button>
                    </div>
                  ))}
                  <Link
                    to={ROUTES.ADMIN_RESTAURANTS}
                    className="block text-center text-sm font-medium text-primary hover:underline mt-2"
                  >
                    Manage all restaurants
                  </Link>
                </div>
              )}
            </Card>

            {/* Recent Users */}
            <Card className="p-6">
              <h3 className="font-bold text-text flex items-center gap-2">
                <Users size={18} className="text-primary" />
                Recent Users
              </h3>
              {recentUsers.length === 0 ? (
                <EmptyState title="No users yet" />
              ) : (
                <div className="mt-4 divide-y divide-gray-50">
                  {recentUsers.map((u) => (
                    <div key={u._id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                          {u.fullName?.[0] || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text truncate">{u.fullName}</p>
                          <p className="text-xs text-muted truncate">{u.email}</p>
                        </div>
                      </div>
                      <Badge variant={u.role === "admin" ? "danger" : u.role === "owner" ? "info" : "default"} className="capitalize">
                        {u.role}
                      </Badge>
                    </div>
                  ))}
                  <Link
                    to={ROUTES.ADMIN_USERS}
                    className="block text-center text-sm font-medium text-primary hover:underline pt-3"
                  >
                    Manage all users
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ===== 2. ADMIN USERS PAGE ===== */
export function AdminUsersPage() {
  const dispatch = useDispatch();
  const users = useSelector((state) => state.user.users);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const reloadUsers = async () => {
    try {
      await dispatch(fetchUsers());
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load users.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    dispatch(fetchUsers())
      .then(() => {
        if (isMounted) {
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load users.");
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  const handleToggleActive = async (userId, currentlyActive) => {
    try {
      await dispatch(toggleUserActive(userId, { isActive: !currentlyActive }));
      toast.success(currentlyActive ? "User blocked." : "User unblocked.");
      reloadUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update user status.");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await dispatch(deleteUser(deleteTarget._id));
      toast.success("User deleted.");
      setDeleteTarget(null);
      reloadUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete user.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    }
    return true;
  });

  const userStats = useMemo(() => {
    const activeUsers = users.filter((u) => u.isActive !== false);
    const blockedUsers = users.filter((u) => u.isActive === false);
    const adminUsers = users.filter((u) => u.role === "admin");
    const ownerUsers = users.filter((u) => u.role === "owner");

    return [
      {
        label: "Total Users",
        value: users.length,
        note: "Accounts on the platform",
        icon: Users,
        tone: "primary",
      },
      {
        label: "Active",
        value: activeUsers.length,
        note: "Currently accessible",
        icon: CheckCircle,
        tone: "success",
      },
      {
        label: "Blocked",
        value: blockedUsers.length,
        note: "Temporarily restricted",
        icon: XCircle,
        tone: "danger",
      },
      {
        label: "Staff Roles",
        value: adminUsers.length + ownerUsers.length,
        note: "Admins and owners",
        icon: Shield,
        tone: "warning",
      },
    ];
  }, [users]);

  const roleTabs = [
    { key: "ALL", label: "All", count: users.length },
    { key: "customer", label: "Customers", count: users.filter((u) => u.role === "customer").length },
    { key: "owner", label: "Owners", count: users.filter((u) => u.role === "owner").length },
    { key: "admin", label: "Admins", count: users.filter((u) => u.role === "admin").length },
  ];

  const hasFilters = search || roleFilter !== "ALL";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-border bg-surface/90 p-6 shadow-lg shadow-black/5 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Shield size={12} />
              Admin Control Center
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">User Management</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted sm:text-base">
                Manage platform accounts, roles, and access with a cleaner overview and faster moderation workflow.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[42rem]">
            {userStats.map((stat) => {
              const Icon = stat.icon;
              const toneClass =
                stat.tone === "primary"
                  ? "bg-primary/10 text-primary border-primary/15"
                  : stat.tone === "success"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                    : stat.tone === "danger"
                      ? "bg-red-500/10 text-red-600 border-red-500/15"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/15";

              return (
                <Card key={stat.label} className="border-border/80 bg-white/70 p-4 shadow-sm dark:bg-surface/90">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{stat.label}</p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-text">{stat.value}</p>
                      <p className="mt-1 text-xs text-muted">{stat.note}</p>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${toneClass}`}>
                      <Icon size={18} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-surface/90 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by user name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-full pl-11 pr-4"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {roleTabs.map((role) => (
              <button
                key={role.key}
                onClick={() => setRoleFilter(role.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold capitalize transition-all duration-200 ${roleFilter === role.key
                    ? "border-primary/20 bg-primary text-white shadow-md shadow-primary/20"
                    : "border-border bg-muted/40 text-muted hover:border-primary/20 hover:bg-primary/5 hover:text-text"
                  }`}
              >
                <span>{role.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${roleFilter === role.key ? "bg-white/20 text-white" : "bg-background/70 text-muted"
                    }`}
                >
                  {role.count}
                </span>
              </button>
            ))}

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("ALL");
                }}
                className="text-muted hover:text-text"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-border/80 p-4 shadow-sm">
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load users" description={error} onRetry={reloadUsers} />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          title="No users found"
          description={hasFilters ? "No accounts match your current search or role filter." : "No accounts are available yet."}
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface/90 shadow-lg shadow-black/5 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-text">Accounts</h2>
              <p className="text-sm text-muted">
                {filteredUsers.length} {filteredUsers.length === 1 ? "record" : "records"} shown
              </p>
            </div>

          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 font-medium">
                {filteredUsers.map((u) => (
                  <tr
                    key={u._id}
                    className="group transition-colors duration-200 hover:bg-primary/5 dark:hover:bg-white/5"
                  >
                    <td className="px-5 py-4 font-bold text-text">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-bold uppercase text-primary shadow-sm">
                          {u.fullName?.[0] || "U"}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-text">{u.fullName}</div>
                          <div className="text-xs font-normal text-muted">User ID: {u._id?.slice?.(-6)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted">{u.email}</td>
                    <td className="px-5 py-4">
                      <Badge
                        variant={u.role === "admin" ? "danger" : u.role === "owner" ? "info" : "default"}
                        className="capitalize shadow-sm"
                      >
                        {u.role || "customer"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={u.isActive !== false ? "success" : "danger"} className="shadow-sm">
                        {u.isActive !== false ? "Active" : "Blocked"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full border border-border/70 bg-background/60 px-3 text-muted hover:border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300"
                          onClick={() => handleToggleActive(u._id, u.isActive !== false)}
                          title={u.isActive !== false ? "Block User" : "Unblock User"}
                        >
                          {u.isActive !== false ? <Lock size={15} className="text-amber-600" /> : <Unlock size={15} className="text-emerald-600" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full border border-border/70 bg-background/60 px-3 text-muted hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
                          onClick={() => setDeleteTarget(u)}
                          title="Delete User"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteUser}
        title="Delete user?"
        description={
          deleteTarget
            ? `This will permanently remove ${deleteTarget.fullName} (${deleteTarget.email}) from the platform. This action cannot be undone.`
            : ""
        }
        confirmText="Delete user"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

/* ===== 3. ADMIN RESTAURANTS PAGE ===== */
export function AdminRestaurantsPage() {
  const dispatch = useDispatch();
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const reloadRestaurants = async () => {
    try {
      await dispatch(fetchRestaurants());
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load restaurants.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    dispatch(fetchRestaurants())
      .then(() => {
        if (isMounted) {
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load restaurants.");
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  const handleVerifyRestaurant = async (restaurantId, status) => {
    try {
      await dispatch(verifyRestaurant(restaurantId, { verificationStatus: status }));
      toast.success(`Restaurant ${status}!`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update restaurant verification.`);
    } finally {
      reloadRestaurants();
    }
  };

  const filteredRestaurants = restaurants.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.restaurantName?.toLowerCase().includes(q) || r.city?.toLowerCase().includes(q);
  });

  const { isExporting, handleExport } = useExcelExport({
    data: filteredRestaurants,
    exportFn: exportRestaurantsToExcel,
    emptyMessage: "No restaurants available to export.",
    successMessage: "Restaurants exported to Excel.",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Restaurant Management & Approval</h1>
        <p className="text-sm text-muted">Review, verify, and approve restaurant listings on TableSpot</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by restaurant name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
        <ExportButton isExporting={isExporting} onClick={handleExport} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load restaurants" description={error} onRetry={reloadRestaurants} />
      ) : filteredRestaurants.length === 0 ? (
        <EmptyState title="No restaurants found" description="No restaurant listings match your query." />
      ) : (
        <div className="space-y-4">
          {filteredRestaurants.map((r) => (
            <Card key={r._id} className="p-5 hover:shadow-md transition-shadow border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-text">{r.restaurantName}</h3>
                    {r.restaurantCode && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                        {r.restaurantCode}
                      </span>
                    )}
                    <Badge
                      variant={
                        r.verificationStatus === "Verified"
                          ? "success"
                          : r.verificationStatus === "Rejected"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {r.verificationStatus || "Pending"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Location: {r.city}, {r.state} | Cuisine: {r.cuisineTypes?.join(", ") || "General"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {r.verificationStatus !== "Verified" && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleVerifyRestaurant(r._id, "Verified")}
                    >
                      <CheckCircle size={15} className="mr-1" /> Approve
                    </Button>
                  )}
                  {r.verificationStatus !== "Rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleVerifyRestaurant(r._id, "Rejected")}
                    >
                      <XCircle size={15} className="mr-1" /> Reject
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== 5. ADMIN REPORTS PAGE ===== */
const STATUS_COLORS = {
  Pending: "#f59e0b",
  Confirmed: "#3b82f6",
  Completed: "#22c55e",
  Cancelled: "#ef4444",
  "No Show": "#64748b",
};

const VERIFICATION_COLORS = {
  Verified: "#22c55e",
  Pending: "#f59e0b",
  Rejected: "#ef4444",
};

const ROLE_COLORS = {
  customer: "#3b82f6",
  owner: "#f59e0b",
  admin: "#ef4444",
};

const countBy = (items, getKey) =>
  items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

export function AdminReportsPage() {
  const dispatch = useDispatch();
  const users = useSelector((state) => state.user.users);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const bookings = useSelector((state) => state.reservation.bookings);
  const bills = useSelector((state) => state.bill.bills);
  const reviews = useSelector((state) => state.review.restaurantReviews);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      dispatch(fetchUsers({ limit: 100 })).catch(() => null),
      dispatch(fetchRestaurants({ limit: 100 })).catch(() => null),
      dispatch(fetchBookings({ limit: 100 })).catch(() => null),
      dispatch(fetchBills({ limit: 100 })).catch(() => null),
      dispatch(fetchRestaurantReviews({ limit: 100 })).catch(() => null),
    ])
      .then(() => {
        if (isMounted) {
          setError(null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Failed to load reports.");
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  const roleCounts = countBy(users, (u) => u.role || "customer");
  const roleData = {
    labels: ["Customers", "Owners", "Admins"],
    datasets: [
      {
        data: [roleCounts.customer || 0, roleCounts.owner || 0, roleCounts.admin || 0],
        backgroundColor: [ROLE_COLORS.customer, ROLE_COLORS.owner, ROLE_COLORS.admin],
        borderWidth: 0,
      },
    ],
  };

  const statusCounts = countBy(bookings, (b) => b.bookingStatus || "Pending");
  const statusData = {
    labels: Object.keys(statusCounts),
    datasets: [
      {
        data: Object.values(statusCounts),
        backgroundColor: Object.keys(statusCounts).map((k) => STATUS_COLORS[k] || "#94a3b8"),
        borderWidth: 0,
      },
    ],
  };

  const verifiedCounts = countBy(restaurants, (r) => r.verificationStatus || "Pending");
  const verificationData = {
    labels: Object.keys(verifiedCounts),
    datasets: [
      {
        data: Object.values(verifiedCounts),
        backgroundColor: Object.keys(verifiedCounts).map((k) => VERIFICATION_COLORS[k] || "#94a3b8"),
        borderWidth: 0,
      },
    ],
  };

  // Bookings over the last 14 days
  const last14Days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    last14Days.push(d);
  }
  const dayKey = (d) => d.toISOString().split("T")[0];
  const bookingsByDay = countBy(bookings, (b) => {
    const dt = b.bookingDateTime ? new Date(b.bookingDateTime) : null;
    return dt && !Number.isNaN(dt.getTime()) ? dayKey(dt) : "unknown";
  });
  const trendData = {
    labels: last14Days.map((d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })),
    datasets: [
      {
        label: "Bookings",
        data: last14Days.map((d) => bookingsByDay[dayKey(d)] || 0),
        backgroundColor: "#3b82f6",
        borderRadius: 6,
      },
    ],
  };

  const topRestaurants = [...restaurants]
    .filter((r) => r.isDeleted !== true)
    .sort((a, b) => (b.totalBookings || 0) - (a.totalBookings || 0))
    .slice(0, 5);

  const topRestaurantData = {
    labels: topRestaurants.map((r) => r.restaurantName),
    datasets: [
      {
        label: "Total Bookings",
        data: topRestaurants.map((r) => r.totalBookings || 0),
        backgroundColor: "#f59e0b",
        borderRadius: 6,
      },
    ],
  };

  const revenue = bills
    .filter((b) => b.billStatus === "Paid" || b.payment?.paymentStatus === "Paid")
    .reduce((sum, b) => sum + Number(b.grandTotal || 0), 0);

  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length).toFixed(1)
    : "0.0";

  const kpis = [
    { label: "Total Users", value: users.length, color: "border-l-primary", icon: Users },
    { label: "Restaurants", value: restaurants.length, color: "border-l-amber-500", icon: Utensils },
    { label: "Total Bookings", value: bookings.length, color: "border-l-green-500", icon: Calendar },
    { label: "Revenue (Paid)", value: formatCurrency(revenue), color: "border-l-rose-500", icon: BarChart2 },
  ];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <h1 className="text-2xl font-bold text-text">System Reports & Platform Metrics</h1>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-5">
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <h1 className="text-2xl font-bold text-text">System Reports & Platform Metrics</h1>
        <ErrorState title="Unable to load reports" description={error} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <BarChart2 className="text-primary" size={24} />
          System Reports & Platform Metrics
        </h1>
        <p className="text-sm text-muted">Live growth, usage, and revenue analytics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className={`p-5 flex items-center gap-4 border-l-4 ${kpi.color}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-medium tracking-wider text-muted">{kpi.label}</p>
                <p className="text-2xl font-bold text-text">{kpi.value}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="font-bold text-text mb-4 text-center">User Roles Distribution</h3>
          <div className="h-64 flex justify-center">
            <Pie data={roleData} />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-text mb-4 text-center">Bookings by Status</h3>
          <div className="h-64 flex justify-center">
            <Pie data={statusData} />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-text mb-4 text-center">Restaurant Verification</h3>
          <div className="h-64 flex justify-center">
            <Pie data={verificationData} />
          </div>
        </Card>

        <Card className="p-6 md:col-span-2 lg:col-span-2">
          <h3 className="font-bold text-text mb-4">Bookings (Last 14 Days)</h3>
          <div className="h-64">
            <Bar data={trendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-text mb-4">Top Restaurants by Bookings</h3>
          <div className="h-64">
            <Bar
              data={topRestaurantData}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
              }}
            />
          </div>
        </Card>
      </div>

      {/* Platform Overview */}
      <Card className="p-6">
        <h3 className="font-bold text-text mb-4">Platform Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-muted">Average Rating</span>
            <span className="font-bold text-text">{"★ " + avgRating}</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-muted">Total Reviews</span>
            <span className="font-bold text-text">{reviews.length}</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-muted">Paid Bills</span>
            <span className="font-bold text-text">{bills.filter((b) => b.billStatus === "Paid").length}</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-muted">Active Restaurants</span>
            <span className="font-bold text-green-600">{restaurants.filter((r) => r.isActive !== false).length}</span>
          </div>
        </div>
      </Card>

      {/* Restaurant Reports Moderation */}
      <div className="border-t border-border pt-6">
        <ReportsModeration />
      </div>

      {/* Restaurant Warnings (reply / clear) */}
      <div className="border-t border-border pt-6">
        <AdminWarningsSection />
      </div>

      {/* Refund Monitoring */}
      <div className="border-t border-border pt-6">
        <AdminRefundsSection />
      </div>
    </div>
  );
}

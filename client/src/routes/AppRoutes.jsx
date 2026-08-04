import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { USER_ROLE } from "../constants/roles.js";
import { ROUTES } from "./routeConstants.js";

import AuthLayout from "../layouts/AuthLayout.jsx";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import PublicLayout from "../layouts/PublicLayout.jsx";

import ProtectedRoute from "./ProtectedRoute.jsx";
import RoleRoute from "./RoleRoute.jsx";

// Pages
import HomePage from "../pages/public/HomePage.jsx";
import RestaurantsPage from "../pages/public/RestaurantsPage.jsx";

import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage.jsx";
import LoginPage from "../pages/auth/LoginPage.jsx";
import RegisterPage from "../pages/auth/RegisterPage.jsx";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage.jsx";
import VerifyEmailPage from "../pages/auth/VerifyEmailPage.jsx";

import CustomerDashboardPage from "../pages/customer/CustomerDashboardPage.jsx";
import {
  CustomerBookingsPage,
  CustomerFavoritesPage,
  CustomerNotificationsPage,
  CustomerProfilePage,
} from "../pages/customer/CustomerPlaceholderPages.jsx";

import {
  OwnerBillingPage,
  OwnerDashboardPage,
  OwnerFoodsPage,
  OwnerReportsPage,
  OwnerReservationsPage,
  OwnerRestaurantPage,
  OwnerReviewsPage,
  OwnerTablesPage,
} from "../pages/owner/OwnerPlaceholderPages.jsx";

import {
  AdminDashboardPage,
  AdminReportsPage,
  AdminRestaurantsPage,
  AdminReviewsPage,
  AdminUsersPage,
} from "../pages/admin/AdminPlaceholderPages.jsx";

// Lazy-loaded route components (for performance)
const RestaurantDetailsLazy = lazy(() =>
  import("../pages/public/RestaurantDetailsPage.jsx")
);
const FoodDetailsLazy = lazy(() =>
  import("../pages/public/FoodDetailsPage.jsx")
);

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* ===== Public Routes ===== */}
      <Route element={<PublicLayout />}>
        <Route path={ROUTES.HOME} element={<HomePage />} />
        <Route path={ROUTES.RESTAURANTS} element={<RestaurantsPage />} />
        <Route
          path={ROUTES.RESTAURANT_DETAILS}
          element={
            <Suspense fallback={<PageLoader />}>
              <RestaurantDetailsLazy />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.FOOD_DETAILS}
          element={
            <Suspense fallback={<PageLoader />}>
              <FoodDetailsLazy />
            </Suspense>
          }
        />
      </Route>

      {/* ===== Auth Routes ===== */}
      <Route element={<AuthLayout />}>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />
        <Route path={ROUTES.VERIFY_EMAIL} element={<VerifyEmailPage />} />
      </Route>

      {/* ===== Customer Routes ===== */}
      <Route
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={[USER_ROLE.CUSTOMER]}>
              <DashboardLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route path={ROUTES.CUSTOMER_DASHBOARD} element={<CustomerDashboardPage />} />
        <Route path={ROUTES.CUSTOMER_BOOKINGS} element={<CustomerBookingsPage />} />
        <Route path={ROUTES.CUSTOMER_FAVORITES} element={<CustomerFavoritesPage />} />
        <Route path={ROUTES.CUSTOMER_PROFILE} element={<CustomerProfilePage />} />
        <Route path={ROUTES.CUSTOMER_NOTIFICATIONS} element={<CustomerNotificationsPage />} />
      </Route>

      {/* ===== Owner Routes ===== */}
      <Route
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={[USER_ROLE.OWNER]}>
              <DashboardLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route path={ROUTES.OWNER_DASHBOARD} element={<OwnerDashboardPage />} />
        <Route path={ROUTES.OWNER_RESTAURANT} element={<OwnerRestaurantPage />} />
        <Route path={ROUTES.OWNER_TABLES} element={<OwnerTablesPage />} />
        <Route path={ROUTES.OWNER_FOODS} element={<OwnerFoodsPage />} />
        <Route path={ROUTES.OWNER_RESERVATIONS} element={<OwnerReservationsPage />} />
        <Route path={ROUTES.OWNER_BILLING} element={<OwnerBillingPage />} />
        <Route path={ROUTES.OWNER_REVIEWS} element={<OwnerReviewsPage />} />
        <Route path={ROUTES.OWNER_REPORTS} element={<OwnerReportsPage />} />
      </Route>

      {/* ===== Admin Routes ===== */}
      <Route
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={[USER_ROLE.ADMIN]}>
              <DashboardLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route path={ROUTES.ADMIN_DASHBOARD} element={<AdminDashboardPage />} />
        <Route path={ROUTES.ADMIN_USERS} element={<AdminUsersPage />} />
        <Route path={ROUTES.ADMIN_RESTAURANTS} element={<AdminRestaurantsPage />} />
        <Route path={ROUTES.ADMIN_REVIEWS} element={<AdminReviewsPage />} />
        <Route path={ROUTES.ADMIN_REPORTS} element={<AdminReportsPage />} />
      </Route>

      {/* ===== Fallback ===== */}
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  );
}

export default AppRoutes;

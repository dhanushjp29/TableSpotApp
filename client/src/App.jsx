import { useEffect } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useDispatch } from "react-redux";

import AppRoutes from "./routes/AppRoutes.jsx";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";
import { initializeAuth } from "./store/slices/authSlice.js";

function RouteAwareErrorBoundary({ children }) {
  const location = useLocation();

  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

function App() {
  const dispatch = useDispatch();

  // Verify auth session on app load
  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <RouteAwareErrorBoundary>
        <AppRoutes />
      </RouteAwareErrorBoundary>
      <Toaster
        position="top-right"
        containerStyle={{ top: 72 }}
        toastOptions={{
          duration: 4000,
          style: {
            background: "#fff",
            color: "#171717",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
          },
          success: {
            iconTheme: {
              primary: "#16a34a",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#dc2626",
              secondary: "#fff",
            },
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;

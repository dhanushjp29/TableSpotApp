import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useDispatch } from "react-redux";

import AppRoutes from "./routes/AppRoutes.jsx";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";
import DownloadLoadingOverlay from "./components/ui/DownloadLoadingOverlay.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import DownloadLoaderProvider from "./hooks/DownloadLoaderProvider.jsx";
import { initializeAuth } from "./store/slices/authSlice.js";
import useLiveNotifications from "./hooks/useLiveNotifications.js";
import SplashScreen from "./components/common/SplashScreen.jsx";
import TableSpotJoyride from "./components/onboarding/TableSpotJoyride.jsx";

function RouteAwareErrorBoundary({ children }) {
  const location = useLocation();

  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

function LiveNotificationBridge() {
  useLiveNotifications();
  return null;
}

function App() {
  const dispatch = useDispatch();
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return sessionStorage.getItem("tablespot_splash_seen") !== "true";
    } catch {
      // If storage is unavailable, keep the intro independent and show it once for this mount.
      return true;
    }
  });

  const handleSplashComplete = useCallback(() => {
    try {
      sessionStorage.setItem("tablespot_splash_seen", "true");
    } catch {
      // Storage can be blocked in privacy-restricted environments; the app still reveals normally.
    }
    setShowSplash(false);
  }, []);

  // Verify auth session on app load
  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  return (
    <ThemeProvider>
      <DownloadLoaderProvider>
        <BrowserRouter>
          <RouteAwareErrorBoundary>
            <AppRoutes />
          </RouteAwareErrorBoundary>
          <LiveNotificationBridge />
          <Toaster
            position="top-right"
            containerStyle={{ top: 72 }}
            toastOptions={{
              duration: 4000,
              style: {
                background: "var(--color-surface)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.875rem",
                fontSize: "0.875rem",
                boxShadow: "var(--shadow-md)",
              },
              success: {
                iconTheme: {
                  primary: "#16a34a",
                  secondary: "var(--color-background)",
                },
              },
              error: {
                iconTheme: {
                  primary: "#dc2626",
                  secondary: "var(--color-background)",
                },
              },
            }}
          />
          <DownloadLoadingOverlay />
          <TableSpotJoyride splashDone={!showSplash} />
        </BrowserRouter>
      </DownloadLoaderProvider>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </ThemeProvider>
  );
}

export default App;

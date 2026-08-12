import { Link, Outlet, useLocation } from "react-router-dom";
import ThemeToggle from "../components/theme/ThemeToggle.jsx";
import AuthScene from "../components/auth/AuthScene.jsx";
import { useTheme } from "../hooks/useTheme.js";
import { ROUTES } from "../routes/routeConstants.js";

function AuthLayout() {
  const { resolvedTheme } = useTheme();
  const { pathname } = useLocation();
  const logo = resolvedTheme === "dark" ? "/authtop_dark.png" : "/authtop_light.png";

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      <header className="relative z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="relative mx-auto flex h-18 max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex flex-col items-center leading-tight" aria-label="TableSpot home">
            <img src={logo} alt="TableSpot" className="h-14 w-auto object-contain" />
          </Link>
          <div className="absolute right-4 sm:right-6 lg:right-8">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <AuthScene variant={pathname === ROUTES.REGISTER ? "register" : "login"} />
        <Outlet />
      </main>
    </div>
  );
}

export default AuthLayout;

import { Link, Outlet } from "react-router-dom";
import ThemeToggle from "../components/theme/ThemeToggle.jsx";
import { useTheme } from "../hooks/useTheme.js";

function AuthLayout() {
  const { resolvedTheme } = useTheme();
  const logo = resolvedTheme === "dark" ? "/authtop_dark.png" : "/authtop_light.png";

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="relative mx-auto flex h-18 max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex flex-col items-center leading-tight">
            <img src={logo} alt="TableSpot" className="h-14 w-auto object-contain" />
            <span className="mt-0.5 block text-[10px] uppercase tracking-[0.28em] text-muted">
              Secure access
            </span>
          </Link>
          <div className="absolute right-4 sm:right-6 lg:right-8">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-primary/[0.08] via-transparent to-transparent" />
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;

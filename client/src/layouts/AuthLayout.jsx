import { Link, Outlet } from "react-router-dom";
import ThemeToggle from "../components/theme/ThemeToggle.jsx";

function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
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
                Secure access
              </span>
            </div>
          </Link>
          <ThemeToggle />
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

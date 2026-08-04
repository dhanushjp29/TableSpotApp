import { Outlet } from "react-router-dom";

function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">TableSpot</span>
          </a>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="/restaurants" className="text-sm font-medium text-text hover:text-primary">
              Restaurants
            </a>
            <a href="/login" className="text-sm font-medium text-text hover:text-primary">
              Login
            </a>
            <a
              href="/register"
              className="btn-primary text-sm"
            >
              Register
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-gray-100 bg-surface py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted sm:px-6 lg:px-8">
          © {new Date().getFullYear()} TableSpot. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;

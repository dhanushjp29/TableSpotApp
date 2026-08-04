import { Link, Outlet } from "react-router-dom";

function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-gray-100 bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-xl font-bold text-primary">
            TableSpot
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;

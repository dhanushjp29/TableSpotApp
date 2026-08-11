import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Mail, Phone, User } from "lucide-react";
import Avatar from "../ui/Avatar.jsx";
import { ROUTES } from "../../routes/routeConstants.js";

const PROFILE_ROUTE = {
  customer: ROUTES.CUSTOMER_PROFILE,
  owner: ROUTES.OWNER_PROFILE,
  admin: ROUTES.ADMIN_PROFILE,
};

function UserProfileMenu({ user, role }) {
  const [open, setOpen] = useState(false);
  const profilePath = PROFILE_ROUTE[role] || ROUTES.CUSTOMER_PROFILE;

  return (
    <div
      className="relative hidden sm:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        to={profilePath}
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-surface-secondary/70"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Avatar user={user} size={36} />
        <div>
          <p className="text-sm font-medium text-text">{user?.fullName}</p>
          <p className="text-xs capitalize text-muted">{role}</p>
        </div>
        <ChevronDown
          size={14}
          className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </Link>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <Avatar user={user} size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">
                {user?.fullName}
              </p>
              <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {role}
              </span>
            </div>
          </div>

          <div className="space-y-3 p-4 text-sm">
            {user?.email && (
              <div className="flex items-center gap-2.5">
                <Mail size={15} className="shrink-0 text-primary" />
                <span className="truncate text-text">{user.email}</span>
              </div>
            )}
            {user?.phoneNumber && (
              <div className="flex items-center gap-2.5">
                <Phone size={15} className="shrink-0 text-primary" />
                <span className="truncate text-text">{user.phoneNumber}</span>
              </div>
            )}
          </div>

          <div className="border-t border-border p-2">
            <Link
              to={profilePath}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-secondary/70 hover:text-primary"
            >
              <User size={16} />
              View Profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProfileMenu;

import { Shield, Store, User } from "lucide-react";

import { USER_ROLE } from "./roles.js";

/**
 * Pre-saved test accounts used by the "Quick Login" buttons on the Login page.
 *
 * Credentials stay here (hidden from the UI) and are bound into the existing
 * login form when a role button is clicked. Swap these values for real test
 * accounts once seed data exists — no other code changes are needed.
 */
export const QUICK_LOGIN_ACCOUNTS = [
  {
    role: USER_ROLE.CUSTOMER,
    label: "Customer",
    icon: User,
    email: "customer@tablespot.app",
    password: "tablespot123",
  },
  {
    role: USER_ROLE.OWNER,
    label: "Owner",
    icon: Store,
    email: "owner@tablespot.app",
    password: "tablespot123",
  },
  {
    role: USER_ROLE.ADMIN,
    label: "Admin",
    icon: Shield,
    email: "admin@tablespot.app",
    password: "tablespot123",
  },
];

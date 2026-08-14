# TableSpot — Client (React Frontend)

The TableSpot web application frontend. A React 19 single-page application built with Vite, Redux Toolkit, and Tailwind CSS. It powers three role-based experiences — **Customer**, **Owner**, and **Admin** — on top of the TableSpot API (see [`../server/README.md`](../server/README.md) for the backend reference).

> **Source of Truth:** This document describes the frontend *as implemented*. Every section below was verified against the source tree under `client/src`. Anything that could **not** be confirmed from the source is explicitly marked **"Not currently documented/confirmed in the codebase."** If a behavior described here disagrees with the code, the code wins.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [NPM Scripts](#npm-scripts)
7. [Project Structure](#project-structure)
8. [Routing](#routing)
9. [Authentication & Session Management](#authentication--session-management)
10. [State Management (Redux Toolkit)](#state-management-redux-toolkit)
11. [API Layer](#api-layer)
12. [Real-Time Integration (Socket.IO)](#real-time-integration-socketio)
13. [UI Components by Domain](#ui-components-by-domain)
14. [Hooks](#hooks)
15. [Utilities](#utilities)
16. [Theming](#theming)
17. [Testing (Playwright)](#testing-playwright)
18. [Build & Production](#build--production)
19. [Deployment](#deployment)
20. [Troubleshooting](#troubleshooting)
21. [Production Checklist](#production-checklist)
22. [Source of Truth](#source-of-truth)

---

## Overview

The client is a classic SPA that talks to the TableSpot REST API (`/api/v1`) over HTTPS in production. Key architectural decisions:

- **Cookies for auth, localStorage for the refresh token.** The access token is delivered as an HTTP-only cookie (`withCredentials: true` on every Axios request). The refresh token is kept in `localStorage` via `utils/storage.js` so the SPA can replay it against `POST /auth/refresh-token`. See [Authentication & Session Management](#authentication--session-management).
- **Single-flight token refresh.** The Axios response interceptor in `src/api/apiClient.js` serializes concurrent 401 responses behind one in-flight refresh call (`isRefreshing` + `failedQueue`). No burst of parallel refresh requests.
- **Environment-driven runtime config.** `src/config/runtime.js` reads `VITE_*` variables at build time and **throws at production build time** if `VITE_API_URL` / `VITE_SOCKET_URL` are missing, or if `VITE_RAZORPAY_ORDER_MOCK` is `true`. This prevents shipping a build pointed at `localhost`.
- **Route-level role gating.** Routes are wrapped by `ProtectedRoute` (authentication) and `RoleRoute` (role), then grouped under `DashboardLayout` / `PublicLayout` / `AuthLayout`. See [Routing](#routing).
- **Server-authorized rendering.** For any feature that is restricted server-side (e.g. owner dashboard access, Razorpay account connect), the client *still* calls the endpoint and lets the server reject unauthorized requests. Role routing on the client is a UX optimization, not a security boundary.

---

## Tech Stack

| Layer | Technology | Version (from `package.json`) |
|---|---|---|
| Framework | React + React DOM | `^19.2.8` |
| Build tool | Vite | `^8.2.0` (`@vitejs/plugin-react` `^6.0.4`) |
| Router | react-router-dom | `^7.18.2` |
| State | Redux Toolkit | `^2.12.0` (`react-redux` `^9.3.0`) |
| Styling | Tailwind CSS | `^4.3.3` (`@tailwindcss/vite` `^4.3.3`) |
| HTTP | Axios | `^1.19.0` |
| Real-time | socket.io-client | `^4.8.3` |
| Forms | react-hook-form + @hookform/resolvers + zod | `^7.84.0` / `^5.7.1` / `^4.4.3` |
| Toasts | react-hot-toast | `^2.6.0` |
| Charts | chart.js + react-chartjs-2 | `^4.5.1` / `^5.3.1` |
| Maps | leaflet + react-leaflet | `^1.9.4` / `^5.0.0` |
| Excel export | exceljs | `^4.4.0` |
| PDF export | html2pdf.js | `^0.14.0` |
| Icons | lucide-react | `^1.28.0` |
| Guided tours | react-joyride | `^3.2.0` |
| Geo/location | country-state-city | `^3.2.1` |
| Animations | @lottiefiles/dotlottie-react | `^0.19.13` |
| E2E tests | @playwright/test | `^1.62.1` |
| Linting | ESLint (flat config) | `^10.8.0` |

**Not currently documented/confirmed in the codebase:** TypeScript. This is a JavaScript (ESM) project; there is no `tsconfig.json` and no `typescript` dependency.

---

## Prerequisites

- **Node.js 22.x** (see `../.nvmrc`). The Vite 8 toolchain expects a modern Node release.
- A running TableSpot **server** (see `../server/README.md`), or at least its `VITE_API_URL`/`VITE_SOCKET_URL` targets reachable.
- MongoDB + a configured backend for full end-to-end flows (auth, booking, payments).

---

## Getting Started

```bash
cd client
npm install

# Configure environment (copy first, then edit)
cp .env.example .env

npm run dev
```

Open the URL printed by Vite (default `http://localhost:5173`). The dev server proxies nothing — all API calls go directly to the `VITE_API_URL` target.

> **Note:** `client/.env` is gitignored. Never commit real credentials into `.env`. The `.env.example` file is the documented template.

---

## Environment Variables

All client config is injected at **build time** through `import.meta.env`. The runtime module `src/config/runtime.js` exports the values used by the rest of the app.

| Variable | Default (dev) | Purpose | Required in prod build |
|---|---|---|---|
| `VITE_API_URL` | `http://localhost:5000/api/v1` | Base URL for all Axios requests (must end in `/api/v1`). | **Yes** — runtime throws if missing |
| `VITE_SOCKET_URL` | `http://localhost:5000` | Base URL for the Socket.IO connection (no path suffix). | **Yes** — runtime throws if missing |
| `VITE_GOOGLE_CLIENT_ID` | — | Google OAuth client id used on the Login page for "Continue with Google" | No (only Login page reads it) |
| `VITE_RAZORPAY_ORDER_MOCK` | `false` | When `true`, the client uses a fake Razorpay checkout payload path (mirrors the backend `RAZORPAY_ORDER_MOCK`). | Must be `false` — runtime throws if `true` |

```bash
# client/.env (example values)
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_RAZORPAY_ORDER_MOCK=false
```

Production `.env` must use HTTPS URLs for the deployed backend, e.g. `VITE_API_URL=https://api.example.com/api/v1` and `VITE_SOCKET_URL=https://api.example.com`.

**Important:** Because Vite inlines `import.meta.env.*` at build time, changing `.env` requires restarting the dev server and re-running `npm run build` for production.

---

## NPM Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Start the dev server with HMR (default port `5173`). |
| `build` | `vite build` | Produce a production bundle into `client/dist`. |
| `preview` | `vite preview` | Serve the last `build` output locally (verifies the production bundle). |
| `lint` | `eslint .` | Run ESLint over the whole `client` tree (flat config in `eslint.config.js`). |

There is no client-side unit test runner configured in `package.json`. End-to-end tests run through **Playwright** (see [Testing](#testing-playwright)).

---

## Project Structure

```
client/
├── index.html                 # Vite HTML entry
├── vite.config.js             # Vite + React + Tailwind plugin config
├── eslint.config.js           # Flat ESLint config
├── playwright.config.mjs      # E2E test runner config
├── .env.example               # Documented environment template
├── public/
│   ├── _redirects             # Netlify SPA fallback (see Deployment)
│   ├── *.png / *.svg / .lottie # Logos, favicons, loading animation
└── src/
    ├── main.jsx               # React bootstrap: store + router + theme + Toaster
    ├── App.jsx                # Top-level component
    ├── index.css              # Tailwind entry + global styles
    ├── api/                   # Axios instance + per-feature API modules
    ├── assets/                # Static assets
    ├── components/            # Domain UI components (see below)
    ├── config/runtime.js      # import.meta.env runtime resolution (throws on bad prod config)
    ├── constants/             # Role, restaurant, table, reservation, refund, offer, food, review constants
    ├── context/               # React context (ThemeContext)
    ├── hooks/                 # Custom hooks (see below)
    ├── layouts/               # PublicLayout, AuthLayout, DashboardLayout
    ├── pages/                 # Route pages grouped by audience
    ├── routes/                # AppRoutes, ProtectedRoute, RoleRoute, routeConstants
    ├── services/socket/       # Socket.IO service wrapper
    ├── store/                 # Redux Toolkit store + 15 slices
    └── utils/                 # Formatters, exporters, seat layout, PDF, Razorpay helpers
```

---

## Routing

Route paths are centralized in `src/routes/routeConstants.js` (exported as `ROUTES`) and wired in `src/routes/AppRoutes.jsx`.

### Route groups

| Group | Guard | Layout | Paths (examples) |
|---|---|---|---|
| **Public** | none | `PublicLayout` | `/`, `/restaurants`, `/foods`, `/restaurants/:restaurantId`, `/foods/:foodId` |
| **Auth** | none (redirects handled by pages) | `AuthLayout` | `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` |
| **Customer** | `ProtectedRoute` → `RoleRoute([CUSTOMER])` | `DashboardLayout` | `/customer/dashboard`, `/customer/bookings`, `/customer/payments`, `/customer/refunds`, `/restaurants/:restaurantId/book`, `/booking/:bookingId/confirmation`, … |
| **Owner** | `ProtectedRoute` → `RoleRoute([OWNER])` | `DashboardLayout` | `/owner/dashboard`, `/owner/restaurant`, `/owner/tables`, `/owner/foods`, `/owner/reservations`, `/owner/billing`, `/owner/reviews`, `/owner/reports`, `/owner/offers`, `/owner/refunds`, … |
| **Admin** | `ProtectedRoute` → `RoleRoute([ADMIN])` | `DashboardLayout` | `/admin/dashboard`, `/admin/users`, `/admin/restaurants`, `/admin/reviews`, `/admin/reports`, `/admin/reconciliations`, … |
| **Fallback** | — | — | `*` → redirects to the role home (`/customer/dashboard`, `/owner/dashboard`, `/admin/dashboard`) or `/restaurants` when logged out |

### Guard components

- **`ProtectedRoute`** — blocks unauthenticated users. Uses `useAuth()`; while `isInitialized === false` it shows a loading state; if not authenticated it redirects to `/login`.
- **`RoleRoute`** — receives `allowedRoles` and renders children only for matching roles, otherwise redirects to the appropriate role home.

### Lazy loading

`RestaurantDetailsPage` and `FoodDetailsPage` are code-split with `React.lazy` + `Suspense` (see `PageLoader` in `AppRoutes.jsx`).

**Not currently documented/confirmed in the codebase:** every other page is eagerly imported in `AppRoutes.jsx`; there is no route-level `Suspense` boundary beyond the two lazy pages listed above.

---

## Authentication & Session Management

See `src/api/auth.api.js`, `src/store/slices/authSlice.js`, `src/hooks/useAuth.js`, and `src/routes/ProtectedRoute.jsx`.

### Flow

1. **Login / Register / Google** — `auth.api.js` calls the matching `POST /auth/*` endpoints. On success the server sets an **HTTP-only `accessToken` cookie** and returns a **`refreshToken`** in the response body, which the client stores in `localStorage` (`utils/storage.js`).
2. **Session bootstrap** — `authSlice` initializes by reading the stored refresh token and calling `POST /auth/refresh-token` to obtain a fresh access token + rotated refresh token (stored again). `isInitialized` flips to `true` afterwards.
3. **Authenticated requests** — every Axios call sends `withCredentials: true`, so the browser attaches the access-token cookie automatically.
4. **401 handling** — the `apiClient` response interceptor detects `401` (skipping auth endpoints), enqueues in-flight requests, and fires **one** `POST /auth/refresh-token`. On success the queue replays; on failure it removes the stored refresh token and hard-redirects to `/login`.
5. **Logout** — `POST /auth/logout` invalidates the session server-side; the client clears stored tokens and navigates to `/login`.

### Access model

`useAuth()` exposes `{ user, isAuthenticated, isInitialized, isLoading, error, role }` from the Redux `auth` slice. The `user.role` drives `RoleRoute` gating and role-aware navigation (`roleHome` map in `AppRoutes.jsx`).

---

## State Management (Redux Toolkit)

Store configured in `src/store/store.js` with `configureStore`. Slices live in `src/store/slices/`:

| Slice | Redux key | Purpose |
|---|---|---|
| `authSlice` | `auth` | User, auth status, session initialization, login/logout |
| `userSlice` | `user` | Profile data / user-level state |
| `restaurantSlice` | `restaurant` | Restaurant list, detail, favorites |
| `reservationSlice` | `reservation` | Bookings / reservations |
| `notificationSlice` | `notification` | In-app notifications (counts, list, read state) |
| `uiSlice` | `ui` | UI flags (modals, loading indicators) |
| `billSlice` | `bill` | Restaurant bills |
| `tableSlice` | `table` | Restaurant tables |
| `foodSlice` | `food` | Food items |
| `reviewSlice` | `review` | Restaurant & food reviews |
| `reportSlice` | `report` | Owner reports / analytics |
| `refundSlice` | `refund` | Refund lifecycle state |
| `paymentSlice` | `payment` | Payment order creation, verification, history |
| `offerSlice` | `offer` | Offers / coupons |
| `reconciliationSlice` | `reconciliation` | Admin payment reconciliation |

Slices hold both server data and the async thunk lifecycle flags (`loading`, `error`) consumed by pages and components.

---

## API Layer

- **`src/api/apiClient.js`** — the single Axios instance (`baseURL = API_URL`, `withCredentials: true`). Contains the single-flight refresh queue and 401 handling described in [Authentication](#authentication--session-management).
- **`src/api/*.api.js`** — per-feature modules that call `apiClient`. One module per domain: `auth`, `user`, `restaurant`, `booking`, `table`, `food`, `bill`, `review`, `report`, `refund`, `payment`, `offer`, `notification`, `reconciliation`, `analytics`, `upload`.
- **`src/api/upload.api.js`** — multipart image upload helper (used by the Cloudinary-backed `POST /uploads/image` endpoint).
- **`src/api/analytics.api.js`** — analytics/report endpoints.

All request/response payloads are plain JSON unless noted (upload is `multipart/form-data`).

---

## Real-Time Integration (Socket.IO)

See `src/services/socket/socketService.js`, `src/hooks/useSocket.js`, and `src/hooks/useLiveNotifications.js`.

- **Connection** — `socketService` connects to `SOCKET_URL` (`io(SOCKET_URL, { ... })`). Authentication is based on the browser session; the server validates the client on connection (token/cookie). The socket emits `join:restaurant` and `subscribe:tables`/`subscribe:bookings` so the server routes events to the correct rooms.
- **Live events consumed by the client** (server→client):
  - `booking:created`, `booking:updated`, `booking:statusUpdated`
  - `table:updated`
  - `bill:updated`, `bill:completed`
  - `refund:statusUpdated`
  - `payment:reconciliationUpdated`
  - `notification:new`
- **`useLiveNotifications`** — wires `notification:new` into the notification slice so the notification bell/counts update without polling.

**Not currently documented/confirmed in the codebase:** reconnection/backoff tuning beyond socket.io-client defaults; the socket service does not implement application-level re-subscribe after a reconnection event.

---

## UI Components by Domain

`src/components/` is organized by feature domain:

| Directory | Contents |
|---|---|
| `admin/` | Admin-specific components (e.g. reconciliation UI) |
| `auth/` | Login/register forms, OTP, password flows |
| `billing/` | Bill display, convert-to-bill, bill status widgets |
| `booking/` | Booking wizard, seat selection, booking confirmation |
| `common/` | Shared primitives used across audiences |
| `food/` | Food item cards, search/filter controls |
| `form/` | Reusable form fields/controls (react-hook-form wrappers) |
| `map/` | Leaflet-based restaurant map widgets |
| `offer/` | Offer cards, claim/consume UI |
| `onboarding/` | Owner onboarding (restaurant creation, Razorpay connect steps) |
| `owner/` | Owner dashboard widgets (tables, reservations, billing, reports) |
| `payment/` | Checkout, order-creation, payment status UI |
| `pdf/` | PDF preview/modals for receipts and reports |
| `restaurant/` | Restaurant listing/detail building blocks |
| `theme/` | Theme-aware wrappers (dark/light) |
| `ui/` | Generic UI primitives (buttons, cards, modals, spinners, etc.) |
| `warning/` | Warning banners for customers/owners |

---

## Hooks

| Hook | Purpose |
|---|---|
| `useAuth` | Read auth state from the Redux `auth` slice |
| `useTheme` | Read current theme (used together with `ThemeContext`) |
| `useSocket` | Access the shared socket connection |
| `useLiveNotifications` | Subscribe to `notification:new` and update the store |
| `useBookingAdvancePayment` | Compute/format the advance payment amount for a booking based on restaurant policy |
| `useDebounce` | Debounce fast-changing inputs (search-as-you-type) |
| `useExcelExport` | Trigger client-side Excel export using `exceljs` |
| `useDownloadLoader` / `DownloadLoaderProvider` | Show a blocking loader while a file download is generated |

Context providers live in `src/context/` (`ThemeContext.jsx`, `theme-context.js`).

---

## Utilities

`src/utils/`:

| Utility | Purpose |
|---|---|
| `storage.js` | Namespaced `localStorage` wrapper (used for the refresh token) |
| `formatCurrency.js` / `formatDate.js` / `formatTime.js` | Shared formatters (₹, date, time) |
| `seatLayout.js` | Seat-grid layout helpers used by the booking seat selector |
| `loadScript.js` | External script loader (Razorpay checkout script) |
| `razorpay.js` | Razorpay checkout orchestration on the client (order creation + payment flow) |
| `getDistance.js` | Distance helper (used by restaurant listings with location data) |
| `foodItems.js` | Food-item presentation helpers |
| `excel/` | `excelExport.js`, `excelFormatters.js`, `excelStyles.js` — shared Excel export pipeline |
| `pdf/` | `pdfGenerator.js`, `pdfData.js`, `pdfTheme.js` — client-side HTML→PDF generation (via `html2pdf.js`) |
| `*Export.js` | Per-domain Excel builders: `ownerReportExcel.js`, `reservationExport.js`, `tableExport.js`, `foodExport.js`, `restaurantExport.js`, `reviewExport.js`, `userExport.js`, `paymentExport.js`, `refundExport.js`, `billingExport.js` |

**Client PDF vs server PDF:** the client generates *download-only* PDFs in the browser (`BookingPdf`, `PaymentPdf`, `RefundPdf`, `OwnerReportPdf`, `BillReceiptPrint`). The **canonical, email-attached** PDFs are generated **server-side** by `server/src/services/emailPdf.service.js` (see `../server/README.md`). The client does **not** upload PDFs to the server.

---

## Theming

The app supports a light/dark theme via `src/context/ThemeContext.jsx` and `src/hooks/useTheme.js`. Tailwind 4 (via `@tailwindcss/vite`) plus custom CSS in `src/index.css` define the design tokens. Brand assets (logos, auth page art, loading Lottie) live in `public/`.

---

## Testing (Playwright)

Configuration: `playwright.config.mjs` in `client/`. E2E specs live in `client/tests/e2e/`:

| Spec | Covers |
|---|---|
| `customer-payment.spec.mjs` | Customer payment/order flow |
| `owner-razorpay.spec.mjs` | Owner Razorpay connect/onboarding flow |

The Playwright config targets the Vite dev server (`baseURL` `http://localhost:5173`) and requires the backend to be reachable at the `VITE_API_URL`/`VITE_SOCKET_URL` configured in `client/.env`. Run with:

```bash
cd client
npx playwright test
```

**Not currently documented/confirmed in the codebase:** Playwright fixtures/webServer auto-start; the specs assume a server that is already running (the config does not start one).

---

## Build & Production

```bash
cd client
npm run build      # outputs to client/dist
npm run preview    # serves client/dist locally to verify the bundle
npm run lint       # ESLint over the client source
```

At build time `src/config/runtime.js` enforces:

- `VITE_API_URL` and `VITE_SOCKET_URL` must be set (production build throws otherwise).
- `VITE_RAZORPAY_ORDER_MOCK` must not be `true` in a production build (throws).

Production SPA routing relies on the server returning `index.html` for unknown paths. Netlify uses the included `public/_redirects` (`/* /index.html 200`). For other hosts, configure an equivalent SPA fallback.

---

## Deployment

Reference runbook: `../DEPLOYMENT_CONFIGURATION.md`.

- **Netlify (documented target):** build command `cd client && npm run build`, publish directory `client/dist`. The `public/_redirects` file ships SPA fallback automatically.
- **Environment:** set the four `VITE_*` variables in the hosting provider's env. Remember they are baked in at build time.
- **Backend:** deploy `../server` separately (see `../server/README.md` and `../DEPLOYMENT_CONFIGURATION.md`); point `VITE_API_URL` / `VITE_SOCKET_URL` at it with HTTPS.
- **"No deployment was performed and no provider URL is invented in this repository."**

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Blank page on production build | A required `VITE_*` var missing at build time — the app **throws** during startup. Rebuild with all variables set. |
| All API calls fail with CORS errors | Backend `CLIENT_ORIGINS` does not include the dev/prod origin; update `server/src/config/cors.js` env. |
| 401s loop / redirect to `/login` on every request | Refresh token missing or expired in `localStorage`; the interceptor redirects after failed refresh. Log in again. |
| Razorpay modal does not open | `VITE_RAZORPAY_ORDER_MOCK=false` requires a real Razorpay key on the backend; or `loadScript.js` failed to fetch the Razorpay checkout script. |
| Socket events not arriving | Check `VITE_SOCKET_URL` matches the server origin and that the browser session is authenticated (socket auth). |
| `npm run build` fails with "must be configured" | Missing `VITE_API_URL`/`VITE_SOCKET_URL` in `.env` for the production build. |
| Playwright tests hang | Backend not running / not reachable at the configured URLs. Start the server first. |

---

## Production Checklist

- [ ] `VITE_API_URL` and `VITE_SOCKET_URL` set to HTTPS backend URLs.
- [ ] `VITE_RAZORPAY_ORDER_MOCK=false`.
- [ ] `VITE_GOOGLE_CLIENT_ID` set **only** if Google sign-in is enabled on the backend.
- [ ] `npm run lint` passes.
- [ ] `npm run build` succeeds and `npm run preview` loads all routes.
- [ ] Backend `CLIENT_ORIGINS` includes the deployed origin.
- [ ] SPA fallback configured (Netlify `_redirects` or equivalent).
- [ ] No secrets in `client/.env` (it is gitignored).

---

## Source of Truth

The authoritative references for this document are:

| Topic | Files |
|---|---|
| Routes & guards | `src/routes/AppRoutes.jsx`, `src/routes/routeConstants.js`, `src/routes/ProtectedRoute.jsx`, `src/routes/RoleRoute.jsx` |
| Runtime config | `src/config/runtime.js`, `.env.example` |
| API client & modules | `src/api/apiClient.js`, `src/api/*.api.js` |
| State | `src/store/store.js`, `src/store/slices/*.js` |
| Socket | `src/services/socket/socketService.js`, `src/hooks/useSocket.js`, `src/hooks/useLiveNotifications.js` |
| Package & scripts | `package.json`, `vite.config.js`, `eslint.config.js`, `playwright.config.mjs` |
| Deployment | `../DEPLOYMENT_CONFIGURATION.md` |

Anything not present in the files above is **not** part of the client implementation and is marked accordingly in this document.

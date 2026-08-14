# TableSpot — Server (Node.js / Express API)

The TableSpot backend API. An Express 5 + Mongoose 9 REST API with JWT auth, Razorpay payment orchestration (orders, webhooks, Route onboarding, refunds), server-side email + receipt PDF generation, Socket.IO real-time events, background reconciliation, and a layered service architecture.

> **Source of Truth:** This document describes the backend *as implemented*. Every section below was verified against the source tree under `server/src`. Anything that could **not** be confirmed from the source is explicitly marked **"Not currently documented/confirmed in the codebase."** If a behavior described here disagrees with the code, the code wins.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [NPM Scripts](#npm-scripts)
7. [Project Structure](#project-structure)
8. [Startup Sequence](#startup-sequence)
9. [Middleware Chain & Request Lifecycle](#middleware-chain--request-lifecycle)
10. [Authentication & Sessions](#authentication--sessions)
11. [Authorization & Roles](#authorization--roles)
12. [API Reference](#api-reference)
13. [Core Domain Flows](#core-domain-flows)
14. [Razorpay Integration](#razorpay-integration)
15. [Refund Lifecycle](#refund-lifecycle)
16. [Payment Reconciliation](#payment-reconciliation)
17. [Socket.IO Events](#socketio-events)
18. [Email System](#email-system)
19. [Receipt PDF Generation](#receipt-pdf-generation)
20. [Background Jobs (Cron Workers)](#background-jobs-cron-workers)
21. [Database Models](#database-models)
22. [Error Handling](#error-handling)
23. [Security](#security)
24. [Testing](#testing)
25. [Operational Scripts](#operational-scripts)
26. [Deployment](#deployment)
27. [Troubleshooting](#troubleshooting)
28. [Production Checklist](#production-checklist)
29. [Source of Truth](#source-of-truth)

---

## Overview

The server is a **monolithic Express API** that owns every business rule. Key architectural decisions:

- **Payment-first booking.** A booking is only created after a payment order is successfully captured (or a `PAY_ON_SPOT` policy is used). Table availability is enforced through **booking holds** (see [Core Domain Flows](#core-domain-flows)).
- **Three-phase payment tracking.** The `Payment` model records `orderCreationStatus`, `paymentStatus`, and `bookingCreationStatus` independently, so a captured payment is never re-flipped to failed and reconciliation can repair partial failures.
- **Webhook-first payment confirmation.** Razorpay webhooks (not the client) are the source of truth for payment success. The webhook route is mounted **before** `express.json()` so the raw body can be HMAC-verified.
- **Server-side payment accounts.** Owner payouts use Razorpay **Route** onboarding entirely server-side; the frontend never sees secret keys.
- **One canonical receipt source.** `emailPdf.service.js` builds receipt row data used verbatim by both email details and PDF attachments, keeping the two outputs consistent.
- **Environment hardening.** In production the process refuses to boot without a full, valid configuration (see [Environment Variables](#environment-variables)).

---

## Tech Stack

| Layer | Technology | Version (from `package.json`) |
|---|---|---|
| Runtime | Node.js | 22.x (see `../.nvmrc`) |
| Web framework | Express | `^5.2.1` |
| ODM | Mongoose | `^9.9.1` |
| Validation | Zod | `^4.4.3` |
| Auth | jsonwebtoken + bcryptjs | `^9.0.3` / `^3.0.3` |
| Payments | razorpay SDK | `^2.9.8` |
| Real-time | socket.io | `^4.8.3` |
| Email | nodemailer | `^9.0.3` |
| PDF | pdfkit | `^0.19.1` |
| Media | cloudinary | `^2.10.0` |
| Uploads | multer | `^2.2.0` |
| Rate limiting | express-rate-limit | `^8.6.1` |
| Security headers | helmet | `^8.3.0` |
| Logging | morgan | `^1.11.0` |
| Config | dotenv | `^17.4.2` |
| Misc | cookie-parser, cors, ua-parser-js | — |
| Dev | nodemon, socket.io-client | — |

**Not currently documented/confirmed in the codebase:** TypeScript (the server is ESM JavaScript), a Dockerfile, or CI pipeline configuration.

---

## Prerequisites

- **Node.js 22.x** (see `../.nvmrc`).
- **MongoDB** (local `mongodb://127.0.0.1:27017/tablespot` or an Atlas connection string).
- **Razorpay account** with API keys + webhook secret for live payments.
- **Cloudinary account** for image uploads.
- **SMTP credentials** for transactional email.
- The **client** (`../client`) pointed at this server for the full experience.

---

## Getting Started

```bash
cd server

# Environment — copy the template and fill in real values
cp src/.env.example src/.env

npm install

# Development (nodemon, auto-restart on change)
npm run dev
```

The server loads `src/.env` explicitly in `src/config/env.js` (before any module reads `process.env`, because ESM imports hoist). Default port is `5000`.

> **Note:** `server/src/.env` is gitignored. The `.env.example` file is the documented template. Never commit real secrets.

---

## Environment Variables

All variables are read from `server/src/.env` (loaded by `src/config/env.js`).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | — | `production` (example) | `development` / `production` / `test`. Drives production asserts and behavior. |
| `PORT` | — | `5000` | HTTP listen port. |
| `CLIENT_URL` | prod | — | Frontend origin; **must be HTTPS in production**. |
| `CLIENT_ORIGINS` | — | empty | Extra comma-separated CORS origins (see `config/cors.js`). |
| `COOKIE_DOMAIN` | — | empty | Optional cookie `domain` attribute. |
| `MONGODB_URI` | prod | — | MongoDB connection string; **must not be localhost/loopback in production**. |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | — | `10000` | Mongoose server selection timeout. |
| `MONGODB_CONNECT_TIMEOUT_MS` | — | `10000` | Mongoose connect timeout. |
| `ACCESS_TOKEN_SECRET` | prod | — | JWT signing secret; **≥ 32 chars in production**. |
| `ACCESS_TOKEN_EXPIRES_IN` | prod | `15m` | Access token lifetime (see `middleware/authenticate.js`). |
| `REFRESH_TOKEN_SECRET` | prod | — | JWT secret for refresh tokens; **≥ 32 chars in production**. |
| `REFRESH_TOKEN_EXPIRES_IN` | prod | `7d` | Refresh token lifetime. |
| `CLOUDINARY_CLOUD_NAME` | prod | — | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | prod | — | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | prod | — | Cloudinary API secret. |
| `SMTP_HOST` | prod | — | SMTP server host. |
| `SMTP_PORT` | prod | `587` | SMTP port. |
| `SMTP_SECURE` | — | `false` | `true` for TLS (465). |
| `SMTP_USER` | prod | — | SMTP auth user (also used as default `MAIL_FROM`). |
| `SMTP_PASS` | prod | — | SMTP auth password. |
| `MAIL_FROM` | prod | — | `From:` address for transactional email. |
| `RAZORPAY_MODE` | prod | `live` | Key mode: `test` or `live`. `test` allows `rzp_test_` keys; `live` requires `rzp_live_`. Defaults to `live` when omitted. |
| `RAZORPAY_KEY_ID` | prod | — | Razorpay key; **must start with `rzp_test_` when `RAZORPAY_MODE=test`, `rzp_live_` otherwise, in production**. |
| `RAZORPAY_KEY_SECRET` | prod | — | Razorpay secret. |
| `RAZORPAY_WEBHOOK_SECRET` | prod | — | Razorpay webhook signature secret. |
| `SALT_ROUNDS` | — | `12` | bcrypt cost for passwords / OTPs / session hashes. |
| `MAX_FILE_SIZE_BYTES` | — | `5242880` | Upload size limit (5 MB). |
| `MAX_UPLOAD_FILES` | — | `20` | Upload file-count limit. |
| `WARNING_JOB_INTERVAL_MS` | — | `3600000` | Restaurant-warning cron interval. |
| `TABLE_STATUS_JOB_INTERVAL_MS` | — | `30000` | Table status scheduler interval. |
| `DEADLINE_JOB_INTERVAL_MS` | — | `3600000` | Booking deadline cron interval. |
| `OFFER_JOB_INTERVAL_MS` | — | `3600000` | Offer expiry cron interval. |
| `RAZORPAY_ORDER_MOCK` | prod | `false` | Mock order creation. **Must be `false` in production.** |
| `RAZORPAY_REFUND_MOCK` | prod | `false` | Mock refunds. **Must be `false` in production.** |
| `RAZORPAY_ONBOARDING_MOCK` | prod | `false` | Mock Route onboarding. **Must be `false` in production.** |

### Production bootstrap asserts (`config/env.js` → `assertProductionEnvironment()`)

When `NODE_ENV=production` the server **throws at boot** if any of the following hold:

- Any `requiredProductionVariables` is missing/blank (`MONGODB_URI`, `CLIENT_URL`, both token secrets + expiry, all Cloudinary vars, all SMTP vars, `MAIL_FROM`, all Razorpay vars + the three mock flags).
- `MONGODB_URI` contains `localhost` / `127.0.0.1` / `0.0.0.0`.
- `CLIENT_URL` is not a valid absolute URL with `https:`.
- `ACCESS_TOKEN_SECRET` or `REFRESH_TOKEN_SECRET` is shorter than 32 characters.
- `RAZORPAY_KEY_ID` does not match `RAZORPAY_MODE` (`rzp_live_` by default, `rzp_test_` when `RAZORPAY_MODE=test`).
- Any of `RAZORPAY_ORDER_MOCK`, `RAZORPAY_REFUND_MOCK`, `RAZORPAY_ONBOARDING_MOCK` is not exactly `false`.

Additional guard (`config/razorpay.js`): constructing the Razorpay client throws if any mock flag is `true` while `NODE_ENV=production`.

---

## NPM Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `nodemon src/server.js` | Auto-restarting dev server. |
| `start` | `node src/server.js` | Production start. |
| `test:booking-holds` | `node tests/bookingHold.runtime.test.mjs` | Unit-style runtime tests for booking-hold logic. |
| `test:booking-api` | `node tests/booking.api.e2e.test.mjs` | API E2E tests for the booking flow. |
| `test:payment-api` | `node tests/payment.api.e2e.test.mjs` | API E2E tests for the payment flow. |
| `test:payment-account` | `node tests/paymentAccount.runtime.test.mjs` | Runtime tests for the Razorpay payment-account (Route) flow. |

All test scripts use dedicated localhost databases (e.g. `tablespot_booking_hold_test`, `tablespot_booking_api_test`, `tablespot_payment_api_test`, `tablespot_payment_account_test`) so they never touch the real database. See [Testing](#testing).

---

## Project Structure

```
server/
├── src/
│   ├── server.js               # Bootstrap: asserts → DB → socket → crons → worker → listen
│   ├── app.js                  # Express app: middleware chain, webhook mount, /health
│   ├── .env.example            # Documented environment template
│   ├── config/
│   │   ├── env.js              # dotenv bootstrap + production asserts
│   │   ├── database.js         # Mongoose connection + index sync
│   │   ├── cors.js             # CORS policy (CLIENT_URL + CLIENT_ORIGINS)
│   │   ├── cookie.js           # Cookie options (sameSite none in prod)
│   │   ├── razorpay.js         # Razorpay client factory + mock-safety guard
│   │   └── socket.js           # Socket.IO server setup
│   ├── routes/                 # Express routers (mounted in routes/index.js)
│   ├── controllers/            # Request-layer orchestration (thin)
│   ├── services/               # Business logic (thick)
│   ├── models/                 # Mongoose models
│   ├── validators/             # Zod schemas per domain
│   ├── middleware/             # authenticate, authorize, validateRequest, ownership, upload, errorHandler
│   ├── sockets/socket.handler.js # Socket.IO connection/auth/rooms/events
│   ├── templates/              # HTML email templates (handlebars-partial style)
│   ├── utils/                  # ApiError, asyncHandler, constants, etc.
│   └── controllers/…           # per-route controllers
├── scripts/                    # Operational scripts (see below)
└── tests/                      # Test suites (see Testing)
```

Layered call chain: **route → middleware (`validateRequest` → `authenticate`/`authorize`) → controller → service → model**. Controllers stay thin; business rules live in services.

---

## Startup Sequence

`src/server.js`:

1. `assertProductionEnvironment()` — refuse to boot with invalid production config.
2. `assertRazorpayMockModesSafe()` — refuse to boot if mock flags are enabled in production.
3. `connectDatabase()` — connect Mongoose; sync indexes for `RestaurantReview` and `FoodReview` (`config/database.js`).
4. `initSocket(server)` — attach Socket.IO and register `socket.handler.js`.
5. Start background workers/crons: `deadlineCron`, `tableStatusScheduler`, `offerCron`, `warningCron`, `reconciliationWorker` (see [Background Jobs](#background-jobs-cron-workers)).
6. `app.listen(PORT)`.
7. Graceful shutdown handlers close the HTTP server, socket server, reconciliation worker, and database connection.

---

## Middleware Chain & Request Lifecycle

Order in `src/app.js` (each step is a full Express middleware):

1. `helmet()` — security headers.
2. `cors(corsOptions)` — CORS from `config/cors.js`.
3. `morgan("dev")` — request logging.
4. **`/api/v1/payments/webhook`** — mounted **before** body parsing; uses `express.raw({ type: "application/json" })` so HMAC verification can read the exact bytes.
5. `express.json()` — JSON body parsing for the rest of the API.
6. `express.urlencoded({ extended: true })`.
7. `cookieParser()`.
8. `generalLimiter` — 1000 requests / 15 min / IP.
9. `authLimiter` — 20 / 15 min on auth endpoints only, `skipSuccessfulRequests: true`. Excludes `POST /auth/refresh-token` and `POST /auth/logout` so sessions are never dropped.
10. `GET /health` — readiness probe (`mongoose.connection.readyState === 1` → `200`, else `503`; no connection details leaked).
11. `GET /` — API banner.
12. `app.use("/api/v1", apiRouter)` — all business routes.
13. 404 handler → `ApiError(404)`.
14. `errorHandler` — final error middleware.

Per-route middleware (see each router): `validateRequest(schema, source)` validates `body` (default), `query`, or `params` with Zod; `authenticate` protects routes; `authorize(...roles)` restricts by role.

---

## Authentication & Sessions

Implemented in `middleware/authenticate.js`, `services/user.service.js`, `services/otp.service.js`, and `controllers/auth.controller.js`. Endpoints in [API Reference — Auth](#auth).

- **Registration** — email + password (bcrypt, `SALT_ROUNDS`) + OTP verification (`verify-email`). OTP is 6 digits, 5-minute TTL, bcrypt-hashed in the `OTP` model (unique `{ email, purpose }`, TTL index).
- **Login** — verifies password; creates a `Session` document (with device info via `ua-parser-js`); issues an access token and a refresh token.
- **Tokens** — payload `{ userId, role, sessionId }`:
  - *Access token:* `ACCESS_TOKEN_EXPIRES_IN` (default `15m`), delivered as an **HTTP-only cookie** (`config/cookie.js`; `sameSite: "none"`, `secure: true` in production).
  - *Refresh token:* `REFRESH_TOKEN_EXPIRES_IN` (default `7d`), returned in the response body and stored by the client.
- **Refresh rotation** — `POST /auth/refresh-token` verifies the presented refresh token against the session's **bcrypt-hashed** stored hash. On success it rotates the refresh token hash and issues a new access token. **Reuse detection:** presenting an old token (hash mismatch against the *current* session hash) deactivates the session.
- **Logout** — invalidates the session; clears the access cookie.
- **Max active sessions** — `MAX_ACTIVE_SESSIONS = 5` (constant in `services/user.service.js`); creating a session beyond the limit evicts the oldest.
- **Change password** — requires the current password; rotates all session hashes after change.
- **Google login** — `POST /auth/google-login` accepts a client-provided Google payload (`name`, `email`, `picture`, `googleId`). It trusts the client payload and does **not** re-verify the Google token server-side.

> **Not currently documented/confirmed in the codebase:** server-side Google OAuth token verification. `POST /auth/google-login` uses the payload as sent by the client.

---

## Authorization & Roles

Roles are defined in `utils/constants.js` (`USER_ROLE`): `customer`, `owner`, `admin`.

- `middleware/authenticate.js` — resolves the access token cookie, loads the user, rejects inactive users.
- `middleware/authorize.js` — role-based gate; `authorize(USER_ROLE.OWNER, USER_ROLE.ADMIN)` etc.
- `middleware/ownership.js` — owner-scoped checks (a restaurant/table/bill/etc. must belong to the calling owner).
- Role gating is enforced **server-side on every protected route**, including where the client also hides UI.

---

## API Reference

All endpoints are prefixed `/api/v1`. Authentication is required unless noted. `GET /health` and `GET /` are outside the `/api/v1` prefix.

### Auth — `routes/auth.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Create account; issues OTP for email verification. |
| POST | `/auth/login` | public | Login; sets access cookie + returns refresh token. |
| POST | `/auth/google-login` | public | Google sign-in from client payload. |
| POST | `/auth/verify-email` | public | Verify email with OTP. |
| POST | `/auth/resend-otp` | public | Resend verification OTP. |
| POST | `/auth/forgot-password` | public | Request password reset OTP. |
| POST | `/auth/reset-password` | public | Reset password with OTP. |
| POST | `/auth/refresh-token` | public | Rotate refresh token; reissue access cookie. |
| POST | `/auth/logout` | public | Invalidate session. |
| GET | `/auth/me` | any user | Current user profile + role. |
| POST | `/auth/change-password` | any user | Change password with current-password check. |

### Restaurants — `routes/restaurant.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/restaurants` | public | List restaurants (filters/pagination). |
| GET | `/restaurants/cities` | public | Distinct cities. |
| GET | `/restaurants/slug/:slug` | public | Restaurant by slug. |
| GET | `/restaurants/:restaurantId` | public | Restaurant detail. |
| POST | `/restaurants` | owner/admin | Create restaurant. Owner creation is gated on Razorpay account "Connected & Verified" (see [Razorpay Integration](#razorpay-integration)). |
| PATCH | `/restaurants/:restaurantId` | owner/admin | Update restaurant (ownership-scoped for owners). |
| DELETE | `/restaurants/:restaurantId` | owner/admin | Delete restaurant. |
| PATCH | `/restaurants/:restaurantId/verify` | admin | Verify / reject restaurant. |

### Tables — `routes/table.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/tables/restaurant/:restaurantId/availability` | public | Table + seat availability. |
| GET | `/tables/restaurant/:restaurantId` | public | Tables of a restaurant. |
| GET | `/tables/:tableId` | public | Table detail. |
| GET | `/tables` | owner/admin | All tables (scoped for owners). |
| POST | `/tables` | owner/admin | Create table (with seats layout). |
| PATCH | `/tables/:tableId` | owner/admin | Update table. |
| PATCH | `/tables/:tableId/status` | owner/admin | Update table status. |
| PATCH | `/tables/:tableId/seats/status` | owner/admin | Update seat statuses. |
| DELETE | `/tables/:tableId` | owner/admin | Delete table. |

### Food — `routes/food.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/foods` | public | List foods. |
| GET | `/foods/restaurant/:restaurantId` | public | Foods of a restaurant. |
| GET | `/foods/:foodId` | public | Food detail. |
| POST | `/foods` | owner/admin | Create food. |
| PATCH | `/foods/:foodId` | owner/admin | Update food. |
| DELETE | `/foods/:foodId` | owner/admin | Delete food. |

### Bookings — `routes/booking.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/bookings` | any user | Create booking (payment-first; see [Booking & Holds](#booking--holds)). |
| GET | `/bookings` | any user | List own bookings (role-scoped). |
| GET | `/bookings/:bookingId` | any user | Booking detail (scoped). |
| PATCH | `/bookings/:bookingId` | any user | Update booking. |
| POST | `/bookings/:bookingId/cancel` | any user | Cancel booking (auto-creates refund when eligible). |
| POST | `/bookings/:bookingId/no-show` | owner/admin | Mark booking as no-show. |
| POST | `/bookings/walk-in` | owner/admin | Create a walk-in booking. |

### Bills — `routes/bill.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/bills` | owner/admin | Create bill. |
| GET | `/bills` | owner/admin | List bills. |
| GET | `/bills/:billId` | owner/admin | Bill detail. |
| POST | `/bills/:bookingId/convert-to-bill` | owner/admin | Convert booking to bill. |
| PATCH | `/bills/:billId` | owner/admin | Update bill. |
| POST | `/bills/:billId/payments` | owner/admin | Record a bill payment. |
| PATCH | `/bills/:billId/status` | owner/admin | Update bill status. |
| POST | `/bills/offers/consume` | any user | Consume an offer against a bill. |

### Users — `routes/user.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/users/profile` | any user | Own profile. |
| PATCH | `/users/profile` | any user | Update own profile. |
| GET | `/users/favorites` | any user | Favorite restaurants. |
| POST | `/users/favorites/:restaurantId` | any user | Toggle restaurant favorite. |
| GET | `/users/favorites/foods` | any user | Favorite foods. |
| POST | `/users/favorites/foods/:foodId` | any user | Toggle food favorite. |
| PATCH | `/users/booking-restriction` | owner | Toggle own booking-restriction (pause incoming bookings). |
| GET | `/users/customers` | owner | Customers of the owner's restaurants (offer targeting). |
| GET | `/users` | admin | All users. |
| PATCH | `/users/:userId/status` | admin | Activate / deactivate user. |
| PATCH | `/users/:userId/booking-restriction` | admin | Toggle a user's booking restriction. |
| DELETE | `/users/:userId` | admin | Delete user. |

### Notifications — `routes/notification.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/notifications` | any user | Own notifications. |
| GET | `/notifications/unread-count` | any user | Unread count. |
| PATCH | `/notifications/read-all` | any user | Mark all read. |
| PATCH | `/notifications/:notificationId/read` | any user | Mark one read. |

### Offers — `routes/offer.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/offers` | owner/admin | Create offer (with target audience / auto-recipients). |
| GET | `/offers` | owner/admin | List offers (role-scoped). |
| GET | `/offers/available` | any user | Offers claimable for a restaurant. |
| GET | `/offers/mine` | any user | The user's own claimed offers. |
| GET | `/offers/:offerId` | owner/admin | Offer detail. |
| PATCH | `/offers/:offerId` | owner/admin | Update offer. |
| DELETE | `/offers/:offerId` | owner/admin | Delete offer. |
| PATCH | `/offers/:offerId/active` | owner/admin | Activate / deactivate offer. |
| POST | `/offers/:offerId/claim` | any user | Claim an offer (one per user per offer). |
| GET | `/offers/:offerId/stats` | owner/admin | Offer performance stats. |
| GET | `/offers/:offerId/recipients` | owner/admin | Offer recipient list. |

### Reviews — `routes/restaurantReview.routes.js` + `routes/foodReview.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/restaurant-reviews/restaurant/:restaurantId` | public | Reviews of a restaurant. |
| GET | `/restaurant-reviews/my/booking` | any user | Current user's review for a booking. |
| GET | `/restaurant-reviews/:reviewId` | public | Review detail. |
| GET | `/restaurant-reviews/eligibility/:restaurantId` | any user | Whether the user may review a restaurant. |
| GET | `/restaurant-reviews` | any user | List reviews (role-scoped). |
| POST | `/restaurant-reviews` | any user | Create review (eligibility-enforced). |
| PATCH | `/restaurant-reviews/:reviewId` | any user | Update own review. |
| DELETE | `/restaurant-reviews/:reviewId` | any user | Delete own review. |
| GET | `/food-reviews/food/:foodId` | public | Reviews of a food. |
| GET | `/food-reviews/restaurant/:restaurantId` | public | Food reviews at a restaurant. |
| GET | `/food-reviews/:reviewId` | public | Review detail. |
| GET | `/food-reviews/my/booking` | any user | Own food reviews for a booking. |
| GET | `/food-reviews` | any user | List food reviews. |
| POST | `/food-reviews` | any user | Create food review. |
| PATCH | `/food-reviews/:reviewId` | any user | Update own review. |
| DELETE | `/food-reviews/:reviewId` | any user | Delete own review. |

### Reports & Warnings — `routes/restaurantReport.routes.js` + `routes/restaurantWarning.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/restaurant-reports/my` | any user | Own submitted reports. |
| GET | `/restaurant-reports/eligibility/:restaurantId` | any user | Report eligibility. |
| POST | `/restaurant-reports` | customer | Submit a report. |
| PATCH | `/restaurant-reports/:reportId/status` | admin | Under review / resolve / reject. |
| GET | `/restaurant-reports/:reportId` | customer/owner/admin | Report detail (ownership-scoped). |
| GET | `/restaurant-reports` | admin | All reports with filters. |
| POST | `/restaurant-warnings` | admin | Issue a warning (optionally closing a report). |
| PATCH | `/restaurant-warnings/:warningId` | admin | Update / clear a warning. |
| GET | `/restaurant-warnings/:warningId` | owner/admin/customer | Warning detail. |
| GET | `/restaurant-warnings` | owner/admin/customer | List warnings (role-scoped). |
| POST | `/restaurant-warnings/:warningId/reply` | owner/admin/customer | Reply to an active warning. |

### Payments — `routes/payment.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/payments/create-order` | any user | Create a Razorpay order + `Payment` record (see [Payment Flow](#payment-flow)). |
| POST | `/payments/verify` | any user | Verify Razorpay payment signature client-side. |
| GET | `/payments/history` | any user | Role-scoped payment / transaction history. |
| POST | `/payments/account/connect` | owner | Start Razorpay Route onboarding (KYC link). |
| GET | `/payments/account/status` | owner | Payment-account status (verification + activation). |

### Refunds — `routes/refund.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/refunds` | any user | List refunds (role-scoped, query-validated). |
| GET | `/refunds/:refundId` | any user | Refund detail. |
| POST | `/refunds/:refundId/process` | owner/admin | Process a refund (manual/claim). |
| POST | `/refunds/:refundId/confirm-receipt` | customer | Customer confirms refund received. |
| POST | `/refunds/:refundId/dispute` | customer | Customer disputes a refund. |

### Admin Reconciliation — `routes/adminReconciliation.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/admin/payments/reconciliation` | admin | List reconciliations. |
| GET | `/admin/payments/reconciliation/status` | admin | Reconciliation status summary. |
| POST | `/admin/payments/reconciliation/:reconciliationId/retry` | admin | Retry processing. |
| POST | `/admin/payments/reconciliation/:reconciliationId/refund` | admin | Trigger server-side refund. |
| POST | `/admin/payments/reconciliation/:reconciliationId/close` | admin | Close a reconciliation. |

> No client-supplied amounts or identities are accepted on admin reconciliation routes; every payload is derived server-side from the tracked payment.

### Analytics — `routes/analytics.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/reports/owner` | owner/admin | Owner analytics report (query-validated). |
| GET | `/reports/owner/export` | owner/admin | Report export (Excel/CSV). |

### Jobs — `routes/job.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/jobs/deadline-tasks/run` | admin | Run deadline-task cron on demand. |

### Uploads — `routes/upload.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/uploads/image` | any user | Multipart upload (`field name: image`) → Cloudinary URL. |

### Webhook — `routes/payment.webhook.routes.js`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/payments/webhook/razorpay` | webhook (HMAC) | Razorpay payment events (`payment.captured` / `payment.failed`). Raw-body route mounted before `express.json()`. |

---

## Core Domain Flows

### Booking & Holds

Implemented in `services/booking.service.js`, `services/bookingHold.service.js`, `services/bookingPayment.service.js`, `services/bookingWindow.service.js`.

1. **Create** (`POST /bookings`) — the request targets a restaurant table (whole table or specific seats) and a date/time slot.
2. **Hold** — a booking hold is placed atomically (`findOneAndUpdate`) before payment. Hold TTL: **15 minutes** for payment-first, **20 minutes** for manual/pay-on-spot. A hold makes the slot temporarily unavailable.
3. **Conflict handling** — overlapping holds/bookings return `409`. Holds expire and free the slot when the TTL lapses.
4. **Rollback** — if payment cannot be completed, the hold is released (see `bookingHold.service.js`).
5. **Payment policy** — the restaurant sets `PAY_TO_BOOK` or `PAY_ON_SPOT`:
   - `PAY_TO_BOOK` advance = `FIXED_AMOUNT` (min(fixed, `MAX_BOOKING_ADVANCE_AMOUNT = 200`)) or `PERCENTAGE` or `FULL_PREORDER`.
   - Payment-first booking proceeds only after a successful payment capture.
6. **Walk-in** (`POST /bookings/walk-in`, owner/admin) — creates a booking directly, gated in the controller.
7. **Cancel** — applies the refund policy (default: cancel ≥ 6 hours before → 100% refund; no-show → 0%) and auto-creates a refund record (`buildCancellationRefundKey`).
8. **No-show** (`POST /bookings/:bookingId/no-show`, owner/admin) — finalizes no-show; affects refund entitlement.

### Payment Flow

Implemented in `services/payment.service.js` + `controllers/payment.controller.js`. `POST /payments/create-order`:

1. Validates the booking hold and computes the amount server-side (never trusts a client amount).
2. Creates a Razorpay order (or mock, if `RAZORPAY_ORDER_MOCK=true` — dev only).
3. Persists a `Payment` record with three independent status fields:
   - `orderCreationStatus`: `IDLE → PROCESSING → CREATED` (or `FAILED_RETRYABLE` / `RECOVERY_REQUIRED`).
   - `paymentStatus`: `PENDING → CREATED → AUTHORIZED → CAPTURED` (or `FAILED`/`REFUNDED`/`PARTIALLY_REFUNDED`).
   - `bookingCreationStatus`: `PENDING → SUCCEEDED | FAILED`.
   - `idempotencyKey` is unique per `(customerId, idempotencyKey)` (partial index) to prevent duplicate orders.
4. **A captured payment never flips back to failed.** The payment-status state machine only moves forward.
5. Client then calls `POST /payments/verify` to verify the Razorpay signature; the authoritative capture confirmation is the webhook.

### Razorpay Integration

`services/razorpay.service.js` wraps the official SDK. Secret keys stay server-side.

- **Orders** — `payment.service.js` creates Razorpay orders for bookings.
- **Webhook** — `controllers/payment.webhook.controller.js` verifies the HMAC-SHA256 signature (constant-time compare against `x-razorpay-signature`) over the raw body, then records a `WebhookEvent` with a unique `eventId` for idempotency. Only `payment.captured` and `payment.failed` are handled. Stale `PROCESSING` (> 5 min) or `FAILED_RETRYABLE` payments are claimable for recovery.
- **Route onboarding** — `services/paymentAccount.service.js` (all Razorpay operations stay server-side):
  1. `POST /payments/account/connect` (owner) — creates the Razorpay **contact + account**, then an onboarding/KYC link the owner opens to complete verification.
  2. `GET /payments/account/status` (owner) — returns `razorpayAccountStatus` (`Not Connected` / `Verification Pending` / `Connected & Verified`) and refreshes activation state.
  - A restaurant can be created (by an owner) only while the account is **Connected & Verified**; payment-first bookings require the same.
  - Stale mock accounts (`acc_mock_*`) are cleared before live API calls.

> **Not currently documented/confirmed in the codebase:** a local *product-activation* state machine. Account verification status (`razorpayAccountStatus`) exists, but `razorpayProductId` is not set by the current implementation, so product activation is not tracked locally.

---

## Refund Lifecycle

`services/refund.service.js` implements a tracked state machine:

```
REFUND_PENDING
  → REFUND_PROCESSING
      → REFUNDED
      → REFUND_FAILED
      → REFUND_OVERDUE
      → REFUND_REQUIRES_RECONCILIATION
      → REFUND_DISPUTED
      → REFUND_AWAITING_CUSTOMER_CONFIRMATION
```

- **Creation** — automatic on eligible cancellations (refund policy key `buildCancellationRefundKey`); manual refunds via `POST /refunds/:refundId/process`.
- **Deadline** — `REFUND_DEADLINE_DAYS = 3`; refunds past the deadline become overdue/require reconciliation.
- **Claim token** — `processingClaimToken` prevents concurrent double-processing.
- **Owner lock** — while a manual refund is pending for a restaurant, owners are locked from editing the restaurant (see `services/ownerRestriction.service.js`).
- **Customer actions** — `confirm-receipt` (customer confirms funds received) and `dispute` (customer disputes).
- **Refund generation** — Razorpay refund calls via `razorpay.service.js` (mock via `RAZORPAY_REFUND_MOCK` in dev only).

---

## Payment Reconciliation

`services/reconciliation.service.js` + `services/reconciliation.worker.js`:

- **Model** — one `Reconciliation` per `paymentId` (unique). Statuses: `PENDING → PROCESSING → FAILED_RETRYABLE | MANUAL_REVIEW | RESOLVED_BOOKING | RESOLVED_REFUND | CLOSED`.
- **Worker** — a `setInterval` loop (`RECONCILIATION_JOB_INTERVAL_MS`, batch `RECONCILIATION_BATCH_SIZE`, max attempts `RECONCILIATION_MAX_ATTEMPTS`, exponential backoff base `RECONCILIATION_RETRY_BASE_MS`) reconciles payments whose payment status and booking creation diverged (e.g. captured but booking not created).
- **Admin UI** — `routes/adminReconciliation.routes.js` exposes list/status/retry/refund/close; all amounts are derived server-side.
- **Socket** — `payment:reconciliationUpdated` events push updates to connected admins.

---

## Socket.IO Events

`src/sockets/socket.handler.js`:

- **Auth** — connection authenticates via `handshake.auth.token` (Bearer) or the `accessToken` cookie.
- **Rooms** — every authenticated user joins `user_<userId>`; owners also join `restaurant_<restaurantId>` for each owned restaurant (admins may subscribe to any).
- **Server → client events**:
  - `booking:created`, `booking:updated`, `booking:statusUpdated`
  - `table:updated`
  - `bill:updated`, `bill:completed`
  - `refund:statusUpdated`
  - `payment:reconciliationUpdated`
  - `notification:new`
- **Client → server events** (subscriptions): `join:restaurant`, `leave:restaurant`, `subscribe:tables`, `subscribe:bookings`.

---

## Email System

`services/email.service.js` + `services/businessEmail.service.js` + `services/otp.service.js`:

- **Transport** — lazy-initialized nodemailer transport with pooling (`pool: true`, `maxConnections: 5`, `maxMessages: 100`). Sender is `MAIL_FROM || SMTP_USER`. When `NODE_ENV === "test"`, sends are no-ops.
- **Deduplication** — `EmailDelivery` records with a unique `eventKey` ensure each business event emails at most once.
- **Triggers** — booking confirmed/created/completed/cancelled, bill generated/settled, payment successful/failed, refund initiated/confirmed/disputed, restaurant approved/rejected, reports, warnings, and OTP emails (verification, forgot-password).
- **Templates** (`src/templates/`):
  - `business-event.html` — master layout using `{{> business-event}}`-style partials for 15 event bodies (`booking-created`, `booking-confirmed`, `booking-cancelled`, `booking-completed`, `bill-generated`, `bill-settled`, `payment-successful`, `payment-failed`, `refund-initiated`, `refund-confirmed`, `refund-disputed`, `restaurant-approved`, `restaurant-rejected`, plus report/warning events).
  - `verify-email.html`, `forgot-password.html` — standalone auth emails.

> **Not currently documented/confirmed in the codebase:** `invoice.html` and `booking-confirmation.html` exist in `templates/` but are **not referenced** by the current email services (legacy).

---

## Receipt PDF Generation

`services/emailPdf.service.js` is the **single server-side PDF generator** (pdfkit, A4, logo from `../client/public/authtop_light.png`):

- Canonical row builders — `bookingReceiptRows`, `billReceiptRows`, `paymentReceiptRows`, `refundReceiptRows` — produce the line items used **both** by email DETAILS and by the PDF. Rows that are `undefined` (conditional — e.g. advance paid only when applicable, discount/tax/service charge, total paid vs balance due) are dropped on both sides, keeping email and PDF identical.
- Entry points — `createBookingPdf`, `createBillPdf`, `createPaymentPdf`, `createRefundPdf` — return PDF buffers attached to the matching emails.

Client-side PDFs (`../client/src/utils/pdf/`) are browser-download-only and are a separate feature from these canonical server attachments.

---

## Background Jobs (Cron Workers)

Started in `src/server.js`:

| Worker | Source | Interval env | Responsibility |
|---|---|---|---|
| Deadline cron | `services/deadlineCron.service.js` | `DEADLINE_JOB_INTERVAL_MS` | Expire old booking holds, mark deadlines, trigger refund policy deadlines. Also runnable on demand via `POST /jobs/deadline-tasks/run` (admin). |
| Table status scheduler | `services/tableStatusScheduler.service.js` | `TABLE_STATUS_JOB_INTERVAL_MS` | Recompute table/seat status based on time and bookings. |
| Offer cron | `services/offerCron.service.js` | `OFFER_JOB_INTERVAL_MS` | Expire offers, materialize automatic recipients. |
| Warning cron | `services/warningCron.service.js` | `WARNING_JOB_INTERVAL_MS` | Escalate / expire restaurant warnings. |
| Reconciliation worker | `services/reconciliation.worker.js` | `RECONCILIATION_JOB_INTERVAL_MS` | Repair diverged payments (see [Reconciliation](#payment-reconciliation)). |

---

## Database Models

`src/models/` (all Mongoose):

| Model | Purpose | Notable indexes / invariants |
|---|---|---|
| `User` | Accounts (customer/owner/admin) | unique email; role; active flag; bcrypt password |
| `Session` | Refresh-token sessions | `sessionId`; bcrypt-hashed refresh token; rotation/reuse detection; `MAX_ACTIVE_SESSIONS` |
| `OTP` | Email OTPs | unique `{ email, purpose }`; TTL index (5 min) |
| `Restaurant` | Restaurant profiles | slug; owner; verification; booking policies |
| `RestaurantTable` | Tables + seat layouts | restaurant ref; seat definitions |
| `Food` | Food items (model file `food.js`) | restaurant ref; images; pricing |
| `Booking` | Reservations | booking number; status; hold/advance; cancellations |
| `Bill` | Restaurant bills | convert-to-bill from booking; payments; discounts |
| `Payment` | Razorpay payments | three-phase status fields; unique partial `(customerId, idempotencyKey)` |
| `WebhookEvent` | Webhook dedup | unique `eventId` |
| `Refund` | Refund lifecycle | status state machine; `REFUND_DEADLINE_DAYS`; claim token |
| `Reconciliation` | Payment reconciliation | unique per `paymentId`; status state machine |
| `RestaurantReview` / `FoodReview` | Reviews | eligibility checks; **indexes synced at startup** |
| `RestaurantReport` | Customer reports | eligibility; admin status |
| `RestaurantWarning` | Warnings against restaurants | report linkage; replies |
| `Offer` / `OfferRecipient` | Offers + targeting | audience rules; one-claim-per-user |
| `Notification` | In-app notifications | unread count; socket-pushed |
| `EmailDelivery` | Email dedup | unique `eventKey` |
| `Counter` | Sequence counters (booking numbers, etc.) | atomic increments |
| `AuditLog` | Audit trail | actor/action metadata |

Index sync runs at startup for `RestaurantReview` and `FoodReview` (`config/database.js`).

---

## Error Handling

- `utils/ApiError.js` — structured error class (`statusCode`, `message`, details).
- `middleware/errorHandler.js` — final handler; converts Zod/validation errors, Mongoose errors, and `ApiError` into a consistent JSON shape; 404s are produced by the app-level 404 middleware.
- `utils/asyncHandler.js` — wraps async controllers so rejected promises reach the error handler.
- Idempotency and state machines (payments, refunds, holds) exist specifically to make failures retryable without double-effects.

---

## Security

- **HTTP-only access cookie** + rotated refresh tokens with session hashing and reuse detection.
- **Bcrypt** for passwords, OTPs, and stored refresh-token hashes.
- **HMAC-SHA256 verified Razorpay webhooks** over the raw body; webhook events deduplicated by `eventId`.
- **Mock-mode guards** — all Razorpay mock flags throw in production; key format/HTTPS/localhost asserts at boot.
- **Rate limiting** — general limiter (1000/15min) + strict auth limiter (20/15min, skipping successful requests; refresh/logout excluded).
- **helmet** security headers; CORS restricted to `CLIENT_URL` + `CLIENT_ORIGINS` (`config/cors.js`).
- **Server-side amount derivation** — payment amounts, refund values, and reconciliation values are computed server-side, never accepted from clients.
- **Ownership scoping** via `middleware/ownership.js`; role gating via `authorize`.
- **Graceful shutdown** closes HTTP, socket, worker, and DB.

---

## Testing

Run the four suites (each uses its own localhost test database):

```bash
cd server
npm run test:booking-holds
npm run test:booking-api
npm run test:payment-api
npm run test:payment-account
```

- `tests/bookingHold.runtime.test.mjs` — booking-hold acquire/release/conflict runtime tests.
- `tests/booking.api.e2e.test.mjs` — end-to-end booking API flow.
- `tests/payment.api.e2e.test.mjs` — end-to-end payment order/verify flow.
- `tests/paymentAccount.runtime.test.mjs` — payment-account (Route) flow runtime tests.

The client also has Playwright E2E specs (`../client/tests/e2e/`) that exercise customer payment and owner Razorpay onboarding against this API.

**Not currently documented/confirmed in the codebase:** CI configuration; tests are run manually via the scripts above.

---

## Operational Scripts

`server/scripts/`:

| Script | Purpose |
|---|---|
| `e2e-seed.mjs` | Seed fixture data for E2E flows. |
| `e2e-api.mjs` | Drive API-level E2E scenarios against a running server. |
| `email-flow-test.mjs` | Exercise the email + receipt-PDF pipeline (writes artifacts to an out dir; requires `EMAIL_FLOW_*` env). |
| `production-migration.mjs` + `PRODUCTION_MONGODB_MIGRATION.md` | Documented production MongoDB migration procedure (`MONGODB_URI`). |

---

## Deployment

Reference runbook: `../DEPLOYMENT_CONFIGURATION.md` (Render + MongoDB Atlas + Razorpay configuration).

- **Build/start** — `npm install` in `server/`, then `npm start` (`node src/server.js`). No build step required (plain ESM JavaScript).
- **Env** — provide every variable from [Environment Variables](#environment-variables); production boot asserts will reject incomplete config.
- **Health check** — use `GET /health` (returns `200` only when MongoDB is connected).
- **Webhook** — configure Razorpay to POST to `https://<host>/api/v1/payments/webhook/razorpay` with the `RAZORPAY_WEBHOOK_SECRET`.
- **CORS** — set `CLIENT_URL` (and `CLIENT_ORIGINS` if extra origins are needed) to the deployed frontend origin.
- **"No deployment was performed and no provider URL is invented in this repository."**

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Server won't boot in production | Boot asserts fail — check every required env var, HTTPS `CLIENT_URL`, non-local `MONGODB_URI`, ≥32-char secrets, `RAZORPAY_MODE`/key match, all mock flags `false`. |
| `RAZORPAY_KEY_ID must be a live Razorpay key` | `RAZORPAY_MODE` is `live` (or unset) but the key starts `rzp_test_`. Use `rzp_live_*`, or temporarily set `RAZORPAY_MODE=test` with an `rzp_test_*` key (test keys only, mocks stay disabled). |
| `RAZORPAY_MODE=test requires … rzp_test_` | `RAZORPAY_MODE=test` with a live key — use a real `rzp_test_*` key. |
| `… must be explicitly set to false in production` | One of `RAZORPAY_ORDER_MOCK` / `RAZORPAY_REFUND_MOCK` / `RAZORPAY_ONBOARDING_MOCK` is not `false`. |
| Webhook signature verification fails | Ensure the webhook route receives the **raw** body (it is mounted before `express.json()`); verify `RAZORPAY_WEBHOOK_SECRET` matches the Razorpay dashboard. |
| Booking hold never frees | Confirm `deadlineCron` is running (interval `DEADLINE_JOB_INTERVAL_MS`) and the hold TTL passed. |
| Payment captured but booking not created | Check `Reconciliation` records; the worker or admin `/admin/payments/reconciliation/:reconciliationId/retry` should repair it. |
| Emails not sent | Verify SMTP env vars and `MAIL_FROM`; in `NODE_ENV=test` sends are no-ops by design. |
| Socket events not delivered | Verify `SOCKET` auth (access token) and that clients join the right rooms (`join:restaurant`, `subscribe:tables`, `subscribe:bookings`). |
| Test DBs polluted | Tests use dedicated `tablespot_*_test` databases; they never touch the development database. |

---

## Production Checklist

- [ ] All production asserts pass on boot (`npm start`).
- [ ] `MONGODB_URI` points to Atlas (non-loopback), timeouts configured.
- [ ] Access/refresh secrets ≥ 32 chars and distinct.
- [ ] Razorpay live key + webhook secret; webhook URL configured.
- [ ] All three Razorpay mock flags explicitly `false`.
- [ ] Cloudinary + SMTP configured; `MAIL_FROM` set.
- [ ] `CLIENT_URL` (and `CLIENT_ORIGINS`) match the deployed frontend origin over HTTPS.
- [ ] `GET /health` returns `200` behind the host's load balancer / uptime check.
- [ ] Cron/worker envs tuned (`DEADLINE_JOB_INTERVAL_MS`, `TABLE_STATUS_JOB_INTERVAL_MS`, `OFFER_JOB_INTERVAL_MS`, `WARNING_JOB_INTERVAL_MS`, reconciliation worker envs).
- [ ] No secrets in `server/src/.env` (gitignored).
- [ ] All test suites pass against their dedicated test databases.

---

## Source of Truth

The authoritative references for this document are:

| Topic | Files |
|---|---|
| Bootstrap & env | `src/server.js`, `src/config/env.js`, `src/.env.example` |
| Middleware chain | `src/app.js`, `src/middleware/*.js` |
| Routes | `src/routes/index.js`, `src/routes/*.routes.js` |
| Controllers | `src/controllers/*.js` |
| Business logic | `src/services/*.js` |
| Models | `src/models/*.js` |
| Validators | `src/validators/*.js` |
| Sockets | `src/sockets/socket.handler.js` |
| Email & PDF | `src/services/email.service.js`, `src/services/businessEmail.service.js`, `src/services/emailPdf.service.js`, `src/templates/*.html` |
| Package & scripts | `package.json` |
| Tests | `tests/*.mjs` |
| Deployment | `../DEPLOYMENT_CONFIGURATION.md` |

Anything not present in the files above is **not** part of the server implementation and is marked accordingly in this document.

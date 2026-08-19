# TableSpot

A full-stack **restaurant reservation, billing and review platform** built with the MERN stack (MongoDB, Express, React, Node.js) plus Razorpay (payments + Linked Accounts), Socket.IO (real-time), Cloudinary (media), and Nodemailer (transactional email).

> This README is the **source of truth** for the current implementation. It describes what is actually implemented in the source code — not a hypothetical product. Whenever application behaviour or the API surface changes, update this document.

---

## Quick Login Credentials

Use these pre-seeded accounts to log in instantly from the landing page Quick Login panel:

| Role | Email | Password |
|------|-------|----------|
| **Customer** | `customer@tablespot.app` | `tablespot123` |
| **Owner** | `owner@tablespot.app` | `tablespot123` |
| **Admin** | `admin@tablespot.app` | `tablespot123` |

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Core Features](#2-core-features)
3. [User Roles](#3-user-roles)
4. [Complete System Architecture](#4-complete-system-architecture)
5. [Complete Application Flow](#5-complete-application-flow)
6. [Authentication Architecture](#6-authentication-architecture)
7. [Booking Architecture](#7-booking-architecture)
8. [Payment Architecture](#8-payment-architecture)
9. [Razorpay Route / Restaurant Payout Architecture](#9-razorpay-route--restaurant-payout-architecture)
10. [Webhooks](#10-webhooks)
11. [Refund Architecture](#11-refund-architecture)
12. [Email Architecture](#12-email-architecture)
13. [Receipt / PDF Architecture](#13-receipt--pdf-architecture)
14. [Socket.IO Architecture](#14-socketio-architecture)
15. [Reconciliation Architecture](#15-reconciliation-architecture)
16. [Database Architecture](#16-database-architecture)
17. [Project Structure](#17-project-structure)
18. [Environment Variables](#18-environment-variables)
19. [Local Development](#19-local-development)
20. [Testing](#20-testing)
21. [Build](#21-build)
22. [Deployment](#22-deployment)
23. [Security](#23-security)
24. [Troubleshooting](#24-troubleshooting)
25. [Production Checklist](#25-production-checklist)
26. [Future Improvements](#26-future-improvements)

---

## 1. Project Overview

### What TableSpot is

TableSpot is a restaurant table-reservation and billing platform. Customers can discover restaurants, view menus, select tables or individual seats, pre-order food, pay an advance (or the full bill) online via Razorpay, receive receipts by email, and later review the restaurant and its food. Restaurant owners can onboard with Razorpay **Route** (Linked Account + KYC), manage their restaurants, tables, seats, menus, offers, reservations, billing, refunds, warnings and reports. A platform admin verifies restaurants, manages users, moderates reports/reviews, issues warnings, and operates a payment **reconciliation** console.

### What problem it solves

- Restaurants operate walk-in bookings manually and have no structured way to take advance payments, hold seats, or pay out to owners.
- Customers have no unified way to discover, reserve and pay for a table across restaurants.
- The platform needs to safely bridge **customer payments** (paid to the platform's Razorpay account) and **restaurant payouts** (via Razorpay Route Linked Accounts) with a reconciliation layer so a captured payment can never be lost.

### Target users

- **Customers** who want to book and prepay for a restaurant table.
- **Restaurant owners** who want to manage availability, reservations, billing and payouts.
- **Platform administrators** who verify and moderate the marketplace and resolve payment edge-cases.

### Main goals

1. Real-time, conflict-free table and seat reservations with booking **holds** and booking-window automation.
2. A payment-first flow: a booking is materialised only after a captured advance payment.
3. Idempotent, recoverable money movement (orders, payments, refunds, webhooks, reconciliation).
4. Complete transactional email with server-generated receipt PDFs that always match the email content.
5. Owner payout readiness through Razorpay Route account onboarding with KYC.

---

## 2. Core Features

Features below are confirmed in the source code (`client/src`, `server/src`).

| Area | Features |
|---|---|
| **Discovery** | Public restaurant catalogue (search, city filter, price range ₹–₹₹₹₹, rating filter, featured/rating/booking sorts), restaurant detail pages, food/menu catalogue with category/type filters, Leaflet map discovery with distance display. |
| **Authentication** | Email + password registration with email-verification OTP, login/logout, access + refresh JWT with rotation and reuse detection, httpOnly cookies + localStorage refresh token, role-based authorization, change/forgot/reset password, Google sign-in (client-side credential). |
| **Restaurants** | Owner CRUD (cover + gallery images via Cloudinary, operating hours, amenities, location picker), admin verification workflow (Pending → Verified / Rejected with reason), soft delete. |
| **Tables & seats** | Table CRUD with shape-aware seat generation (Round, Square, Rectangle, Oval, Boat, Single Row), full-table vs individual-seats booking modes, per-seat and per-table status, manual blocking with auto-revert timers, availability API. |
| **Bookings** | Booking creation (whole table or individual seats), advance-payment policies, booking **holds** (15–20 min TTL), duplicate/overlap protection, cancellation with refund policy, no-show marking, booking-window status automation, deadline cron for pending-expiry and no-shows. |
| **Payments** | Razorpay Checkout order creation, signature verification, payment-first materialization, idempotency keys, mock modes for local/test, payment history per role. |
| **Razorpay Route** | Owner Linked Account creation, product configuration, KYC onboarding link, activation status refresh, payout readiness gating for restaurant creation and booking. |
| **Billing** | Online and walk-in bills, line items with server-computed totals, manual discount + offer discount (immutable snapshot), tax slabs, service/delivery charges, payment ledger, bill settlement that completes the booking. |
| **Refunds** | Full lifecycle: pending → processing → refunded / failed / overdue / requires-reconciliation / disputed, Razorpay gateway refunds, manual (cash/UPI) refunds with customer confirmation, automatic refunds on cancellation. |
| **Offers** | Restaurant offers (percentage/amount), ALL/SELECTED/SEGMENT targeting, claim codes, scratch-card redemption, per-user limits, expiry reminders, bill offer consumption. |
| **Reviews & reports** | Restaurant + food reviews (booking-scoped eligibility), owner replies, admin moderation, customer reports against restaurants, admin reports console, warnings (levels + expiry + auto-suspension). |
| **Analytics** | Owner business report with KPIs and Chart.js charts, Excel (ExcelJS) and PDF export. |
| **Notifications** | In-app notifications (REST + Socket.IO live push), unread badge, mark read/all. |
| **Email** | OTP emails, booking/bill/payment/refund/restaurant/report/warning transactional emails with branded layout, support contact, booking instructions, and attached receipt PDFs. |
| **Reconciliation** | Admin console + background worker that reconciles captured payments whose booking materialisation failed. |
| **Exports** | Excel exports for restaurants, tables, foods, bookings, bills, payments, refunds, users, reviews, owner analytics (13-sheet workbook). |
| **PDF (client)** | On-screen receipt/download PDFs for bookings, payments and refunds via html2pdf. |

---

## 3. User Roles

Three roles exist, defined in `server/src/utils/constants.js` (`USER_ROLE`) and enforced by `authorize(...)` middleware and the client `RoleRoute`.

### Customer (`role: "customer"`)
- Browse restaurants, foods, and maps; favourite restaurants and foods.
- Register, verify email, login, manage profile and password.
- Book a table (whole table or individual seats), optionally with advance payment.
- View booking confirmation/detail, cancel within the cancellation policy, receive refunds.
- Pre-order food; pay for a booking advance.
- View payment history and refund status; confirm receipt of manual refunds; dispute refunds.
- Claim and scratch offers; view own offers/warnings.
- Review restaurants and foods (only after a completed booking) and report restaurants.

### Restaurant Owner (`role: "owner"`)
- Connect a Razorpay Linked Account and complete KYC **before** creating a restaurant.
- Manage restaurants, tables/seats (with manual status blocks and auto-revert), and food/menu items.
- Manage offers, view reservations, mark no-shows, convert bookings to bills, create walk-in bills, settle bills, process refunds.
- View payment history, refunds, warnings, reports and analytics; reply to warnings.
- Must not create a restaurant or make tables bookable while their account is restricted or has unresolved refunds (409 guard in table controller).

### Admin (`role: "admin"`)
- Verify/reject restaurants, manage all users (activate/deactivate/delete/restrict bookings).
- Moderate restaurant reviews and food reviews; operate the reports console; issue/update/clear warnings.
- View all payment transactions and operate the payment **reconciliation** console (retry / refund / close).
- Admin can create restaurants without a connected Razorpay account (owner requirement is bypassed for `ADMIN`).

---

## 4. Complete System Architecture

```
User Browser (React 19 + Vite SPA)
   │
   │  HTTPS / WebSocket
   ▼
React Client (client/)
   ├─ Pages / Components (routing: React Router v7, role-guarded)
   ├─ Redux Toolkit store (15 slices) + plain async thunks
   ├─ API layer (axios instance → REST)
   └─ Socket.IO client (socket.io-client) for real-time events
   │
   │  axios (JSON) + httpOnly cookies      │  socket.io-client (websocket)
   ▼                                      ▼
Express Server (server/, port 5000)  ──  Socket.IO (same HTTP server)
   │  middleware chain:
   │    helmet → cors → morgan → webhook router (raw body)
   │    → express.json → urlencoded → cookie-parser → rate limits
   ▼
Routes (/api/v1/**) → Validators (Zod) → Controllers → Services
   │
   ├── MongoDB (Mongoose models, unique/sparse/partial/TTL indexes)
   ├── Razorpay (orders, payments, captures, refunds, Route Linked Accounts, webhooks)
   ├── Cloudinary (image uploads)
   ├── SMTP provider via Nodemailer (transactional email)
   └── Background workers (setInterval): deadline cron, table-status
       scheduler, offer cron, warning cron, reconciliation worker
```

### Where external services fit

| Service | Integration point | Purpose |
|---|---|---|
| **Razorpay** | `server/src/config/razorpay.js`, `services/razorpay.service.js`, `payment.controller.js`, `payment.webhook.controller.js`, `paymentAccount.service.js` | Order creation, payment capture, refunds, Route Linked Accounts/KYC, webhook signature verification. Live keys never reach the browser — only the `key_id` is exposed for checkout. |
| **Cloudinary** | `server/src/utils/cloudinary.js`, `upload.controller.js`, `upload.service` | All image uploads (profiles, restaurant cover/gallery, food, review/report evidence). Server uploads buffers received via multer (memory storage). |
| **Email provider (SMTP)** | `server/src/services/email.service.js`, `businessEmail.service.js`, `otp.service.js` | OTP emails, transactional emails, receipt PDF attachments. Transporter is a pooled nodemailer instance; disabled under `NODE_ENV=test`. |
| **Socket.IO** | `server/src/sockets/socket.handler.js`, `client/src/services/socket/socketService.js` | Live notifications and real-time table/booking/bill/refund/reconciliation events scoped to `user_<id>` and `restaurant_<id>` rooms. |
| **Maps** | Client only: `client/src/components/map/LocationPickerMap.jsx`, `RestaurantDiscoveryMap.jsx` (react-leaflet + Leaflet) | No server-side map API. Owners pick coordinates (lat/lng stored on Restaurant); customers see restaurants on a map with haversine distance. |
| **Google (client-side)** | `client/src/pages/auth/LoginPage.jsx` (`VITE_GOOGLE_CLIENT_ID`), `server/.../auth/googleLogin.service.js` | Google sign-in uses a client-decoded credential passed to `POST /auth/google-login`. |

---

## 5. Complete Application Flow

Only flows that exist in the code are listed.

### Customer flow

```
Browse (Home → Restaurants / Foods / Map)
   → Restaurant details (menu, reviews, offers)
   → Book a table (choose date/time, guests, whole table or seats, pre-order, offer)
   → Booking page fetches availability (GET /tables/restaurant/:id/availability)
   → "Pay & Confirm" when restaurant uses PAY_TO_BOOK:
        POST /payments/create-order (payment-first, booking draft held)
        → Razorpay Checkout → verify → booking materialised + confirmed
   → Booking confirmation page (receipt PDF download, advance banner)
   → History / detail (cancel within policy → auto refund)
   → Payments / Refunds / Offers / Warnings
   → Review restaurant & food (after completed booking)
```

### Owner flow

```
Register (role=owner) → verify email → login
   → Connect Razorpay Linked Account (POST /payments/account/connect)
   → Complete KYC via onboarding link → refresh status (must reach "Connected & Verified")
   → Create restaurant (required: ≥1 table, ≥3 gallery images, payment policy)
   → Create tables (shape-aware seats) + food/menu items + offers
   → View reservations (real-time table/booking updates) → mark no-show / convert to bill
   → Billing workspace (walk-in or online bills) → settle → booking completed
   → Process refunds / view payments / reports / analytics / warnings
```

### Admin flow

```
Login (role=admin)
   → Dashboard (KPIs, charts)
   → Restaurants (verify/reject, manage)
   → Users (activate/deactivate/delete, booking restriction)
   → Reports & warnings (moderate reports, issue/clear warnings, refunds section)
   → Reviews (moderate)
   → Reconciliations (worker-driven retry/refund/close console)
```

---

## 6. Authentication Architecture

Implemented in `server/src/services/auth/*.js` and `middleware/authenticate.js` / `authorize.js`.

### Sign-up
- `POST /api/v1/auth/register` — validates `fullName, email, password, phoneNumber?, role ∈ {customer, owner}`.
- Duplicate verified email → 409. Duplicate **unverified** email → re-sends a verification OTP.
- Password is hashed with `bcrypt` (`SALT_ROUNDS` env, default 10; 12 in `.env.example`).
- A verification OTP (6 digits, 5-minute expiry, bcrypt-hashed, single active OTP per `email+purpose`) is emailed.
- **No tokens are issued until the email is verified.** Login is blocked for unverified accounts (403).

### Email verification / OTP
- `POST /auth/verify-email` — verifies the OTP, marks the user verified, then **creates a session and issues tokens** (same response as login).
- `POST /auth/resend-otp` — resends a fresh OTP (60s+ guard via rate limiter; one active OTP per email+purpose).
- OTP purposes defined in `OTP_PURPOSE`; currently exercised: `Email Verification`, `Password Reset`. (`Change Email` / `Login Verification` values exist as constants but **no endpoints use them yet** — not currently implemented.)

### Login
- `POST /auth/login` — uniform `401 Invalid email or password.`; 403 for disabled or unverified accounts.
- Device info captured via `ua-parser-js` (`getDeviceInfo`).
- Creates or reuses a `Session` (matching on `userAgent`/`ipAddress`/`deviceName`), enforces **MAX_ACTIVE_SESSIONS = 5** (oldest deactivated).
- Issues a **refresh token** whose raw value is stored **bcrypt-hashed** on the Session; issues an **access token**.

### Tokens
- `JWT` via `jsonwebtoken` (`server/src/utils/jwt.js`).
  - **Access token**: payload `{userId, role, sessionId}`, secret `ACCESS_TOKEN_SECRET`, expiry `ACCESS_TOKEN_EXPIRES_IN` (default `15m`).
  - **Refresh token**: same payload, secret `REFRESH_TOKEN_SECRET`, expiry `REFRESH_TOKEN_EXPIRES_IN` (default `7d`).
- Transport:
  - Access token in an **httpOnly cookie** (`accessToken`) set by the server, and the client may also send `Authorization: Bearer <token>` or `x-access-token`.
  - Refresh token in an httpOnly cookie (`refreshToken`) **and** returned in the response body; the client persists it in `localStorage` (`tablespot_refreshToken`) for the refresh call.
- Cookies (`config/cookie.js`): `httpOnly: true`, `secure` in production, `sameSite: production ? "none" : "lax"` (cross-site Vercel/Netlify frontend + Render/Railway backend), optional `COOKIE_DOMAIN`, `maxAge` 7 days.

### Token refresh
- `POST /auth/refresh-token` — verifies the refresh token, finds the session, **compares the stored bcrypt hash** (`Refresh token mismatch.` → deactivates the session = reuse detection), then rotates to a new refresh token and issues a new access token.
- Client `apiClient.js` runs a single-flight refresh queue on 401 responses and replays queued requests.

### Logout
- `POST /auth/logout` — deactivates the session identified by the refresh token; clears both cookies.

### Token verification / authorization
- `authenticate` middleware: extracts the access token (Bearer → cookie → x-access-token), verifies it, loads the user, rejects disabled/deleted accounts (403), attaches `req.user` + `req.auth`.
- `authorize(...roles)`: 403 if the authenticated user's role is not allowed. Empty list = any authenticated user.
- `ownership.js`: role-aware access helpers for bookings, bills, restaurants (`verifyBookingAccess`, `verifyBillAccess`, `getOwnedRestaurantIds`, `assertRestaurantOwnedByUser`).

### Password changes
- `POST /auth/change-password` (authenticated) — verifies the old password, rehashes, and deletes **all other sessions**.
- `POST /auth/forgot-password` — sends a password-reset OTP (account must be email-verified).
- `POST /auth/reset-password` — verifies the OTP, rehashes, deletes **all** sessions for the user.

### Google sign-in
- `POST /auth/google-login` — the **client** decodes the Google credential (see `LoginPage.jsx` using `VITE_GOOGLE_CLIENT_ID`) and sends `{email, fullName, providerId, profileImage}`. The server creates/updates the user (`provider: "google"`, `isEmailVerified: true`) and runs the same session/token flow. **Server-side OAuth token verification is not implemented** — the endpoint trusts the client-provided payload (this is a known limitation; treat as unconfirmed for production).

---

## 7. Booking Architecture

### Booking creation
- `POST /api/v1/bookings` (authenticated) — validated by `createBookingSchema`.
- The controller enforces: customers on `PAY_TO_BOOK` restaurants must use the **payment-first** flow (direct creation → 409), and bookings are forced to `bookingType: "Online"`. Walk-ins are created via `POST /api/v1/bookings/walk-in` (owner/admin; gated in the controller).
- Seats/tables selected by the customer are checked for conflicts; duplicate-protection rejects overlapping bookings/holds with `409 The selected table or seat(s) are already booked for this time.`

### Table / seat selection
- Tables use `SEAT_SELECTION_MODE`: `FullTable` (whole table reserved) or `IndividualSeats` (specific seats).
- Availability is computed by `table.service.getTablesWithAvailability({restaurantId, date, time, datetime, duration, guests})`: overlaps active `PENDING`/`CONFIRMED` bookings and current holds; reports `freeSeatIds`, `freeSeatCount`, `blocked`/`blockReason` per table.
- Seat geometry is generated server-side (`utils/seatLayout.js`) for six table shapes; client mirrors it for rendering (`TableShape`, `TableSelector`).

### Booking hold
- `bookingHold.service.js` — `acquireBookingHolds({tables, bookingAt, bookingEnd, ttlMinutes})` atomically claims holds (`findOneAndUpdate` with `$not` overlap filter + capacity `$expr` for individual seats); on failure it **partially rolls back** already-acquired holds.
- Payment-first bookings hold for **15 minutes**; manual booking holds default to **20 minutes**.
- Holds are released on: payment failure, cancelled order, capture completion, and by the deadline cron when expired.

### Payment-first flow
- For `PAY_TO_BOOK` restaurants the customer pays first: `POST /payments/create-order` with `{purpose: "BOOKING_ADVANCE", bookingData: {restaurantId, tables, bookingDateTime, ...}}`. The booking is **not created yet**; a `Payment` record holds the draft in `bookingData`.
- After Razorpay capture (verify or webhook), `createBookingFromPayment` materialises the booking and links `sourcePaymentId`.
- Required advance: `FIXED_AMOUNT → min(fixedAmount, maximumAmount)`, `PERCENTAGE → min(total × pct/100, maximumAmount)`, `FULL_PREORDER → max(total − discount, 0)`. `maximumAmount` capped at `MAX_BOOKING_ADVANCE_AMOUNT = 200`.

### Booking confirmation
- On successful capture, the booking transitions to `Confirmed` (payment status `Paid`), emails + notifications + socket events fire, and the payment record becomes `bookingCreationStatus: SUCCEEDED`.

### Cancellation
- `POST /api/v1/bookings/:bookingId/cancel` — applies the restaurant's `cancellationPolicy` (default: enabled, 6 hours before booking, 100% refund, no-show 0%). When refundable and money was captured, an automatic refund is created (`buildCancellationRefundKey`).
- `POST /:bookingId/no-show` (owner/admin) — marks `No Show`, applies `noShowRefundPercentage`, releases holds.

### Duplicate protection & concurrency
- Overlap detection at booking creation + atomic holds prevent double-booking the same table/seats/time.
- Payment idempotency (unique partial index on `{customerId, idempotencyKey}`) prevents duplicate orders.
- Booking window scheduler (`bookingWindow.service.js`) recomputes table status every tick; **manual** (owner-set) table statuses are never overwritten (`statusSource: "manual"` vs `"booking"`).

---

## 8. Payment Architecture

```
Customer → POST /api/v1/payments/create-order (idempotencyKey)
   → Payment(orderCreationStatus=PROCESSING) → Razorpay Orders.create
   → returns {order:{id,amount,currency}, razorpayKeyId, paymentId} (secret never leaves server)
Customer → Razorpay Checkout (frontend opens via Razorpay SDK)
   → POST /api/v1/payments/verify {razorpay_order_id, razorpay_payment_id, razorpay_signature}
   → handlePaymentCaptured → paymentStatus=CAPTURED
   → createBookingFromPayment (payment-first) → booking materialised + confirmed
   → Payment Receipt (email + PDF) → Reconciliation worker only if materialisation failed
Razorpay → Webhook payment.captured / payment.failed (raw body + HMAC) → same capture handler
```

### Order vs payment vs capture vs verification vs webhook vs refund
- **Order** — a Razorpay order (`order_...`) created server-side with amount in paise; `Payment.orderCreationStatus` tracks `IDLE → PROCESSING → CREATED → FAILED_RETRYABLE / RECOVERY_REQUIRED`.
- **Payment** — the Razorpay payment entity (`pay_...`) produced by the checkout; persisted as `razorpayPaymentId` once captured.
- **Capture** — the act of marking money received: `handlePaymentCaptured` sets `paymentStatus: CAPTURED` and drives booking materialisation. Captured payments are **never** flipped back to `FAILED`.
- **Verification** — the client-facing signature check at `/payments/verify` (Razorpay `razorpay_signature`). The webhook does **not** use client verification; it uses HMAC signature verification.
- **Webhook** — server-to-server event stream (`payment.captured` / `payment.failed`) with `x-razorpay-signature` verification and event-id idempotency. This is the source of truth when the client never returns.
- **Refund** — money returned to the customer via Razorpay refunds (`refund_...`) or manual methods; tracked separately on the `Refund` model and in refund counters on `Payment` (`refundedAmount`, `refundProcessingAmount`).

### Payment record
`Payment` model fields include `paymentPurpose`, `idempotencyKey`, `orderReceipt`, `orderCreationStatus`, `razorpayOrderId`, `razorpayPaymentId`, `paymentStatus` (`PENDING/CREATED/AUTHORIZED/CAPTURED/FAILED/REFUNDED/PARTIALLY_REFUNDED`), and `bookingCreationStatus` (`PENDING/SUCCEEDED/FAILED...`) — **kept separate** so a captured payment is never labelled "failed" when booking creation needs recovery.

### Payment history
- `GET /api/v1/payments/history` — role-scoped transaction history (customer/owner/admin) with summary.

### Mock modes
- `RAZORPAY_ORDER_MOCK=true` makes order creation return synthetic `order_mock_...` ids (no gateway). `RAZORPAY_REFUND_MOCK` / `RAZORPAY_ONBOARDING_MOCK` behave likewise. **The server refuses to start in production with any mock flag enabled.**

---

## 9. Razorpay Route / Restaurant Payout Architecture

```
Restaurant Owner
   → POST /api/v1/payments/account/connect (owner only)
   → claimAccountCreation (stale PROCESSING reclaimable)
   → createPaymentAccount (email/phone/address) → Linked Account ID (acc_...)
   → createPaymentAccountOnboardingLink → KYC/onboarding URL
   → returns {accountId, status, onboardingLink, activationStatus}
   → GET /api/v1/payments/account/status (owner) → refreshPaymentAccountStatus
   → "Connected & Verified" ⇒ owner may create restaurants / take advance payments
```

- **Linked account** — a Razorpay Route account owned by the restaurant owner (stored as `User.razorpayAccountId`, unique partial index; a copy also on `Restaurant`).
- **Account ID / Product ID** — `razorpayAccountId` and `razorpayProductId` on `User`. The codebase creates the account and onboarding link; a product ID is not created by the current implementation (field exists, remains `""` — the onboarding link flow is what is implemented).
- **Activation status** — the **account status** (`razorpayAccountStatus`: `Not Connected` / `Verification Pending` / `Connected & Verified`) is separate from **product activation** (KYC completeness at the gateway). The app refreshes the Linked Account activation status from the gateway via `refreshPaymentAccountStatus`; there is no local product-activation state machine.
- **Gating** — `restaurant.service.createRestaurant` requires `razorpayAccountStatus === "Connected & Verified"` for non-admin owners (`requirePaymentAccount`). Payment-first booking requires a connected owner account (`getConnectedOwnerPaymentAccount`).
- **Safety** — stale **mock** account ids (`acc_mock_*`) are cleared before any live-gateway call so a mock id is never sent to Razorpay.

---

## 10. Webhooks

- **Endpoint:** `POST /api/v1/payments/webhook/razorpay` (mounted in `app.js` **before** `express.json()` so the body arrives as a raw Buffer via `express.raw({type: "application/json"})`).
- **HMAC verification:** `crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)` over the raw body, compared against `x-razorpay-signature` (constant-time compare). Missing/invalid → 400/401.
- **Event id / idempotency:** `WebhookEvent` is upserted by `eventId` (unique index). Already `PROCESSED` or fresh `PROCESSING` → treated as duplicate (responds `200` so Razorpay never re-bombs). Stale `PROCESSING` (> 5 min) or `FAILED_RETRYABLE` can be reclaimed atomically.
- **Event processing:** `payment.captured` → `handlePaymentCaptured`; `payment.failed` → `handlePaymentFailed`; anything else → no-op.
- **Failure handling:** thrown errors mark the event `FAILED_RETRYABLE`, clear `processingStartedAt`, record `lastError` (≤1000 chars), and respond `500 Webhook processing could not be completed.`

---

## 11. Refund Architecture

Lifecycle (statuses from `REFUND_STATUS`):

```
REFUND_PENDING ──owner/admin process──▶ REFUND_PROCESSING
   ├─ manual (cash/UPI): ─▶ REFUND_AWAITING_CUSTOMER_CONFIRMATION ─customer confirms─▶ REFUNDED
   │        (customer may instead dispute → REFUND_DISPUTED)
   ├─ gateway (Razorpay): ─▶ REFUNDED  |  gateway error ─▶ REFUND_REQUIRES_RECONCILIATION
   └─ timeouts / retries → REFUND_OVERDUE / REFUND_FAILED
```

- **Creation:** `createRefund` requires exactly one of `booking` or `payment`; auto-created on cancellations (via `buildCancellationRefundKey`); idempotent by key + fingerprint (mismatch → 409). Deadline = `requestedAt + REFUND_DEADLINE_DAYS` (3).
- **Processing:** `POST /api/v1/refunds/:refundId/process {refundMethod}` (owner/admin) — claim-based (`processingClaimToken`), reserves the refund amount against `Payment.refundProcessingAmount` (over-reservation → 409/`REFUND_FAILED`), calls `Razorpay.refunds.create` for gateway refunds, and **releases the reservation** after.
- **Customer confirmation:** `POST /:refundId/confirm-receipt` (customer) for manual refunds → `REFUNDED`, unlocks the owner.
- **Disputes:** `POST /:refundId/dispute {disputeReason}` (customer) → `REFUND_DISPUTED`.
- **Owner lock:** unresolved manual refunds lock the owner (`ownerRestriction.service.js`); table/restaurant booking guards return 409 while refunds are pending; resolved/disputed refunds unlock.
- **Side effects:** notification + email + socket event per transition.

---

## 12. Email Architecture

- **Transport:** `email.service.js` — lazy, pooled nodemailer transporter (`pool: true`, maxConnections 5, maxMessages 100) using `SMTP_HOST/PORT/SECURE/USER/PASS`; sender defaults to `MAIL_FROM || SMTP_USER`. **Under `NODE_ENV=test` sending is skipped** (no-op result) so regression tests never touch real SMTP.
- **Rendering:** `templateParser.js` `compileTemplate(name, vars)` loads `server/src/templates/<name>.html`, expands `{{> business-event}}` partials and replaces `{{KEY}}` variables.
- **Deduplication:** `EmailDelivery` unique `eventKey` prevents duplicate sends (idempotent per business event); failed sends can be retried on replay.
- **Triggers** (`businessEmail.service.js`):
  - Booking created / confirmed / completed / cancelled → customer + owner.
  - Bill generated / settled → customer + owner.
  - Payment successful / failed → customer (+ owner on success).
  - Refund initiated / processed / confirmed / disputed → customer + owner.
  - Restaurant approved / rejected → owner.
  - Report received / resolved / rejected → customer.
  - Warning issued / updated / expired → owner.
  - OTP emails (`otp.service.js`): email verification + password reset.
- **Templates** (`server/src/templates/`): `business-event.html` (master layout: brand header, event label/title, message, DETAILS table, instructions block, CTA, support footer with `SUPPORT_EMAIL`/`SUPPORT_PHONE`, `© YEAR`); 15 event stubs (`booking-*`, `bill-*`, `payment-*`, `refund-*`, `restaurant-*`) include only `{{> business-event}}`; `verify-email.html` and `forgot-password.html` are standalone OTP emails; `invoice.html` and `booking-confirmation.html` exist but are not referenced by the current email builders (legacy stubs).
- **Receipt attachments:** built by `emailPdf.service.js` (see §13) and attached to the booking/bill/payment/refund emails as `TableSpot-Receipt-<code>.pdf`.

---

## 13. Receipt / PDF Architecture

**Server (email attachments):** the **single server-side PDF generator** is `server/src/services/emailPdf.service.js` (pdfkit, A4). It exposes canonical row builders shared with the email body so the HTML `DETAILS` section and the attached PDF always show identical labels and values:

- `bookingReceiptRows(booking)` — booking code, restaurant, date/time, guests, table, customer, status, **advance paid** (only when > 0), payment status, cancellation reason.
- `billReceiptRows(bill, booking)` — bill/booking codes, restaurant, customer, subtotal, **discount/tax/service charge** (only when > 0), grand total, **total paid / balance due** (only when > 0), payment status.
- `paymentReceiptRows(payment, booking, bill)` — amount, method, reference, booking/bill codes, balance due, status.
- `refundReceiptRows(refund, booking, bill)` — refund code, amount, method, booking/bill codes, status, reason, remarks.

`renderPdf(...)` produces the branded A4 PDF (logo header + `TableSpot` fallback, reference line, label/value rows, footer note). Entry points: `createBookingPdf`, `createBillPdf`, `createPaymentPdf`, `createRefundPdf`. These are the **exact functions used for every email attachment**; no duplicate generator exists server-side.

**Client (on-screen downloads):** `client/src/utils/pdf/pdfGenerator.js` uses lazy-loaded **html2pdf.js** to rasterise DOM receipt components (`BookingPdf`, `PaymentPdf`, `RefundPdf`, `OwnerReportPdf`, `BillReceiptPrint`). This is a separate renderer used only for browser downloads — **not** used for email attachments.

---

## 14. Socket.IO Architecture

- **Setup:** `socket.handler.js` — `initSocket(server)` attaches to the same HTTP server; every socket connection is authenticated with an access token (`handshake.auth.token` → `Authorization: Bearer` → `accessToken` cookie) and rejects disabled/deleted accounts.
- **Rooms:**
  - `user_<userId>` — every authenticated user (used for `notification:new` and personal updates).
  - `restaurant_<restaurantId>` — restaurant staff. Owners may only join their own restaurants (verified server-side); admins may join any. `subscribe:tables` / `subscribe:bookings` with no restaurantId join **all** of the owner's restaurant rooms.
- **Client → server:** `join:restaurant`, `leave:restaurant`, `subscribe:tables`, `subscribe:bookings` (all ownership-checked).
- **Server → client events:** `booking:created`, `booking:updated`, `booking:statusUpdated`, `table:updated`, `bill:updated`, `bill:completed`, `refund:statusUpdated`, `payment:reconciliationUpdated`, `notification:new`.
- **Client:** `client/src/services/socket/socketService.js` (lazy singleton, auto-reconnect with subscription restore), `hooks/useSocket.js` (feeds the notification bell), `useLiveNotifications.js` (unread count + window events).

---

## 15. Reconciliation Architecture

**Purpose:** recover captured Razorpay payments whose local booking materialisation failed (e.g. crash between webhook capture and booking creation).

- **Model:** `Reconciliation` — one row per tracked payment (`paymentId` unique), status `PENDING / PROCESSING / FAILED_RETRYABLE / MANUAL_REVIEW / RESOLVED_BOOKING / RESOLVED_REFUND / CLOSED`, plus worker bookkeeping (`attempts`, `claimToken`, `nextAttemptAt`, `processingStartedAt`, `lastError`).
- **Service:** `reconciliation.service.js` — candidate query (`paymentStatus: CAPTURED`, `bookingId: null`, `bookingCreationStatus` PENDING/FAILED), enqueue, atomic claim, `linkPaymentToBooking`, refund path, `emitReconciliationUpdate`.
- **Worker:** `reconciliation.worker.js` — guarded `setInterval` loop (interval `RECONCILIATION_JOB_INTERVAL_MS`, batch `RECONCILIATION_BATCH_SIZE`, max attempts `RECONCILIATION_MAX_ATTEMPTS`), with graceful stop on shutdown.
- **Admin UI:** `client/src/pages/admin/AdminReconciliationPage.jsx` + `POST /api/v1/admin/payments/reconciliation/:id/{retry|refund|close}` (admin-only; all values derived server-side from the tracked payment).
- **Status handling:** RESOLVED_* rows are excluded from the "open" set; retry re-queues; refund creates a payment-scoped refund; close moves it to manual review with a reason.

---

## 16. Database Architecture

MongoDB via Mongoose (all models in `server/src/models/`). Every model uses `timestamps: true` unless noted.

| Model | Purpose | Important relationships / indexes |
|---|---|---|
| `User` | Users (customer/owner/admin), auth provider, Razorpay account fields, favorites | unique `userCode`, `email`; unique partial `razorpayAccountId`; refs `bookingRestrictedBy` |
| `Session` | Login sessions + hashed refresh tokens | unique `sessionCode`; TTL on `expiresAt`; index `userId` |
| `OTP` | Email-verification / password-reset OTPs (bcrypt-hashed) | unique `{email, purpose}`; TTL on `expiresAt` |
| `Restaurant` | Restaurant profile, policy, verification | unique `restaurantCode`, `slug`; ref `ownerId`, `verifiedBy`; embedded `bookingPaymentPolicy`, `cancellationPolicy`, `operatingHours`, `currentOffers` |
| `RestaurantTable` | Tables + seats + booking holds | unique `tableCode`; unique `{restaurantId, tableNumber}`; embedded `seats[]`, `bookingHolds[]` |
| `Food` | Menu items with variants, availability, GST | unique `foodCode`; unique `{restaurantId, foodName}` |
| `Booking` | Reservations (online/walk-in) | unique `bookingCode`; unique partial `sourcePaymentId`; indexes on `restaurantId+bookingDateTime`, `userId+bookingDateTime`, `tableId+bookingStatus` |
| `Payment` | Money record: order + booking materialisation machine | unique partial `{customerId, idempotencyKey}`; unique sparse `razorpayOrderId`, `razorpayPaymentId`; indexes for history and reconciliation |
| `Refund` | Refund lifecycle | unique `refundCode`; unique partial `{bookingId, idempotencyKey}`, `{paymentId, idempotencyKey}`; index `paymentId`, `deadlineAt` |
| `Bill` | Billing with totals + payment ledger | unique `billCode`; unique partial `bookingId`; indexes `restaurantId+billStatus+createdAt` |
| `Reconciliation` | Payment ↔ booking reconciliation queue | unique `paymentId`; indexes `status+nextAttemptAt+processingStartedAt`, `restaurantId+createdAt` |
| `WebhookEvent` | Razorpay webhook idempotency | unique `eventId` |
| `Notification` | In-app notifications | index `{userId, isRead, createdAt}` |
| `Offer` / `OfferRecipient` | Restaurant offers + per-user claims | unique `offerCode`; unique `{offerId, userId}` |
| `RestaurantReview` / `FoodReview` | Reviews (booking-scoped) | unique `{bookingId, restaurantId}` / `{bookingId, foodId}` (legacy per-user unique indexes removed via `syncIndexes`) |
| `RestaurantReport` | Customer reports | unique `reportCode`; indexes `reporterId`, `restaurantId+status` |
| `RestaurantWarning` | Warnings | unique `warningCode`; index `{restaurantId, status}` |
| `AuditLog` | Money/accounting audit trail | indexes `{targetType, targetId}`, `{actorId, createdAt}` |
| `EmailDelivery` | Email idempotency | unique `eventKey` |
| `Counter` | Atomic sequential business codes | `_id` = key, `$inc` sequence |

**Notable index/uniqueness rules**
- All business codes (`USR/RST/TBL/FOD/BKG/BIL/REV/NOT/SES/RFD/AUD/RPT/WRN`) are generated by `utils/generateCode.js` using atomic `Counter` upserts (bootstrapped by scanning existing documents).
- Idempotency is enforced at the database level: payment, refund, webhook event, email delivery, and OTP records all carry unique keys.
- `config/database.js` runs `syncIndexes()` on `RestaurantReview` and `FoodReview` at boot to drop the legacy one-review-per-user unique indexes.

---

## 17. Project Structure

```
tablespot/
├── .nvmrc                       # Node 22.18.0
├── DEPLOYMENT_CONFIGURATION.md  # Deployment audit + runbook (Netlify/Render/Atlas)
├── client/                      # React 19 + Vite SPA
│   ├── playwright.config.mjs
│   ├── vite.config.js
│   ├── public/                  # logos, favicons, _redirects, loading.lottie
│   ├── tests/e2e/               # Playwright specs
│   └── src/
│       ├── api/                 # axios endpoint modules + apiClient.js
│       ├── components/          # ui, common, auth, booking, billing, form,
│       │                        # map, offer, payment, pdf, restaurant, warning,
│       │                        # admin, onboarding, theme, food, owner
│       ├── config/runtime.js    # runtime env gate (API/SOCKET URLs, mock flag)
│       ├── constants/           # roles, statuses, offers, refunds, tables...
│       ├── context/             # ThemeContext, DownloadLoaderContext
│       ├── hooks/               # useAuth, useSocket, useLiveNotifications, ...
│       ├── layouts/             # PublicLayout, AuthLayout, DashboardLayout
│       ├── pages/               # public, auth, customer, owner, admin, profile,
│       │                        # notifications
│       ├── routes/              # AppRoutes, ProtectedRoute, RoleRoute, constants
│       ├── services/socket/     # socket.io-client wrapper
│       ├── store/slices/        # 15 Redux Toolkit slices
│       ├── utils/               # formatters, exports, seatLayout, razorpay,
│       │                        # pdf/, excel/
│       ├── App.jsx / main.jsx
│       └── index.css
└── server/                      # Express 5 + Mongoose API
    ├── .nvmrc
    ├── scripts/                 # e2e-api, e2e-seed, email-flow-test,
    │                            # production-migration + PRODUCTION_MONGODB_MIGRATION.md
    ├── tests/                   # 4 regression suites (booking, holds, payment, account)
    └── src/
        ├── app.js / server.js   # Express app + bootstrap/graceful shutdown
        ├── config/              # env, database, cors, cookie, razorpay
        ├── controllers/         # route handlers
        ├── middleware/          # authenticate, authorize, ownership, errorHandler,
        │                        # upload (multer), validateRequest (zod)
        ├── models/              # Mongoose models
        ├── routes/              # routers mounted under /api/v1
        ├── services/            # domain logic incl. auth/, email, payments, cron
        ├── sockets/socket.handler.js
        ├── templates/           # email HTML templates
        ├── utils/               # jwt, cloudinary, codes, otp, seatLayout, ...
        ├── validators/          # Zod schemas
        └── .env.example
```

---

## 18. Environment Variables

### Server (`server/src/.env`) — see `server/src/.env.example`

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `NODE_ENV` | `development`/`test`/`production`; gates security + mock checks | production: yes | `production` |
| `PORT` | HTTP port | no (default 5000) | `5000` |
| `CLIENT_URL` | Allowed frontend origin (CORS, emails) | production: yes (must be HTTPS) | `https://app.example.com` |
| `CLIENT_ORIGINS` | Extra comma-separated CORS origins | no | `https://a.com,https://b.com` |
| `COOKIE_DOMAIN` | Cookie `Domain` attribute | no | |
| `MONGODB_URI` | Mongo connection string | yes (prod must not be localhost) | `mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority` |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | Connect timeout | no (default 10000) | `10000` |
| `MONGODB_CONNECT_TIMEOUT_MS` | Server selection timeout | no (default 10000) | `10000` |
| `ACCESS_TOKEN_SECRET` | Access-token signing secret | prod: yes (≥32 chars) | `replace_with_random_32_chars` |
| `ACCESS_TOKEN_EXPIRES_IN` | Access token TTL | prod: yes | `15m` |
| `REFRESH_TOKEN_SECRET` | Refresh-token signing secret | prod: yes (≥32 chars) | `replace_with_different_32_chars` |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token TTL | prod: yes | `7d` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary credentials | prod: yes | |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | SMTP transport | prod: yes | `smtp.gmail.com` / `587` / `false` |
| `MAIL_FROM` | From address | prod: yes | `no-reply@example.com` |
| `SUPPORT_EMAIL` / `SUPPORT_PHONE` | Shown in email footers | no (defaults `tablespotapp@gmail.com`, `+916374428721`) | |
| `RAZORPAY_MODE` | Razorpay key mode (`test` or `live`; defaults to `live`) | prod: no (default `live`) | `test` | `live` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay API credentials (prod with `RAZORPAY_MODE=live` must be `rzp_live_...`; `RAZORPAY_MODE=test` allows `rzp_test_...`) | prod: yes | `rzp_test_xxxxxxxx` |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC secret | prod: yes | |
| `RAZORPAY_ORDER_MOCK` / `RAZORPAY_REFUND_MOCK` / `RAZORPAY_ONBOARDING_MOCK` | Mock payment modes | prod: must be `false` | `false` |
| `SALT_ROUNDS` | bcrypt cost | no (default 10) | `12` |
| `MAX_FILE_SIZE_BYTES` / `MAX_UPLOAD_FILES` | Upload limits (multer) | no (defaults 5 MB / 20) | `5242880` / `20` |
| `DEADLINE_JOB_INTERVAL_MS` | Deadline cron interval | no (default 1h) | `3600000` |
| `TABLE_STATUS_JOB_INTERVAL_MS` | Table-status scheduler interval | no (default 30s) | `30000` |
| `OFFER_JOB_INTERVAL_MS` | Offer lifecycle cron | no (default 1h) | `3600000` |
| `WARNING_JOB_INTERVAL_MS` | Warning expiry cron | no (default per `WARNING_EXPIRY_CHECK_INTERVAL_HOURS`) | `3600000` |
| `RECONCILIATION_JOB_INTERVAL_MS` / `RECONCILIATION_BATCH_SIZE` / `RECONCILIATION_MAX_ATTEMPTS` / `RECONCILIATION_RETRY_BASE_MS` | Reconciliation worker tuning | no (defaults 60s / 10 / 5 / 5min) | |

Script-only env vars: `EMAIL_FLOW_OUT_DIR`, `EMAIL_FLOW_DB_URI`, `EMAIL_FLOW_TEST_RECIPIENT` (email-flow-test), `E2E_BASE` (e2e-api), `TEST_RAZORPAY_ACCOUNT_ID` (payment e2e when mocks are off).

### Client (`client/.env`) — see `client/.env.example`

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `VITE_API_URL` | Backend REST base URL | prod: yes (dev fallback `http://localhost:5000/api/v1`) | `http://localhost:5000/api/v1` |
| `VITE_SOCKET_URL` | Backend Socket.IO origin | prod: yes (dev fallback `http://localhost:5000`) | `http://localhost:5000` |
| `VITE_GOOGLE_CLIENT_ID` | Google Identity Services client id (login) | no | |
| `VITE_RAZORPAY_ORDER_MOCK` | Enables client-side mock checkout | prod build must be `false` | `false` |

**Never put server secrets in `VITE_*` variables — they are shipped to the browser.**

---

## 19. Local Development

Prerequisites: **Node 22.18.0** (`.nvmrc`), MongoDB running locally.

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Configure the backend
cp server/src/.env.example server/src/.env
#  - set MONGODB_URI (e.g. mongodb://127.0.0.1:27017/TableSpot)
#  - set JWT secrets (>= 32 chars in production only; any value locally)
#  - set Razorpay test keys, Cloudinary creds, SMTP creds as needed

# 3. Configure the frontend (optional; dev falls back to localhost)
cp client/.env.example client/.env

# 4. Start MongoDB (local)
#    e.g. mongod --dbpath <data-dir>

# 5. Start the backend (server/ — nodemon on port 5000)
npm run dev

# 6. Start the frontend (client/ — Vite on port 5173)
npm run dev
```

Verify the API: `GET http://localhost:5000/health` returns `{"success":true,"status":"ok","database":"connected"}`. Open `http://localhost:5173`.

---

## 20. Testing

### Backend regression suites (`server/`) — run from `server/`

| Command | Coverage | DB |
|---|---|---|
| `npm run test:booking-holds` | Runtime booking holds: concurrent claims, TTL release, expiry | `tablespot_booking_hold_test` |
| `npm run test:booking-api` | E2E booking API: seat selection, overlaps, status transitions, cancellation, socket events | `tablespot_booking_api_test` |
| `npm run test:payment-api` | E2E payment flow in **mock** mode: order → capture → booking materialisation → bill → refund; idempotency | `tablespot_payment_api_test` |
| `npm run test:payment-account` | Razorpay Route onboarding (mock) + account status | `tablespot_payment_account_test` |

The suites set `NODE_ENV=test` (email sending is skipped), fast bcrypt (`SALT_ROUNDS=4`), and require a **localhost** MongoDB. `test:payment-api` uses `TEST_RAZORPAY_ACCOUNT_ID` when mocks are disabled.

### Client E2E (Playwright, `client/`) — optional, needs real services

| File | Scenario |
|---|---|
| `tests/e2e/customer-payment.spec.mjs` | Real Razorpay checkout for a customer booking (order creation, iframe payment, signature verify) |
| `tests/e2e/owner-razorpay.spec.mjs` | Owner linked-account connect + status refresh |

`npx playwright test` from `client/` (config: baseURL `http://localhost:5173`, 1 worker, 180s timeout).

---

## 21. Build

- **Frontend:** `npm run build` (in `client/`) → `vite build`, outputs to `client/dist`. Production build **throws** if `VITE_API_URL`/`VITE_SOCKET_URL` are missing or `VITE_RAZORPAY_ORDER_MOCK=true` (`client/src/config/runtime.js`).
- **Backend:** there is no separate build step — the server runs directly via `node` (ESM). `npm start` runs `node src/server.js`.

---

## 22. Deployment

The current deployment configuration is documented in **[`DEPLOYMENT_CONFIGURATION.md`](./DEPLOYMENT_CONFIGURATION.md)**: client on **Netlify** (Vite build, `client/dist`, `_redirects` SPA fallback), server on **Render** (root dir `server`, `npm start`, health check `/health`, `PORT` from env), database **MongoDB Atlas**, payments **Razorpay**.

Key production requirements enforced by `server/src/config/env.js` at startup:
- All required variables present; `CLIENT_URL` HTTPS; `MONGODB_URI` not localhost; JWT secrets ≥ 32 chars; `RAZORPAY_KEY_ID` matches `RAZORPAY_MODE` (`rzp_live_` by default, `rzp_test_` when `RAZORPAY_MODE=test`); all three Razorpay mock flags `false`.
- The production Razorpay webhook URL must be registered exactly as `https://<backend-host>/api/v1/payments/webhook/razorpay`.
- `server/src/scripts/PRODUCTION_MONGODB_MIGRATION.md` + `node scripts/production-migration.mjs` document the read-only audit and one-time index/backfill migration procedure for an existing production database.

---

## 23. Security

- **Password hashing:** bcrypt (`SALT_ROUNDS`, default 10). OTPs are also bcrypt-hashed before storage.
- **JWT:** separate access/refresh secrets, short access expiry, refresh rotation with bcrypt-hash comparison and reuse detection (rotation invalidates the old refresh token).
- **Cookies:** `httpOnly`, `secure` in production, `SameSite=None` in production (cross-site frontend/backend), 7-day max age, optional `COOKIE_DOMAIN`.
- **CORS:** allow-list of `CLIENT_URL` + `CLIENT_ORIGINS` (+ localhost:5173 in development); `credentials: true`; no wildcard origin.
- **Helmet:** enabled with standard headers.
- **Validation:** Zod schemas on every write route (`validateRequest` → `req.validatedData`); controllers never trust client-sent amounts.
- **Authorization:** role-based `authorize` + ownership checks (`ownership.js`) for bookings/bills/restaurants; socket rooms are ownership-checked.
- **Webhook HMAC:** raw-body SHA-256 HMAC with `RAZORPAY_WEBHOOK_SECRET`, constant-time comparison, event-id idempotency.
- **Idempotency:** unique database keys for payments, refunds, webhook events, emails, OTPs; claim-based processing tokens.
- **Payment ownership:** customers can only verify/query their own payments; bills/refunds are scoped through bookings and restaurants.
- **Rate limiting:** general 1000 req/15 min; auth endpoints 20 req/15 min (`skipSuccessfulRequests`).
- **Sensitive env:** secrets live in `server/src/.env` (git-ignored); production startup validates and refuses insecure configurations; error handler hides internals in production.
- **Graceful shutdown:** SIGINT/SIGTERM close HTTP, Socket.IO, worker, and MongoDB connections.

---

## 24. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Server exits at startup with "Failed to start server" | Production guards: missing env vars, localhost `MONGODB_URI`, non-HTTPS `CLIENT_URL`, short JWT secrets, Razorpay key not matching `RAZORPAY_MODE` (default `live` requires `rzp_live_`, `test` requires `rzp_test_`), or a Razorpay mock flag set to `true` in production. See `config/env.js` + `config/razorpay.js`. |
| `Origin is not allowed by TableSpot CORS policy` | Frontend origin not in `CLIENT_URL` / `CLIENT_ORIGINS`. Add the origin (production) or run the client on `localhost:5173` (dev). |
| Booking creation returns 409 on a `PAY_TO_BOOK` restaurant | Direct booking create is blocked; the customer must use the payment-first flow (`create-order` → pay → verify). |
| "You cannot make tables available for new bookings while refunds are pending" (409) | The owner has unresolved refunds; resolve/confirm/dispute them or wait for the deadline. |
| `Razorpay order was created but payment state requires recovery` (409) | `orderCreationStatus` is `RECOVERY_REQUIRED`; recovered via `findPaymentOrderByReceipt` / reconciliation. |
| Webhook returns "Webhook processing could not be completed" | Signature or event handling failure; the `WebhookEvent` is marked `FAILED_RETRYABLE` and can be reclaimed on the next delivery. |
| Emails not sent during tests | `NODE_ENV=test` short-circuits `sendEmail` — intentional. |
| `MongooseServerSelectionError` | MongoDB not running or wrong `MONGODB_URI`; check `GET /health`. |
| Mongoose "`new` option deprecated" warnings | Non-fatal; code uses `returnDocument` where updated, some legacy `findOneAndUpdate` calls remain. |
| Stale `.email-qa-out` files from `email-flow-test.mjs` | The harness clears its output dir on each run now; delete the dir manually to reset. |
| Stuck/duplicate test DBs (e.g. orphaned `test:payment-api`) | A killed/hung test process can hold a test DB; kill the orphaned node process and/or drop the test DB. |
| `order_mock_...` order ids appearing | A Razorpay mock flag is enabled; disable before any real-gateway work. |

---

## 25. Production Checklist

- [ ] `server/src/.env` contains all `requiredProductionVariables`; none are placeholders.
- [ ] `NODE_ENV=production`; `CLIENT_URL` is HTTPS and matches the deployed frontend origin.
- [ ] `MONGODB_URI` points to Atlas (not localhost) with a least-privilege user; backup taken.
- [ ] JWT secrets ≥ 32 chars and unique between access/refresh; token expiries sensible.
- [ ] Cloudinary + SMTP + Razorpay credentials valid; `RAZORPAY_MODE` set (`live` with `rzp_live_` keys, or temporarily `test` with `rzp_test_` keys).
- [ ] `RAZORPAY_ORDER_MOCK`, `RAZORPAY_REFUND_MOCK`, `RAZORPAY_ONBOARDING_MOCK` all `false`.
- [ ] Webhook registered at exact URL `https://<backend-host>/api/v1/payments/webhook/razorpay` with the correct secret; test with Razorpay test events.
- [ ] Client built with `VITE_API_URL`/`VITE_SOCKET_URL` HTTPS URLs; `VITE_RAZORPAY_ORDER_MOCK=false`.
- [ ] `GET /health` returns 200; login, cookies, Socket.IO, email, uploads verified on the deployed env.
- [ ] Run `node scripts/production-migration.mjs` (audit) against a verified backup before the migration window.
- [ ] Morgan logs contain no secrets; test-run email recipients are placeholder domains only.
- [ ] Graceful shutdown (SIGTERM) verified.

---

## 26. Future Improvements

Reasonable improvements that are **not** currently implemented (confirmed absent from the source):

- Server-side verification of Google ID tokens (currently the client-provided payload is trusted).
- Phone-number verification / login OTP (constants exist; no endpoints).
- Push notifications / email digests and scheduled report delivery.
- Product-configuration API for Razorpay Route (only account creation + onboarding link are implemented; `razorpayProductId` remains unset).
- Wallet / saved-payment-method flows, partial-payment installments.
- Multi-variant GST breakdown per line item on bills (tax is currently a bill-level decision).
- Server-side seat-layout rendering/export image for menus.
- Rate-limit feedback with Retry-After headers.
- Database migration/backup automation and CI pipeline.

---

### Source of Truth

This document and `client/README.md` + `server/README.md` describe the **current** implementation. Whenever architecture, endpoints, models, environment variables or flows change, update the relevant README in the same change. Anything not verifiable from the code is explicitly marked **"Not currently documented/confirmed in the codebase."**

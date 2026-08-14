# TableSpot deployment configuration audit

## Fixed architecture

- Client: Netlify-hosted Vite React application.
- Server: Render-hosted Node/Express application.
- Database: MongoDB Atlas.
- Payments: Razorpay.
- Package manager: npm, based on the committed `package-lock.json` files.
- Node version: pinned to `22.18.0` in the root and `server/.nvmrc` files.

No deployment was performed and no provider URL is invented in this repository.

## Netlify

Create a Netlify site connected to the repository with:

- Base directory: leave blank (repository root)
- Build command: `cd client && npm run build`
- Publish directory: `client/dist`
- SPA fallback: `client/public/_redirects` contains `/* /index.html 200`, preserving direct refreshes for `/login`, `/register`, `/restaurants`, `/foods`, `/dashboard`, `/owner/*`, and `/admin/*`.

If Netlify's Base directory is set to `client` instead, use `npm run build` and publish `dist`; publish paths are relative to that base directory.

Set these in Netlify → Site configuration → Environment variables:

- `VITE_API_URL=https://<actual-render-domain>/api/v1`
- `VITE_SOCKET_URL=https://<actual-render-domain>`
- `VITE_GOOGLE_CLIENT_ID` if Google login is enabled.

Replace the placeholders only after the Render service has its real public URL. Never put server secrets in `VITE_*` variables.

## Render

Create a Render Web Service with:

- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`
- Node version: `22.18.0` via `server/.nvmrc` or the Render environment setting.

The server listens on `process.env.PORT`; no production port is hardcoded.

Set the backend environment variables listed in `server/src/.env.example`. In particular, use the real Netlify origin for `CLIENT_URL`, optional comma-separated additional origins in `CLIENT_ORIGINS`, an Atlas URI for `MONGODB_URI`, Razorpay credentials matching `RAZORPAY_MODE` (`live`/`rzp_live_...`, or temporarily `test`/`rzp_test_...`), and explicit `false` values for all three Razorpay mock flags.

Required Render variables: `NODE_ENV=production`, `PORT`, `MONGODB_URI`, `CLIENT_URL`, `ACCESS_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `RAZORPAY_MODE` (`test` or `live`; defaults to `live` when unset), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_ORDER_MOCK=false`, `RAZORPAY_REFUND_MOCK=false`, and `RAZORPAY_ONBOARDING_MOCK=false`.

> **Temporary test mode on Render:** `RAZORPAY_MODE=test` lets the deployed server use real Razorpay **TEST** keys (`rzp_test_...`). This is intended for exercising the real gateway on Render before go-live and must be switched back to `RAZORPAY_MODE=live` with `rzp_live_...` keys afterwards. Mock modes (`RAZORPAY_*_MOCK`) remain disabled in both modes.

Optional, documented tuning/configuration variables: `CLIENT_ORIGINS`, `COOKIE_DOMAIN`, `MONGODB_SERVER_SELECTION_TIMEOUT_MS`, `MONGODB_CONNECT_TIMEOUT_MS`, `SALT_ROUNDS`, `MAX_FILE_SIZE_BYTES`, `MAX_UPLOAD_FILES`, `WARNING_JOB_INTERVAL_MS`, `TABLE_STATUS_JOB_INTERVAL_MS`, `DEADLINE_JOB_INTERVAL_MS`, and `OFFER_JOB_INTERVAL_MS`.

## MongoDB Atlas

1. Create the Atlas production cluster.
2. Create a least-privilege database user.
3. Configure Network Access for the Render service's outbound IP strategy or approved access policy.
4. Copy the Atlas connection string without committing it.
5. Set `MONGODB_URI` in Render.
6. Take a backup and run `node scripts/production-migration.mjs` manually from the server deployment environment.
7. Resolve any duplicate/index blockers, then run the migration only during the approved maintenance procedure.
8. Rerun the read-only audit and verify indexes, refund counters, relationships, and `/health`.

The migration is never executed automatically during server startup and was not run against production.

## Endpoints

- Health/readiness: `GET /health`. Returns `200` only when the application process has an open Mongoose connection; otherwise returns `503` without connection details.
- Razorpay webhook: `POST /api/v1/payments/webhook/razorpay`.
- The webhook is mounted before `express.json()`, accepts Razorpay's raw JSON body, verifies `x-razorpay-signature`, and does not use normal JWT authentication.

Production Razorpay configuration should be:

`https://<backend-host>/api/v1/payments/webhook/razorpay`

Razorpay → HTTPS endpoint → raw-body signature verification → `WebhookEvent` event-id claim/idempotency → payment handling.

## Production environment contract

The server requires the following in production: `MONGODB_URI`, `CLIENT_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, both token expiry values, Cloudinary credentials, SMTP host/port/user/password/sender, Razorpay key ID/secret/webhook secret, and explicit `false` values for `RAZORPAY_ORDER_MOCK`, `RAZORPAY_REFUND_MOCK`, and `RAZORPAY_ONBOARDING_MOCK`.

`CLIENT_ORIGINS` may contain additional comma-separated HTTPS frontend origins. `COOKIE_DOMAIN` is optional and should normally be left unset unless the deployment explicitly requires a shared parent domain. Timeout and operational tuning variables are documented in `server/src/.env.example`.

The server rejects production startup when frontend URLs are invalid or non-HTTPS, MongoDB is local, JWT secrets are shorter than 32 characters, the Razorpay key does not match `RAZORPAY_MODE` (`rzp_live_` by default, `rzp_test_` when `RAZORPAY_MODE=test`), or any mock flag is enabled/missing.

The client requires `VITE_API_URL` and `VITE_SOCKET_URL` for production builds. Development retains localhost fallbacks. Never put server secrets in `VITE_*` variables.

## Security review

- CORS allows only `CLIENT_URL` and `CLIENT_ORIGINS`; no wildcard origin is used.
- Authentication cookies remain `httpOnly`, `secure` in production, path `/`, and use `SameSite=None` for cross-site frontend/backend hosting. Local development uses `SameSite=Lax` and does not require HTTPS.
- Helmet is enabled. Its standard headers include content-type sniffing protection, frame protection, referrer policy, and related defaults; enable HTTPS at the hosting proxy so HSTS is meaningful in production.
- Production error responses use a generic message for unexpected errors. Development keeps detailed messages.
- Morgan currently logs request metadata and status only; do not add request-header, cookie, token, password, or secret logging.
- SIGTERM/SIGINT shutdown closes HTTP, Socket.io, and MongoDB connections.

## Deployment order

1. Configure production environment variables in the hosting provider, not in Git.
2. Configure the frontend with the deployed backend HTTPS API and Socket.io URLs.
3. Deploy the backend and wait for `GET /health` to return `200`.
4. Register the exact Razorpay webhook URL and secret.
5. Deploy the frontend and test authentication, cookies, Socket.io, email, uploads, and Razorpay test-mode flows with production mock flags disabled. Real-gateway testing on Render uses `RAZORPAY_MODE=test` + `rzp_test_...` keys; flip to `RAZORPAY_MODE=live` + `rzp_live_...` keys before real revenue.
6. Run the Fix #7 MongoDB audit/migration procedure only against the approved database backup and maintenance window; never run it automatically during server startup.

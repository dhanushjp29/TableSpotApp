# TableSpot production MongoDB migration

`production-migration.mjs` is a standalone, read-only-by-default audit and migration utility. It does not delete records, rewrite non-null refund counters, process refunds, or run webhook reconciliation.

## Preconditions

1. Take and verify a MongoDB backup/snapshot. Record the snapshot ID and restore procedure.
2. Deploy the application code containing the current Payment, Refund, Booking, and WebhookEvent schemas before creating the indexes.
3. Set `MONGODB_URI` in `server/src/.env` (or the process environment). The script never prints the URI.
4. Run the script twice against a disposable copy of the database first. The second run must be clean and must not change counts.

## Commands

From the repository root:

```powershell
Set-Location server
node scripts/production-migration.mjs
node scripts/production-migration.mjs --migrate
node scripts/production-migration.mjs
```

The first and last commands are read-only audits. `--migrate` only:

- backfills `Payment.refundedAmount` and `Payment.refundProcessingAmount` when those fields are missing or null;
- creates/verifies the compound customer-scoped payment idempotency index;
- creates/verifies the sparse Razorpay order index;
- creates/verifies the booking-scoped refund idempotency index;
- creates/verifies the unique Razorpay webhook event index.

The migration refuses to create the required indexes when duplicate data blocks them. Resolve duplicates manually, without deleting records, then rerun the audit and migration.

## Refund accounting rule

For each captured payment, the audit calculates:

- `refundedAmount`: sum of Refund records with status `REFUNDED`;
- `refundProcessingAmount`: sum of Refund records with status `PENDING`, `OVERDUE`, `PROCESSING`, or `REQUIRES_RECONCILIATION`.

Existing non-null values that do not match are reported and deliberately left untouched for operator review. Missing/null values are backfilled from the calculated totals; they are never reset to zero globally.

## Duplicate and legacy-index procedure

Review every sampled duplicate group and the complete database-level duplicate report before migration. Preserve all records. Use the gateway IDs, timestamps, statuses, booking IDs, and amounts to determine the canonical business record and document any manual correction.

The old/global `payment_idempotency_unique_partial` index is reported but not dropped automatically. First resolve any cross-customer reuse, confirm that the new `{ customerId, idempotencyKey }` index is present and valid, then remove the old index in a separately approved maintenance step if it is confirmed obsolete. Never drop an index as a substitute for resolving duplicate data.

## Verification and rollout

After migration, rerun the read-only audit and verify the four required named indexes, zero blocking duplicate groups, refund-counter mismatches reviewed, and no new unresolved payment/webhook references. Check application health and configuration, then exercise a Razorpay test-mode order, capture, booking materialization, duplicate order retry, duplicate webhook delivery, refund retry, and refund concurrency path.

## Rollback

Rollback application code separately if needed. Do not roll counters back by setting them to zero. Restore counter fields from the verified pre-migration backup or perform a reviewed field-level restore. If an index must be removed, use its exact name after impact review; removing an index does not delete data, but it removes an integrity guarantee. Keep the backup until post-rollback verification is complete.

import {
  claimReconciliation,
  enqueueReconciliationCandidates,
  markReconciliationRetryable,
  processReconciliation,
} from "./reconciliation.service.js";

const BATCH_SIZE = Number(process.env.RECONCILIATION_BATCH_SIZE) || 10;
const INTERVAL_MS =
  Number(process.env.RECONCILIATION_JOB_INTERVAL_MS) || 60 * 1000;

let running = false;
let timer = null;
let lastRunAt = null;
let lastRunResult = null;

/**
 * One worker cycle: enqueue new candidates, then process a bounded batch of
 * claimed jobs. Multi-instance safe — claims are atomic MongoDB updates, so
 * concurrent workers divide the queue without double-processing.
 */
export const runReconciliationCycle = async ({ log = console } = {}) => {
  if (running) {
    log.warn?.("[reconciliation] A run is already in progress; skipping.");
    return { skipped: true, ...lastRunResult };
  }

  running = true;
  lastRunAt = new Date();
  const result = { enqueued: 0, alreadyTracked: 0, skippedWithBooking: 0, processed: 0, failed: 0, errors: [] };

  try {
    const enqueued = await enqueueReconciliationCandidates({ log });
    result.enqueued = enqueued.enqueued;
    result.alreadyTracked = enqueued.alreadyTracked;
    result.skippedWithBooking = enqueued.skippedWithBooking;

    for (let i = 0; i < BATCH_SIZE; i += 1) {
      const reconciliation = await claimReconciliation();
      if (!reconciliation) break;

      try {
        await processReconciliation({ reconciliation });
        result.processed += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push(error?.message || String(error));
        try {
          await markReconciliationRetryable({ reconciliation, error });
        } catch (markError) {
          result.errors.push(`mark:${markError?.message || String(markError)}`);
          log.error?.("[reconciliation] Failed to mark retryable:", markError);
        }
      }
    }
  } catch (error) {
    result.errors.push(error?.message || String(error));
    log.error?.("[reconciliation] Cycle failed:", error);
  } finally {
    running = false;
  }

  lastRunResult = result;
  log.info?.(
    `[reconciliation] cycle: ${result.processed} processed, ${result.failed} failed, ${result.enqueued} enqueued.`
  );
  return result;
};

export const startReconciliationWorker = () => {
  if (timer) {
    return timer;
  }

  const run = () =>
    runReconciliationCycle().catch((error) =>
      console.error("[reconciliation] Worker error:", error.message)
    );

  run();
  timer = setInterval(run, INTERVAL_MS);
  timer.unref?.();

  console.log(
    `[reconciliation] Worker started. Every ${Math.round(INTERVAL_MS / 1000)}s, batch ${BATCH_SIZE}.`
  );

  return timer;
};

export const stopReconciliationWorker = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  console.log("[reconciliation] Worker stopped.");
};

export const getReconciliationWorkerStatus = () => ({
  enabled: !!timer,
  lastRunAt,
  lastRunResult,
  intervalMs: INTERVAL_MS,
  batchSize: BATCH_SIZE,
});

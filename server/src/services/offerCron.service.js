import {
  expireOffersAndNotify,
  notifyOffersExpiringSoon,
} from "./offer.service.js";

let running = false;

export const runOfferTasks = async ({ log = console } = {}) => {
  if (running) {
    log.warn?.("[offer-cron] A run is already in progress; skipping.");
    return { skipped: true };
  }

  running = true;
  const result = { expiringNotified: 0, expiredRecipients: 0, errors: [] };

  try {
    result.expiringNotified = await notifyOffersExpiringSoon({ log });
    result.expiredRecipients = await expireOffersAndNotify({ log });
  } catch (error) {
    result.errors.push(error.message);
    log.error?.("[offer-cron] Run failed:", error);
  } finally {
    running = false;
  }

  return result;
};

let timer = null;

export const startOfferCron = () => {
  if (timer) {
    return timer;
  }

  const intervalMs =
    Number(process.env.OFFER_JOB_INTERVAL_MS) || 60 * 60 * 1000;

  const run = () =>
    runOfferTasks().catch((error) =>
      console.error("[offer-cron] Run error:", error.message)
    );

  run();
  timer = setInterval(run, intervalMs);
  timer.unref?.();

  console.log(
    `[offer-cron] Started. Running every ${Math.round(intervalMs / 60000)} minutes.`
  );

  return timer;
};

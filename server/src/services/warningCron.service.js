import { WARNING_EXPIRY_CHECK_INTERVAL_HOURS } from "../utils/constants.js";
import { expireActiveWarnings } from "./restaurantWarning.service.js";

let running = false;

export const runWarningExpiryTasks = async ({ log = console } = {}) => {
  if (running) {
    log.warn?.("[warning-cron] A run is already in progress; skipping.");
    return { skipped: true };
  }

  running = true;
  const result = { expiredWarnings: 0, errors: [] };

  try {
    result.expiredWarnings = await expireActiveWarnings();
  } catch (error) {
    result.errors.push(error.message);
    log.error?.("[warning-cron] Run failed:", error);
  } finally {
    running = false;
  }

  return result;
};

let timer = null;

export const startWarningCron = () => {
  if (timer) {
    return timer;
  }

  const intervalMs =
    Number(process.env.WARNING_JOB_INTERVAL_MS) ||
    WARNING_EXPIRY_CHECK_INTERVAL_HOURS * 60 * 60 * 1000;

  const run = () =>
    runWarningExpiryTasks().catch((error) =>
      console.error("[warning-cron] Run error:", error.message)
    );

  run();
  timer = setInterval(run, intervalMs);
  timer.unref?.();

  console.log(
    `[warning-cron] Started. Running every ${Math.round(intervalMs / 3600000)} hours.`
  );

  return timer;
};
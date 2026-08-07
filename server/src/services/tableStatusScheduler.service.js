import RestaurantTable from "../models/RestaurantTable.js";
import { applyExpiredSeatBlocks, emitTableUpdated } from "./table.service.js";
import { runBookingWindowTasks } from "./bookingWindow.service.js";
import { TABLE_STATUS } from "../utils/constants.js";

let running = false;

/**
 * Revert tables whose manual status timer has elapsed back to Available,
 * re-enable reservability and broadcast the change so owner dashboards and
 * customer booking pages update live. Also reverts individual seats whose
 * manual status timer has elapsed, and recomputes booking-derived table
 * statuses so tables flip to Reserved at their booking window start and back
 * to Available once it ends.
 */
export const runTableStatusTasks = async ({ log = console } = {}) => {
    if (running) {
        log.warn?.("[table-status] A run is already in progress; skipping.");
        return { skipped: true };
    }

    running = true;

    const result = { reverted: 0, errors: [], windowChecked: 0 };

    try {
        const due = await RestaurantTable.find({
            statusScheduledUntil: { $ne: null, $lte: new Date() },
            status: { $ne: TABLE_STATUS.AVAILABLE },
            isActive: true,
        });

        for (const table of due) {
            try {
                table.status = TABLE_STATUS.AVAILABLE;
                table.isReservable = true;
                table.statusScheduledUntil = null;
                await table.save();
                await emitTableUpdated(table);
                result.reverted += 1;
            } catch (error) {
                result.errors.push(error.message);
                log.error?.(
                    `[table-status] Revert failed for ${table._id}:`,
                    error.message
                );
            }
        }

        const dueSeatTables = await RestaurantTable.find({
            "seats.statusScheduledUntil": { $ne: null, $lte: new Date() },
            isActive: true,
        });

        for (const table of dueSeatTables) {
            try {
                if (applyExpiredSeatBlocks(table)) {
                    await table.save();
                    await emitTableUpdated(table);
                    result.reverted += 1;
                }
            } catch (error) {
                result.errors.push(error.message);
                log.error?.(
                    `[table-status] Seat revert failed for ${table._id}:`,
                    error.message
                );
            }
        }

        const windowResult = await runBookingWindowTasks({ log });
        result.windowChecked = windowResult.checked;
        result.errors.push(...(windowResult.errors || []));
    } catch (error) {
        result.errors.push(error.message);
        log.error?.("[table-status] Run failed:", error);
    } finally {
        running = false;
    }

    return result;
};

let timer = null;

export const startTableStatusScheduler = () => {
    if (timer) {
        return timer;
    }

    const intervalMs =
        Number(process.env.TABLE_STATUS_JOB_INTERVAL_MS) || 30 * 1000;

    const run = () =>
        runTableStatusTasks().catch((error) =>
            console.error("[table-status] Run error:", error.message)
        );

    run();
    timer = setInterval(run, intervalMs);
    timer.unref?.();

    console.log(
        `[table-status] Started. Reverting expired timers every ${Math.round(intervalMs / 1000)}s.`
    );

    return timer;
};

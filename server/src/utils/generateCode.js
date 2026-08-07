import mongoose from "mongoose";
import Counter from "../models/Counter.js";

/**
 * Scan existing documents to find the largest numeric suffix already in use
 * for the given model field + prefix. Used once to bootstrap the atomic
 * counter so freshly generated codes never collide with pre-existing records.
 */
const scanMaxSequence = async (Model, fieldName, prefix) => {
  const docs = await Model.find({}, { [fieldName]: 1 }).lean();

  let max = 0;
  for (const doc of docs) {
    const code = doc[fieldName];
    if (typeof code !== "string" || !code.startsWith(prefix)) continue;

    const parsed = Number(code.slice(prefix.length));
    if (Number.isInteger(parsed) && parsed >= 0 && parsed > max) {
      max = parsed;
    }
  }

  return max;
};

/**
 * Reconcile the counter so it is positioned at or above the highest existing
 * code for this model+field. Runs before every claim so a counter that lags
 * behind imported/legacy data can never mint a colliding code. The $inc below
 * still guarantees atomic uniqueness under concurrency.
 */
const ensureCounterSeeded = async (key, Model, fieldName, prefix) => {
  const max = await scanMaxSequence(Model, fieldName, prefix);

  const existing = await Counter.findOne({ key }).select("sequence").lean();

  if (!existing) {
    await Counter.create({ key, sequence: max });
  } else if (Number(existing.sequence) < max) {
    await Counter.updateOne({ key }, { $set: { sequence: max } });
  }
};

/**
 * Atomically claim the next sequence number. The $inc + upsert guarantees
 * uniqueness even under concurrent creates, unlike the previous max+1 scan.
 */
const generateCode = async (Model, fieldName, prefix) => {
  const key = `${Model.modelName}:${fieldName}`;

  await ensureCounterSeeded(key, Model, fieldName, prefix);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { key },
        { $inc: { sequence: 1 } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      return `${prefix}${String(counter.sequence).padStart(6, "0")}`;
    } catch (error) {
      // Duplicate-key on the code column (rare concurrent insert): bump the
      // counter and retry with the next value.
      if (error?.code === 11000) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Failed to generate a unique ${prefix} code after multiple attempts.`
  );
};

export default generateCode;

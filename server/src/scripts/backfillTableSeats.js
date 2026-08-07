import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import connectDatabase from "../config/database.js";
import { backfillTableSeats } from "../services/table.service.js";

const run = async () => {
  try {
    await connectDatabase();
    const { updated } = await backfillTableSeats();
    console.log(`Table seats backfilled successfully. Updated ${updated} table(s).`);
    process.exit(0);
  } catch (error) {
    console.error("Failed to backfill table seats:", error.message);
    process.exit(1);
  }
};

run();

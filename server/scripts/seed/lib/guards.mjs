import readline from "readline";
import { getMongoUri, isLocalMongoUri } from "./connect.mjs";

const printBanner = () => {
  console.log("============================================================");
  console.log("  TABLESPOT DEMO/SHOWCASE SEED DATA");
  console.log("  This will UPSERT demo records into the database pointed to");
  console.log("  by MONGODB_URI. Existing data is NOT wiped.");
  console.log(`  Target: ${getMongoUri() || "(not set)"}`);
  console.log("============================================================");
};

const assertSeedAllowed = ({ force = false } = {}) => {
  const uri = getMongoUri();
  printBanner();

  if (!uri) {
    throw new Error("MONGODB_URI is not set. Refusing to seed.");
  }

  if (String(process.env.SEED_ALLOW_PRODUCTION || "").trim() !== "true") {
    throw new Error(
      [
        "Refusing to seed: SEED_ALLOW_PRODUCTION must be set to \"true\" to run the demo seed.",
        "This is a safety guard because the seed targets a real MongoDB database.",
        "Set SEED_ALLOW_PRODUCTION=true in server/src/.env (or the shell) only if you",
        "intend to write the demo records into this database.",
      ].join(" ")
    );
  }

  if (isLocalMongoUri(uri)) {
    console.log("INFO: Target URI looks like a local development database.");
  }

  if (force) {
    return;
  }

  console.log("");
  console.log("WARNING: this writes demo data into the configured database.");
};

const confirmContinue = async () =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Type "YES" and press Enter to continue: ', (answer) => {
      rl.close();
      resolve(String(answer || "").trim().toUpperCase() === "YES");
    });
  });

export { printBanner, assertSeedAllowed, confirmContinue };

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", "..", "..", "src", ".env") });

const getMongoUri = () => process.env.MONGODB_URI;

const isLocalMongoUri = (value) => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(String(value || ""));

const connectDatabase = async () => {
  const uri = getMongoUri();
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in server/src/.env. Refusing to connect.");
  }
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 10000,
  });
  return mongoose.connection;
};

const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

export { getMongoUri, isLocalMongoUri, connectDatabase, disconnectDatabase };

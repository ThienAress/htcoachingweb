import mongoose from "mongoose";
import { safeLog } from "../utils/safeLogger.js";
import { resolveMongoConnectionOptions } from "./mongoConnectionOptions.js";

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI,
      resolveMongoConnectionOptions(),
    );
    safeLog.info("database.connected");
    return mongoose.connection;
  } catch (error) {
    safeLog.error("database.connection_failed", error);
    throw error;
  }
};

export default connectDB;

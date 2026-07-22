import mongoose from "mongoose";
import { safeLog } from "../utils/safeLogger.js";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: process.env.NODE_ENV !== "production",
    });
    safeLog.info("database.connected");
    return mongoose.connection;
  } catch (error) {
    safeLog.error("database.connection_failed", error);
    throw error;
  }
};

export default connectDB;

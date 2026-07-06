import dns from "dns";
import "../src/config/env.js";

if (process.env.NODE_ENV !== "production") {
  dns.setServers(["1.1.1.1", "1.0.0.1"]);
}

import connectDB from "../src/config/db.js";
import Food from "../src/models/Food.js";
import mongoose from "mongoose";

const clear = async () => {
  try {
    await connectDB();
    const result = await Food.deleteMany({});
    console.log(`CLEAR_SUCCESS: Đã xóa sạch thành công ${result.deletedCount} thực phẩm cũ trong DB.`);
    await mongoose.connection.close();
  } catch (error) {
    console.error("CLEAR_ERROR:", error.message);
    process.exit(1);
  }
};

clear();

import dns from "dns";
dns.setServers(["1.1.1.1", "1.0.0.1"]);
import "../config/env.js";
import mongoose from "mongoose";
import connectDB from "../config/db.js";

await connectDB();
const r = await mongoose.connection.db.collection("knowledgeentries").deleteMany({});
console.log("Deleted:", r.deletedCount, "entries");
await mongoose.disconnect();
process.exit(0);

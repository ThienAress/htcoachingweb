import "../config/env.js";
import mongoose from "mongoose";
import BlogPost from "../models/BlogPost.js";
import Recipe from "../models/Recipe.js";
import Order from "../models/Order.js";
import CoachingDay from "../models/CoachingDay.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";

if (process.env.ALLOW_PHASE4_EXPLAIN !== "true") {
  throw new Error("Set ALLOW_PHASE4_EXPLAIN=true and point MONGO_URI at staging");
}
if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");

const summarize = (name, explain) => {
  const stats = explain.executionStats || {};
  return {
    query: name,
    returned: stats.nReturned || 0,
    docsExamined: stats.totalDocsExamined || 0,
    keysExamined: stats.totalKeysExamined || 0,
    executionMs: stats.executionTimeMillis || 0,
    winningStage: explain.queryPlanner?.winningPlan?.stage || "compound",
  };
};

await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
try {
  const sampleOrder = await Order.findOne().select("trainerId userId").lean();
  const samplePlan = await CoachingDay.findOne().select("userId").lean();
  const reports = [];
  reports.push(
    summarize(
      "blog.public.latest",
      await BlogPost.find({ status: "published" })
        .sort({ publishedAt: -1 })
        .limit(12)
        .explain("executionStats"),
    ),
  );
  reports.push(
    summarize(
      "recipe.public.latest",
      await Recipe.find({ isPublished: true })
        .sort({ createdAt: -1 })
        .limit(12)
        .explain("executionStats"),
    ),
  );
  reports.push(
    summarize(
      "knowledge.admin.popular",
      await KnowledgeEntry.find({ status: "published" })
        .sort({ usageCount: -1, updatedAt: -1 })
        .limit(20)
        .explain("executionStats"),
    ),
  );
  if (sampleOrder?.trainerId) {
    reports.push(
      summarize(
        "order.trainer.latest",
        await Order.find({ trainerId: sampleOrder.trainerId })
          .sort({ createdAt: -1 })
          .limit(20)
          .explain("executionStats"),
      ),
    );
  }
  if (samplePlan?.userId) {
    reports.push(
      summarize(
        "coaching.client.timeline",
        await CoachingDay.find({ userId: samplePlan.userId })
          .sort({ date: -1 })
          .limit(100)
          .explain("executionStats"),
      ),
    );
  }
  console.table(reports);
  if (
    reports.some(
      (report) =>
        report.returned > 0 && report.docsExamined > report.returned * 20,
    )
  ) {
    process.exitCode = 2;
    console.error("One or more query plans examine over 20 documents per result");
  }
} finally {
  await mongoose.disconnect();
}

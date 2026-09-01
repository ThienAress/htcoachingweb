import TrainerSubscription from "../models/TrainerSubscription.js";
import User from "../models/User.js";
import { escapeRegex } from "../utils/escapeRegex.js";

export const listTrainerAssignmentCandidates = async ({
  page = 1,
  limit = 50,
  search = "",
  now = new Date(),
} = {}) => {
  const safePage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
  const normalizedSearch = String(search || "").trim().slice(0, 80);
  const subscribedUserIds = await TrainerSubscription.distinct("userId", {
    isActive: true,
    status: "active",
    endDate: { $gt: now },
  });
  const query = {
    $and: [
      {
        $or: [
          { role: "trainer" },
          { _id: { $in: subscribedUserIds } },
        ],
      },
    ],
  };
  if (normalizedSearch) {
    const regex = new RegExp(escapeRegex(normalizedSearch), "i");
    query.$and.push({ $or: [{ name: regex }, { email: regex }] });
  }

  const [total, trainers] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .select("name email avatar role")
      .sort({ name: 1, email: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
  ]);

  return {
    trainers,
    pagination: {
      total,
      currentPage: safePage,
      totalPages: Math.ceil(total / safeLimit) || 1,
      limit: safeLimit,
    },
  };
};

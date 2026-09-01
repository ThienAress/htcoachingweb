import Order from "../models/Order.js";
import { escapeRegex } from "../utils/escapeRegex.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const pagination = (page, limit) => ({
  page: Math.max(Number.parseInt(page, 10) || 1, 1),
  limit: Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100),
});

export const listRecentTrainerOrders = async ({
  page = 1,
  limit = 20,
  search = "",
  status = "",
  assignment = "",
  now = new Date(),
} = {}) => {
  const safe = pagination(page, limit);
  const normalizedSearch = String(search || "").trim().slice(0, 100);
  const filter = { createdAt: { $gte: new Date(now.getTime() - 30 * DAY_MS) } };
  if (["pending", "approved", "completed", "cancelled"].includes(status)) {
    filter.status = status;
  }
  if (assignment === "unassigned") filter.trainerId = null;
  if (assignment === "assigned") filter.trainerId = { $ne: null };
  if (normalizedSearch) {
    const regex = new RegExp(escapeRegex(normalizedSearch), "i");
    filter.$and = [{ $or: [{ name: regex }, { email: regex }, { package: regex }] }];
  }

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .select("userId trainerId name email package sessions totalSessions status createdAt updatedAt")
      .populate("userId", "name email avatar")
      .populate("trainerId", "name email avatar")
      .sort({ status: -1, trainerId: 1, createdAt: -1 })
      .skip((safe.page - 1) * safe.limit)
      .limit(safe.limit)
      .lean(),
  ]);
  return {
    orders,
    pagination: {
      total,
      currentPage: safe.page,
      totalPages: Math.ceil(total / safe.limit) || 1,
      limit: safe.limit,
    },
    windowDays: 30,
  };
};
export const listActiveTrainerAssignments = async ({
  page = 1,
  limit = 20,
  search = "",
} = {}) => {
  const safe = pagination(page, limit);
  const normalizedSearch = String(search || "").trim().slice(0, 100);
  const pipeline = [
    {
      $match: {
        userId: { $ne: null },
        trainerId: { $ne: null },
        $or: [
          { status: "pending" },
          { status: "approved", sessions: { $gt: 0 } },
        ],
      },
    },
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: { clientId: "$userId", trainerId: "$trainerId" },
        latestOrderId: { $first: "$_id" },
        latestStatus: { $first: "$status" },
        updatedAt: { $first: "$updatedAt" },
        activeOrders: { $sum: 1 },
        remainingSessions: { $sum: "$sessions" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id.clientId",
        foreignField: "_id",
        as: "client",
      },
    },
    { $unwind: "$client" },
    {
      $lookup: {
        from: "users",
        localField: "_id.trainerId",
        foreignField: "_id",
        as: "trainer",
      },
    },
    { $unwind: "$trainer" },
  ];
  if (normalizedSearch) {
    const regex = new RegExp(escapeRegex(normalizedSearch), "i");
    pipeline.push({
      $match: {
        $or: [
          { "client.name": regex },
          { "client.email": regex },
          { "trainer.name": regex },
          { "trainer.email": regex },
        ],
      },
    });
  }
  pipeline.push(
    { $sort: { updatedAt: -1 } },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: (safe.page - 1) * safe.limit },
          { $limit: safe.limit },
          {
            $project: {
              _id: 0,
              client: { _id: "$client._id", name: "$client.name", email: "$client.email", avatar: "$client.avatar" },
              trainer: { _id: "$trainer._id", name: "$trainer.name", email: "$trainer.email", avatar: "$trainer.avatar" },
              latestOrderId: 1,
              latestStatus: 1,
              activeOrders: 1,
              remainingSessions: 1,
              updatedAt: 1,
            },
          },
        ],
      },
    },
  );
  const [result] = await Order.aggregate(pipeline);
  const total = result?.metadata?.[0]?.total || 0;
  return {
    assignments: result?.data || [],
    pagination: {
      total,
      currentPage: safe.page,
      totalPages: Math.ceil(total / safe.limit) || 1,
      limit: safe.limit,
    },
  };
};

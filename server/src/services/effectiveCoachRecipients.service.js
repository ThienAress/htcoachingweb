import mongoose from "mongoose";

import Order from "../models/Order.js";
import {
  isCoachAssignmentError,
  prepareCoachResolution,
  resolveOrderCoach,
} from "./effectiveCoach.service.js";

const RECIPIENT_BATCH_SIZE = 100;
const MAX_ACTIVE_ORDERS_PER_CLIENT = 100;

const chunks = (values, size) => {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

const skipReason = (error) => {
  if (error?.codeName === "COACH_ASSIGNMENT_CONFLICT") {
    return "assignment_conflict";
  }
  if (error?.codeName === "COACH_ASSIGNMENT_LIMIT") {
    return "assignment_limit";
  }
  if (isCoachAssignmentError(error)) return "invalid_assignment";
  throw error;
};

// The cron already validates recipient role/existence. This only resolves active
// coaching ownership in bounded recipient batches, without one lookup per client.
export const resolveEffectiveCoachRecipients = async ({
  recipientIds,
  session = null,
  env = process.env,
}) => {
  const eligibleRecipientIds = new Set();
  const excluded = new Map();
  const ids = [...new Map(recipientIds.map((id) => [String(id), id])).values()];

  for (const batch of chunks(ids, RECIPIENT_BATCH_SIZE)) {
    let query = Order.find({
      userId: { $in: batch },
      status: "approved",
      sessions: { $gt: 0 },
    })
      .select("_id userId trainerId createdAt")
      .sort({ createdAt: -1, _id: -1 });
    if (session) query = query.session(session);
    const byRecipient = new Map();
    // Stream results; retain at most101 per customer to classify overflow safely.
    for await (const order of query.lean().cursor()) {
      const key = String(order.userId);
      const current = byRecipient.get(key) || [];
      if (current.length <= MAX_ACTIVE_ORDERS_PER_CLIENT) current.push(order);
      byRecipient.set(key, current);
    }

    const boundedOrders = [];
    for (const [recipientId, recipientOrders] of byRecipient) {
      if (recipientOrders.length > MAX_ACTIVE_ORDERS_PER_CLIENT) {
        excluded.set(recipientId, "assignment_limit");
        continue;
      }
      if (
        recipientOrders.some(
          (order) =>
            order.trainerId != null && !mongoose.isValidObjectId(order.trainerId),
        )
      ) {
        excluded.set(recipientId, "invalid_assignment");
        continue;
      }
      boundedOrders.push(...recipientOrders);
    }
    if (boundedOrders.length === 0) continue;

    const resolution = await prepareCoachResolution({
      orders: boundedOrders,
      session,
      env,
    });
    for (const [recipientId, recipientOrders] of byRecipient) {
      if (excluded.has(recipientId)) continue;
      try {
        const coaches = await Promise.all(
          recipientOrders.map((order) =>
            resolveOrderCoach({ order, resolution, session, env }),
          ),
        );
        if (new Set(coaches.map((coach) => String(coach.trainerId))).size !== 1) {
          excluded.set(recipientId, "assignment_conflict");
          continue;
        }
        eligibleRecipientIds.add(recipientId);
      } catch (error) {
        excluded.set(recipientId, skipReason(error));
      }
    }
  }

  return { eligibleRecipientIds, excluded };
};

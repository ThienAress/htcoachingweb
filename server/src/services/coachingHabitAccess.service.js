import mongoose from "mongoose";
import CoachingHabit from "../models/CoachingHabit.js";
import Order from "../models/Order.js";
import { resolveJournalWriteAccess } from "./dailyJournalAccess.service.js";

export const habitError = (statusCode, message, codeName) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.codeName = codeName;
  return error;
};

export const assertHabitWritesEnabled = () => {
  if (process.env.TODAY_HABIT_WRITES_ENABLED !== "true") {
    throw habitError(
      503,
      "Tính năng Coaching Habit đang tạm dừng ghi dữ liệu",
      "COACHING_HABIT_WRITES_DISABLED",
    );
  }
};

export const resolveClientHabitAccess = ({ clientId, session = null }) =>
  resolveJournalWriteAccess({ clientId, session });

export const assertCoachManagesClient = async ({
  actor,
  clientId,
  session = null,
}) => {
  if (!mongoose.isValidObjectId(clientId)) {
    throw habitError(400, "clientId không hợp lệ", "INVALID_CLIENT_ID");
  }
  if (!new Set(["trainer", "admin"]).has(actor?.role)) {
    throw habitError(403, "Không có quyền", "COACHING_HABIT_FORBIDDEN");
  }
  const filter = {
    userId: clientId,
    status: "approved",
    sessions: { $gt: 0 },
    ...(actor.role === "admin" ? {} : { trainerId: actor.id }),
  };
  let query = Order.findOne(filter)
    .select("_id trainerId")
    .lean();
  if (session) query = query.session(session);
  const order = await query;
  if (!order) {
    throw habitError(
      403,
      "Client không thuộc phạm vi quản lý hiện tại",
      "COACHING_HABIT_FORBIDDEN",
    );
  }
  return order;
};

export const assertTrainerManagesClient = ({
  trainerId,
  clientId,
  session = null,
}) =>
  assertCoachManagesClient({
    actor: { id: trainerId, role: "trainer" },
    clientId,
    session,
  });

export const findHabitForMutation = async ({
  actor,
  habitId,
  session = null,
}) => {
  if (!mongoose.isValidObjectId(habitId)) {
    throw habitError(400, "Habit ID không hợp lệ", "INVALID_HABIT_ID");
  }
  let query = CoachingHabit.findById(habitId);
  if (session) query = query.session(session);
  const habit = await query;
  if (!habit) {
    throw habitError(404, "Không tìm thấy habit", "COACHING_HABIT_NOT_FOUND");
  }
  if (actor.role === "user") {
    if (
      String(habit.clientId) !== String(actor.id) ||
      habit.createdByRole !== "user" ||
      String(habit.createdById) !== String(actor.id)
    ) {
      throw habitError(404, "Không tìm thấy habit", "COACHING_HABIT_NOT_FOUND");
    }
  } else if (actor.role === "trainer" || actor.role === "admin") {
    if (
      habit.createdByRole !== "trainer" ||
      (actor.role === "trainer" &&
        String(habit.createdById) !== String(actor.id))
    ) {
      throw habitError(404, "Không tìm thấy habit", "COACHING_HABIT_NOT_FOUND");
    }
    await assertCoachManagesClient({
      actor,
      clientId: habit.clientId,
      session,
    });
  } else {
    throw habitError(403, "Không có quyền", "COACHING_HABIT_FORBIDDEN");
  }
  return habit;
};

import User from "../models/User.js";
import { observeMetric } from "../observability/metrics.js";
import { assertTrainerWeeklyCheckinRead } from "./weeklyCheckinAccess.service.js";
import {
  buildProgressReadModel,
  createProgressRange,
} from "./progressReadModel.service.js";
import { loadProgressSources } from "./progressSources.service.js";

export const progressError = (statusCode, message, codeName) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.codeName = codeName;
  return error;
};

export const getClientProgress = async ({
  clientId,
  days,
  now = new Date(),
  trainerId = null,
  endDateKey = null,
}) => {
  const startedAt = Date.now();
  const client = await User.findById(clientId).select("_id email").lean();
  if (!client) {
    throw progressError(404, "Không tìm thấy khách hàng", "PROGRESS_CLIENT_NOT_FOUND");
  }
  let range;
  try {
    range = createProgressRange(days, now, endDateKey);
  } catch {
    throw progressError(
      400,
      "Khoảng tiến trình chỉ hỗ trợ 7, 30, 90 hoặc 180 ngày",
      "INVALID_PROGRESS_RANGE",
    );
  }
  const sources = await loadProgressSources({
    clientId: client._id,
    email: client.email,
    range,
    trainerId,
  });
  const data = buildProgressReadModel({ range, ...sources });
  observeMetric("progress.aggregation_latency_ms", Date.now() - startedAt);
  return data;
};

export const getTrainerClientProgress = async ({
  actor,
  clientId,
  days,
  now = new Date(),
  endDateKey = null,
}) => {
  await assertTrainerWeeklyCheckinRead({ actor, clientId });
  return getClientProgress({
    clientId,
    days,
    now,
    trainerId: actor.id,
    endDateKey,
  });
};

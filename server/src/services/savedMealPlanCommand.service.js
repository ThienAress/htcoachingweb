import SavedMealPlan from "../models/SavedMealPlan.js";
import { incrementMetric } from "../observability/metrics.js";
import { savedMealPlanError } from "./savedMealPlanAccess.service.js";
import {
  normalizeSavedMealPlanInput,
  savedMealPlanFingerprint,
} from "./savedMealPlanSnapshot.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const assertSavedMealPlanRequestId = (requestId) => {
  if (!UUID_PATTERN.test(String(requestId || ""))) {
    throw savedMealPlanError(
      400,
      "requestId không hợp lệ",
      "INVALID_REQUEST_ID",
    );
  }
};

export const assertSavedMealPlanExpectedVersion = (version) => {
  if (!Number.isInteger(version) || version < 1) {
    throw savedMealPlanError(
      400,
      "expectedVersion không hợp lệ",
      "INVALID_MEAL_PLAN_VERSION",
    );
  }
};

export const findSavedMealPlanCommandReplay = async ({
  ownerId,
  requestId,
  commandType,
  payloadFingerprint,
  session = null,
}) => {
  let query = SavedMealPlan.findOne({
    ownerId,
    createdByRequestId: requestId,
  }).select("+commandType +createdByRequestId +payloadFingerprint");
  if (session) query = query.session(session);
  const plan = await query;
  if (!plan) return null;
  if (
    plan.commandType !== commandType ||
    plan.payloadFingerprint !== payloadFingerprint
  ) {
    throw savedMealPlanError(
      409,
      "requestId đã được dùng với thao tác hoặc dữ liệu khác",
      "REQUEST_ID_REUSED",
    );
  }
  incrementMetric("saved_meal_plan.idempotency_hits");
  return plan;
};

export const prepareSavedMealPlanContentCommand = ({
  input,
  commandType,
  planId = null,
}) => {
  assertSavedMealPlanRequestId(input?.requestId);
  const normalized = normalizeSavedMealPlanInput(input);
  const payloadFingerprint = savedMealPlanFingerprint({
    commandType,
    planId,
    expectedVersion: input.expectedVersion ?? null,
    normalized,
  });
  return {
    normalized,
    requestId: input.requestId,
    payloadFingerprint,
  };
};

export const handleSavedMealPlanDuplicateCommand = async ({
  error,
  ownerId,
  requestId,
  commandType,
  payloadFingerprint,
}) => {
  if (error?.code !== 11000) throw error;
  const replay = await findSavedMealPlanCommandReplay({
    ownerId,
    requestId,
    commandType,
    payloadFingerprint,
  });
  if (replay) return replay;
  incrementMetric("saved_meal_plan.conflicts");
  throw savedMealPlanError(
    409,
    "Meal plan đã thay đổi bởi yêu cầu khác",
    "SAVED_MEAL_PLAN_CONFLICT",
  );
};

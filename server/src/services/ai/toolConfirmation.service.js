import { createHash, randomBytes } from "node:crypto";

import AiToolConfirmation from "../../models/AiToolConfirmation.js";
import { executeConfirmedTool } from "./tools/toolEngine.js";
import { toolRegistry } from "./tools/toolRegistry.js";

export const AI_TOOL_CONFIRMATION_TTL_MS = 5 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const errorWith = (code, statusCode, message) =>
  Object.assign(new Error(message), { code, statusCode });

const consumedExecutionError = () => {
  const error = errorWith(
    "AI_TOOL_CONFIRMATION_EXECUTION_FAILED",
    409,
    "Hành động đã được xác nhận nhưng chưa thể hoàn tất. Vui lòng kiểm tra trạng thái trước khi thử lại.",
  );
  error.consumed = true;
  return error;
};

const tokenHash = (token) =>
  createHash("sha256").update(String(token)).digest("hex");

export async function createAiToolConfirmation({
  userId,
  toolName,
  parameters,
  now = new Date(),
  model = AiToolConfirmation,
}) {
  const tool = toolRegistry[toolName];
  const confirmation = tool?.confirmation;
  const confirmationTitle = confirmation?.title?.trim();
  const confirmationDescription = confirmation?.description?.trim();
  if (
    !userId ||
    !tool ||
    tool.requiresConfirmation !== true ||
    tool.requiresAuth !== true ||
    tool.readOnly !== false ||
    tool.parallelSafe !== false ||
    !confirmationTitle ||
    confirmationTitle.length > 100 ||
    !confirmationDescription ||
    confirmationDescription.length > 300
  ) {
    throw errorWith(
      "AI_TOOL_CONFIRMATION_UNAVAILABLE",
      400,
      "Công cụ không hỗ trợ xác nhận",
    );
  }
  const serializedParameters = JSON.stringify(parameters ?? {});
  if (Buffer.byteLength(serializedParameters, "utf8") > 8 * 1024) {
    throw errorWith(
      "AI_TOOL_CONFIRMATION_PARAMETERS_TOO_LARGE",
      400,
      "Dữ liệu hành động vượt giới hạn xác nhận",
    );
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + AI_TOOL_CONFIRMATION_TTL_MS);
  await model.create({
    _id: tokenHash(token),
    userId,
    toolName,
    parameters: JSON.parse(serializedParameters),
    expiresAt,
  });
  return {
    token,
    expiresAt: expiresAt.toISOString(),
    title: confirmationTitle,
    description: confirmationDescription,
  };
}

export const serializeAiToolConfirmationCard = (challenge) => ({
  cardType: "confirmation",
  data: {
    token: challenge.token,
    expiresAt: challenge.expiresAt,
    title: challenge.title,
    description: challenge.description,
  },
});

const consumeChallenge = async ({
  userId,
  token,
  nextStatus,
  now = new Date(),
  model = AiToolConfirmation,
}) => {
  if (!userId || !TOKEN_PATTERN.test(String(token || ""))) {
    throw errorWith(
      "AI_TOOL_CONFIRMATION_INVALID",
      400,
      "Yêu cầu xác nhận không hợp lệ",
    );
  }
  const stateField = nextStatus === "consumed" ? "consumedAt" : "cancelledAt";
  const challenge = await model
    .findOneAndUpdate(
      {
        _id: tokenHash(token),
        userId,
        status: "pending",
        expiresAt: { $gt: now },
      },
      { $set: { status: nextStatus, [stateField]: now } },
      { returnDocument: "after" },
    )
    .select("toolName +parameters status expiresAt");
  if (!challenge) {
    throw errorWith(
      "AI_TOOL_CONFIRMATION_EXPIRED_OR_USED",
      409,
      "Yêu cầu xác nhận đã hết hạn hoặc đã được xử lý",
    );
  }
  return challenge;
};

export async function confirmAiToolAction({
  userId,
  token,
  context = {},
  now = new Date(),
  model = AiToolConfirmation,
  executor = executeConfirmedTool,
}) {
  const challenge = await consumeChallenge({
    userId,
    token,
    nextStatus: "consumed",
    now,
    model,
  });
  const tool = toolRegistry[challenge.toolName];
  if (
    !tool ||
    tool.requiresConfirmation !== true ||
    tool.requiresAuth !== true ||
    tool.readOnly !== false ||
    tool.parallelSafe !== false
  ) {
    throw consumedExecutionError();
  }
  let result;
  try {
    result = await executor(
      challenge.toolName,
      challenge.parameters,
      { ...context, userId, confirmationId: String(challenge._id) },
    );
  } catch {
    throw consumedExecutionError();
  }
  if (
    result?.error ||
    result?.meta?.validationFailed ||
    result?.meta?.timedOut ||
    result?.meta?.internalError
  ) {
    throw consumedExecutionError();
  }
  return { completed: true };
}

export async function cancelAiToolAction({
  userId,
  token,
  now = new Date(),
  model = AiToolConfirmation,
}) {
  await consumeChallenge({
    userId,
    token,
    nextStatus: "cancelled",
    now,
    model,
  });
  return { cancelled: true };
}

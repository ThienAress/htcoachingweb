// Tool Engine — Thực thi tools với auth check + error handling
// Học từ Dify ToolEngine pattern: execute → convert result → return

import { toolRegistry } from "./toolRegistry.js";
import Ajv from "ajv";

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
  useDefaults: false,
});
const toolValidators = new Map(
  Object.values(toolRegistry).map((tool) => [
    tool.name,
    ajv.compile(tool.parameters),
  ]),
);
const DEFAULT_TOOL_TIMEOUT_MS = 15000;
const CONFIRMED_TOOL_EXECUTION = Symbol("confirmedToolExecution");
const MAX_EVIDENCE_SOURCES = 3;
const stripUnsafeMetadataText = (value) =>
  String(value ?? "").replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g,
    "",
  );

const normalizeEvidenceSources = (sources) => {
  if (!Array.isArray(sources)) return [];
  const normalized = [];
  const seen = new Set();
  for (const source of sources) {
    try {
      const url = new URL(String(source?.uri || ""));
      if (url.protocol !== "https:" || url.username || url.password) continue;
      url.hash = "";
      const uri = url.href.slice(0, 2048);
      if (!uri || seen.has(uri)) continue;
      const title = stripUnsafeMetadataText(source?.title)
        .replace(/[\r\n]+/g, " ")
        .trim()
        .slice(0, 160);
      if (!title) continue;
      seen.add(uri);
      normalized.push({ title, uri });
      if (normalized.length === MAX_EVIDENCE_SOURCES) break;
    } catch {
      // Tool metadata is untrusted; malformed sources do not cross the boundary.
    }
  }
  return normalized;
};

const validationFailure = (toolName, invalidFields) => ({
  text:
    "Thông tin để thực hiện yêu cầu chưa hợp lệ. Bạn vui lòng kiểm tra và cung cấp lại.",
  uiCard: null,
  error: null,
  meta: {
    toolName,
    validationFailed: true,
    invalidFields: [...new Set(invalidFields)],
  },
});

export const isSuccessfulToolResult = (result) =>
  Boolean(result) &&
  !result.error &&
  !result.needsConfirmation &&
  !result.meta?.validationFailed &&
  !result.meta?.timedOut &&
  !result.meta?.internalError;

const createAbortError = (reason) => {
  const error = new Error(reason?.message || "Tool execution aborted");
  error.name = "AbortError";
  return error;
};

async function runToolWithDeadline(tool, parameters, context) {
  const controller = new AbortController();
  const timeoutMs = Math.min(
    Math.max(Number(context.timeoutMs) || DEFAULT_TOOL_TIMEOUT_MS, 10),
    60000,
  );
  let timedOut = false;
  const abortFromCaller = () => controller.abort(context.signal?.reason);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("Tool execution timed out"));
  }, timeoutMs);

  if (context.signal?.aborted) abortFromCaller();
  else context.signal?.addEventListener("abort", abortFromCaller, { once: true });

  let rejectOnAbort;
  const abortPromise = new Promise((_, reject) => {
    rejectOnAbort = () => reject(createAbortError(controller.signal.reason));
    if (controller.signal.aborted) rejectOnAbort();
    else controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
  });

  try {
    const result = await Promise.race([
      Promise.resolve().then(() =>
        tool.execute(parameters, { ...context, signal: controller.signal }),
      ),
      abortPromise,
    ]);
    return { result, timedOut: false };
  } catch (error) {
    if (context.signal?.aborted) throw createAbortError(context.signal.reason);
    if (timedOut) return { result: null, timedOut: true };
    throw error;
  } finally {
    clearTimeout(timeout);
    context.signal?.removeEventListener("abort", abortFromCaller);
    controller.signal.removeEventListener("abort", rejectOnAbort);
  }
}

/**
 * Thực thi 1 tool call
 * @param {string} toolName - Tên tool
 * @param {object} parameters - Arguments từ LLM
 * @param {object} context - { userId, userRole }
 * @returns {{ text: string, uiCard: object|null, error: string|null }}
 */
export async function executeTool(toolName, parameters, context = {}) {
  const tool = toolRegistry[toolName];

  if (!tool) {
    return {
      text: `Không tìm thấy công cụ "${toolName}"`,
      uiCard: null,
      error: `Tool "${toolName}" not found`,
    };
  }

  if (
    Array.isArray(context.allowedToolNames) &&
    !context.allowedToolNames.includes(toolName)
  ) {
    return {
      text: "Công cụ này không phù hợp với yêu cầu hiện tại.",
      uiCard: null,
      error: null,
      meta: {
        toolName,
        validationFailed: true,
        routeBlocked: true,
        invalidFields: ["toolName"],
      },
    };
  }

  // Guest capability must also be enforced at execution time. Tool schemas are
  // advisory input to the provider; a malformed or hallucinated tool call must
  // not bypass the guest allowlist.
  if (!context?.userId && tool.guestEnabled === false) {
    return {
      text: "Bạn cần đăng nhập để sử dụng tính năng này.",
      uiCard: null,
      error: "Guest tool unavailable",
    };
  }

  // Auth check
  if (tool.requiresAuth && !context.userId) {
    return {
      text: "Bạn cần đăng nhập để sử dụng tính năng này.",
      uiCard: null,
      error: "Auth required",
    };
  }

  const validate = toolValidators.get(toolName);
  if (!validate(parameters)) {
    return validationFailure(
      toolName,
      validate.errors.map(
        (error) =>
          error.instancePath.replace(/^\//, "") ||
          error.params?.missingProperty ||
          "parameters",
      ),
    );
  }

  const customInvalidFields = tool.validateParameters?.(parameters) || [];
  if (customInvalidFields.length > 0) {
    return validationFailure(toolName, customInvalidFields);
  }

  // Confirmation check — trả về FE để hiện dialog
  if (
    tool.requiresConfirmation &&
    context[CONFIRMED_TOOL_EXECUTION] !== true
  ) {
    if (!context.userId) {
      return {
        text: "Bạn cần đăng nhập để xác nhận hành động này.",
        uiCard: null,
        error: "Auth required for confirmation",
      };
    }
    return {
      text: "Hành động này cần xác nhận từ bạn.",
      uiCard: null,
      error: null,
      needsConfirmation: true,
      meta: { toolName },
    };
  }

  const startTime = Date.now();
  try {
    const execution = await runToolWithDeadline(tool, parameters, context);
    const timeCost = Date.now() - startTime;
    if (execution.timedOut) {
      return {
        text: "Công cụ phản hồi quá lâu. Bạn vui lòng thử lại sau ít phút.",
        uiCard: null,
        error: null,
        meta: { toolName, timeCost, timedOut: true },
      };
    }
    const result = execution.result;
    const normalizedSources =
      toolName === "search_knowledge"
        ? normalizeEvidenceSources(result?.meta?.sources)
        : [];
    const evidenceMeta =
      toolName === "search_knowledge"
        ? {
          evidenceAvailable:
            result?.meta?.evidenceAvailable === true &&
            normalizedSources.length > 0,
          sourceCount: normalizedSources.length,
          sources: normalizedSources,
        }
        : toolName === "search_exercises"
          ? {
              evidenceAvailable: result?.meta?.evidenceAvailable === true,
              resultCount: Math.min(
                Math.max(Number(result?.meta?.resultCount) || 0, 0),
                10,
              ),
            }
          : {};

    return {
      text: result.text,
      uiCard: result.uiCard || null,
      error: null,
      meta: { toolName, timeCost, ...evidenceMeta },
    };
  } catch (err) {
    if (context.signal?.aborted) {
      throw createAbortError(context.signal.reason);
    }
    if (
      err?.code === "TDEE_VALIDATION_FAILED" &&
      Array.isArray(err.invalidFields)
    ) {
      return validationFailure(toolName, err.invalidFields);
    }
    // Trả message thân thiện thay vì lỗi kỹ thuật
    const friendlyMessages = {
      search_blog: "Hiện tại chưa có bài viết nào trong hệ thống. Bạn có thể hỏi tôi trực tiếp về chủ đề này nhé!",
      search_exercises: "Không thể tìm bài tập lúc này. Bạn thử mô tả nhóm cơ muốn tập, tôi sẽ tư vấn cho bạn!",
      check_wallet: "Không thể kiểm tra ví lúc này. Bạn có thể xem trực tiếp tại [Ví của tôi](/wallet).",
      get_workout_plan: "Không thể tải giáo án lúc này. Bạn có thể xem tại [Lịch sử tập](/my-history).",
      suggest_meal: "Không thể tạo thực đơn lúc này. Bạn thử hỏi lại hoặc cho tôi biết mục tiêu calo nhé!",
      get_trainer_info: "Không thể tải thông tin HLV lúc này. Bạn có thể xem tại [Đội ngũ HLV](/huan-luyen-vien).",
      search_knowledge: "Không thể tìm kiếm lúc này. Bạn thử đặt câu hỏi khác nhé!",
      calculate_tdee: "Không thể tính TDEE lúc này. Bạn thử cung cấp lại thông tin cân nặng, chiều cao nhé!",
      get_checkin_history: "Không thể tải lịch sử check-in lúc này. Bạn có thể xem tại [Lịch sử tập](/my-history).",
      get_training_schedule: "Không thể tải lịch tập lúc này. Bạn có thể liên hệ HLV để biết lịch tập nhé!",
      get_gym_info: "Không thể tải thông tin phòng tập lúc này. Bạn có thể xem tại [CLB](/club).",
    };

    return {
      text: friendlyMessages[toolName] || "Tôi chưa thể xử lý yêu cầu này lúc này. Bạn thử hỏi cách khác nhé!",
      uiCard: null,
      error: null, // Không set error → FE không hiện banner lỗi đỏ
      meta: { toolName, timeCost: Date.now() - startTime, internalError: err.message },
    };
  }
}

export const executeConfirmedTool = (toolName, parameters, context = {}) =>
  executeTool(toolName, parameters, {
    ...context,
    [CONFIRMED_TOOL_EXECUTION]: true,
  });

// Tool Engine — Thực thi tools với auth check + error handling
// Học từ Dify ToolEngine pattern: execute → convert result → return

import { toolRegistry } from "./toolRegistry.js";

/**
 * Thực thi 1 tool call
 * @param {string} toolName - Tên tool
 * @param {object} parameters - Arguments từ LLM
 * @param {object} context - { userId, userRole }
 * @returns {{ text: string, uiCard: object|null, error: string|null }}
 */
export async function executeTool(toolName, parameters, context) {
  const tool = toolRegistry[toolName];

  if (!tool) {
    return {
      text: `Không tìm thấy công cụ "${toolName}"`,
      uiCard: null,
      error: `Tool "${toolName}" not found`,
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

  // Confirmation check — trả về FE để hiện dialog
  if (tool.requiresConfirmation) {
    return {
      text: "Hành động này cần xác nhận từ bạn.",
      uiCard: {
        cardType: "confirmation",
        data: { toolName, parameters },
      },
      error: null,
      needsConfirmation: true,
    };
  }

  const startTime = Date.now();
  try {
    const result = await tool.execute(parameters, context);
    const timeCost = Date.now() - startTime;

    return {
      text: result.text,
      uiCard: result.uiCard || null,
      error: null,
      meta: { toolName, timeCost },
    };
  } catch (err) {
    return {
      text: `Lỗi khi thực thi ${toolName}: ${err.message}`,
      uiCard: null,
      error: err.message,
      meta: { toolName, timeCost: Date.now() - startTime },
    };
  }
}

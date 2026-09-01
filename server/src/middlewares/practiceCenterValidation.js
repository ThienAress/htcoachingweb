import { PRACTICE_CENTER_SCENARIOS } from "../services/practiceCenter.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = new Set(["scenario", "requestId"]);

export const validatePracticeCenterRequest = (req, res, next) => {
  const body = req.body;
  const keys = body && typeof body === "object" && !Array.isArray(body)
    ? Object.keys(body)
    : [];
  const definition = PRACTICE_CENTER_SCENARIOS[body?.scenario];
  if (
    keys.length !== 2 ||
    keys.some((key) => !ALLOWED_KEYS.has(key)) ||
    !definition ||
    !UUID_PATTERN.test(body?.requestId || "")
  ) {
    return res.status(400).json({
      success: false,
      code: "PRACTICE_REQUEST_INVALID",
      message: "Kịch bản hoặc mã yêu cầu mô phỏng không hợp lệ.",
    });
  }
  req.practiceCenterRequest = {
    scenario: definition.key,
    requestId: body.requestId,
    cost: definition.cost,
  };
  return next();
};

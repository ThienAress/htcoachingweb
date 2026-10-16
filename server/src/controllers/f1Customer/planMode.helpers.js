// Cách dựng giai đoạn của một khách: ban đầu theo cách chọn lúc tạo dự đoán (planSource của giai đoạn 1),
// được đổi đúng một lần sang cách còn lại, áp dụng từ giai đoạn kế tiếp; các giai đoạn đã tạo giữ nguyên.
export const PLAN_MODES = ["system", "trainer"];

export const describePlanMode = ({ customer, prediction }) => {
  const initial = prediction?.planSource === "trainer" ? "trainer" : "system";
  const locked = Boolean(customer?.planModeLockedAt);
  const current = locked && PLAN_MODES.includes(customer.planModeSwitchTo) ? customer.planModeSwitchTo : initial;
  return {
    initial,
    current,
    locked,
    switchedAtStage: locked ? customer.planModeSwitchedAtStage ?? null : null,
  };
};

// Cách dựng của một giai đoạn cụ thể: từ giai đoạn đổi trở đi dùng cách mới, trước đó giữ cách cũ.
export const planModeForStage = (state, stageOrder) =>
  state.locked && state.switchedAtStage !== null && stageOrder >= state.switchedAtStage
    ? state.current
    : state.initial;

export const planModeError = (message, code, status = 409) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.expose = true;
  return error;
};

export const PLAN_MODE_LABELS = { system: "hệ thống đề xuất", trainer: "HLV tự thiết kế" };

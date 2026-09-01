export const TRAINER_CLIENT_TABS = Object.freeze([
  { id: "overview", label: "Tổng quan" },
  { id: "tasks", label: "Theo dõi và hỗ trợ" },
]);

export const TRAINER_SUPPORT_SECTION_ORDER = Object.freeze([
  "health_goals",
  "reports",
]);

const VALID_TAB_IDS = new Set(TRAINER_CLIENT_TABS.map((tab) => tab.id));
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const getTrainerClientId = (client) => {
  const value = client?._id ?? client?.id;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  if (typeof value?.$oid === "string") return value.$oid;
  return "";
};

export const normalizeTrainerClientTab = (value) =>
  value === "wellness" || value === "habits"
    ? "tasks"
    : VALID_TAB_IDS.has(value)
      ? value
      : "overview";

export const normalizeTrainerClientTabForHash = (value, hash) =>
  hash === "#journal" || hash === "#nutrition-report"
    ? "tasks"
    : normalizeTrainerClientTab(value);

const buildTrainerWorkspacePath = (
  basePath,
  clientId,
  { tab = "overview", dateKey = "" } = {},
) => {
  const params = new URLSearchParams();
  const normalizedTab = normalizeTrainerClientTab(tab);
  if (normalizedTab !== "overview") params.set("tab", normalizedTab);
  if (DATE_KEY_PATTERN.test(dateKey)) params.set("date", dateKey);
  const query = params.toString();
  return (
    basePath +
    "/" +
    encodeURIComponent(getTrainerClientId({ _id: clientId })) +
    (query ? "?" + query : "")
  );
};

export const buildTrainerClientWorkspacePath = (clientId, options) =>
  buildTrainerWorkspacePath("/trainer/clients", clientId, options);

export const buildTrainerHealthWorkspacePath = (clientId, options) =>
  buildTrainerWorkspacePath("/trainer/health/clients", clientId, options);

const numberLabel = (value) =>
  Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

export const buildWellnessTargetSummary = (target) => {
  const values = target?.targets;
  if (
    !Number.isFinite(Number(values?.sleepHours)) ||
    !Number.isFinite(Number(values?.waterMl)) ||
    !Number.isFinite(Number(values?.steps))
  ) {
    return [];
  }
  return [
    {
      key: "sleepHours",
      label: "Ngủ",
      value: numberLabel(values.sleepHours) + " giờ",
    },
    {
      key: "waterMl",
      label: "Nước",
      value: numberLabel(Number(values.waterMl) / 1000) + " lít",
    },
    {
      key: "steps",
      label: "Số bước",
      value: numberLabel(values.steps) + " bước",
    },
  ];
};

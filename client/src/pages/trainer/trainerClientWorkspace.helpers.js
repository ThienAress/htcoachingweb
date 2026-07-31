export const TRAINER_CLIENT_TABS = Object.freeze([
  { id: "overview", label: "Tổng quan" },
  { id: "wellness", label: "Mục tiêu sức khỏe" },
  { id: "habits", label: "Thói quen hằng ngày" },
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
  VALID_TAB_IDS.has(value) ? value : "overview";

export const buildTrainerClientWorkspacePath = (
  clientId,
  { tab = "overview", dateKey = "" } = {},
) => {
  const params = new URLSearchParams();
  const normalizedTab = normalizeTrainerClientTab(tab);
  if (normalizedTab !== "overview") params.set("tab", normalizedTab);
  if (DATE_KEY_PATTERN.test(dateKey)) params.set("date", dateKey);
  const query = params.toString();
  return (
    "/trainer/clients/" +
    encodeURIComponent(getTrainerClientId({ _id: clientId })) +
    (query ? "?" + query : "")
  );
};

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

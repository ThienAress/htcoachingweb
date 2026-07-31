import { isValidDateKey } from "../../utils/vietnamDate";

const ELIGIBILITY = new Set([
  "never_coached",
  "pending",
  "active",
  "inactive",
  "assignment_required",
]);
const SECTION_STATUS = new Set(["ready", "empty", "error"]);
const SECTION_NAMES = [
  "schedule",
  "coaching",
  "workout",
  "attendance",
  "journal",
];
const MODULE_NAMES = ["training", "nutrition", "journal"];
const MODULE_STATES = new Set([
  "not_applicable",
  "not_started",
  "in_progress",
  "completed",
]);

const OPTIONAL_SECTION_DEFAULTS = {
  journal: {
    status: "empty",
    source: "daily_journal",
    day: null,
    deepLink: "/today",
    error: null,
  },
};

const contractError = (code, reason) => {
  const error = new Error(code + ": " + reason);
  error.code = code;
  throw error;
};

const normalizeSection = (name, section) => {
  const value = section || OPTIONAL_SECTION_DEFAULTS[name];
  if (!value || !SECTION_STATUS.has(value.status)) {
    contractError("TODAY_CONTRACT_INVALID", "invalid section " + name);
  }
  if (
    typeof value.source !== "string" ||
    typeof value.deepLink !== "string"
  ) {
    contractError("TODAY_CONTRACT_INVALID", "missing section metadata");
  }
  if (value.status === "error" && !value.error?.code) {
    contractError("TODAY_CONTRACT_INVALID", "missing section error code");
  }
  return {
    ...value,
    ...(name === "coaching" || name === "journal"
      ? { day: value.day || null }
      : { items: Array.isArray(value.items) ? value.items : [] }),
    error: value.error || null,
  };
};

const normalizeModuleProgress = (name, progress) => {
  if (
    !progress ||
    !Number.isInteger(progress.completed) ||
    !Number.isInteger(progress.total) ||
    progress.completed < 0 ||
    progress.total < 0 ||
    progress.completed > progress.total ||
    !MODULE_STATES.has(progress.state)
  ) {
    contractError("TODAY_CONTRACT_INVALID", "invalid module progress " + name);
  }

  if (progress.total === 0) {
    if (
      progress.completed !== 0 ||
      progress.percent !== null ||
      progress.state !== "not_applicable"
    ) {
      contractError(
        "TODAY_CONTRACT_INVALID",
        "inconsistent not-applicable module " + name,
      );
    }
    return progress;
  }

  const expectedPercent = Math.round(
    (progress.completed / progress.total) * 100,
  );
  const expectedState =
    expectedPercent === 100
      ? "completed"
      : expectedPercent === 0
        ? "not_started"
        : "in_progress";
  if (
    !Number.isFinite(progress.percent) ||
    progress.percent !== expectedPercent ||
    progress.state !== expectedState
  ) {
    contractError(
      "TODAY_CONTRACT_INVALID",
      "inconsistent module progress " + name,
    );
  }

  return progress;
};

export const adaptTodayDashboard = (payload) => {
  if (!payload || typeof payload !== "object") {
    contractError("TODAY_CONTRACT_INVALID", "payload must be an object");
  }
  if (payload.contractVersion !== 2) {
    contractError(
      "TODAY_CONTRACT_UNSUPPORTED",
      "expected contract version 2",
    );
  }
  if (!isValidDateKey(payload.dateKey)) {
    contractError("TODAY_CONTRACT_INVALID", "invalid dateKey");
  }
  if (
    payload.timeZone !== "Asia/Ho_Chi_Minh" ||
    !ELIGIBILITY.has(payload.eligibility?.status)
  ) {
    contractError("TODAY_CONTRACT_INVALID", "invalid eligibility or timezone");
  }
  if (
    !payload.summary ||
    !Number.isFinite(payload.summary.completionPercent) ||
    payload.summary.formulaVersion !== "today-v2" ||
    !payload.summary.moduleProgress ||
    !payload.capabilities ||
    typeof payload.capabilities.canViewSources !== "boolean"
  ) {
    contractError("TODAY_CONTRACT_INVALID", "invalid summary or capabilities");
  }

  const sections = Object.fromEntries(
    SECTION_NAMES.map((name) => [
      name,
      normalizeSection(name, payload.sections?.[name]),
    ]),
  );
  const moduleProgress = Object.fromEntries(
    MODULE_NAMES.map((name) => [
      name,
      normalizeModuleProgress(name, payload.summary.moduleProgress[name]),
    ]),
  );

  return {
    ...payload,
    sections,
    partialErrors: Array.isArray(payload.partialErrors)
      ? payload.partialErrors
      : [],
    summary: {
      ...payload.summary,
      completionPercent: Math.min(
        100,
        Math.max(0, payload.summary.completionPercent),
      ),
      moduleProgress,
      attentionFlags: Array.isArray(payload.summary.attentionFlags)
        ? payload.summary.attentionFlags
        : [],
    },
  };
};

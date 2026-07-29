export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const pad = (value) => String(value).padStart(2, "0");

export const parseDateKey = (dateKey) => {
  if (!DATE_KEY_PATTERN.test(String(dateKey || ""))) {
    throw Object.assign(new Error("Ngày không hợp lệ (YYYY-MM-DD)"), {
      statusCode: 400,
      code: "INVALID_DATE_KEY",
    });
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw Object.assign(new Error("Ngày không tồn tại"), {
      statusCode: 400,
      code: "INVALID_DATE_KEY",
    });
  }
  return { year, month, day };
};

export const getVietnamDateKey = (date = new Date()) => {
  const parts = {};
  for (const part of dateFormatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const addDaysToDateKey = (dateKey, amount) => {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

export const getAppDayOfWeek = (dateKey) => {
  const { year, month, day } = parseDateKey(dateKey);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
};

export const getVietnamDayRangeUtc = (dateKey) => {
  const { year, month, day } = parseDateKey(dateKey);
  const start = new Date(
    Date.UTC(year, month - 1, day) - VIETNAM_OFFSET_MS,
  );
  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
};

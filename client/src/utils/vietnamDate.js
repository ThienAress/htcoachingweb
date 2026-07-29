export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const parseDateKey = (dateKey) => {
  if (!DATE_KEY_PATTERN.test(String(dateKey || ""))) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
};

export const isValidDateKey = (dateKey) => Boolean(parseDateKey(dateKey));

export const getVietnamDateKey = (date = new Date()) => {
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const addDaysToDateKey = (dateKey, amount) => {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return "";
  const date = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day + amount),
  );
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

export const getAppDayOfWeek = (dateKey) => {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  const jsDay = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day),
  ).getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
};

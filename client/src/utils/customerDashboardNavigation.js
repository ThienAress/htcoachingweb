import { isValidDateKey } from "./vietnamDate";

const DAILY_SECTIONS = new Set(["today", "training", "nutrition", "journal"]);

export const dashboardPathFor = (section, dateKey) => {
  if (section === "progress") return "/dashboard/progress";

  const normalizedSection = DAILY_SECTIONS.has(section) ? section : "today";
  const base = "/dashboard/today/" + dateKey;
  return normalizedSection === "today" ? base : base + "/" + normalizedSection;
};

export const dashboardDateFromPath = (pathname, fallbackDateKey) => {
  const match = pathname.match(/\/dashboard\/today\/(\d{4}-\d{2}-\d{2})(?:\/|$)/);
  return match && isValidDateKey(match[1]) ? match[1] : fallbackDateKey;
};

export const dashboardSectionFromPath = (pathname) => {
  if (pathname.startsWith("/dashboard/progress")) return "progress";

  const match = pathname.match(
    /\/dashboard\/today\/\d{4}-\d{2}-\d{2}\/(training|nutrition|journal)(?:\/|$)/,
  );
  return match?.[1] || "today";
};

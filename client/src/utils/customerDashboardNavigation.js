import { isValidDateKey } from "./vietnamDate";

const DAILY_SECTIONS = new Set(["today", "training", "nutrition", "journal"]);

export const dashboardPathFor = (section, dateKey) => {
  if (section === "progress") return "/dashboard/progress";
  if (section === "selfAssessment") return "/dashboard/self-assessment";

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
  if (pathname.startsWith("/dashboard/self-assessment")) return "selfAssessment";

  const match = pathname.match(
    /\/dashboard\/today\/\d{4}-\d{2}-\d{2}\/(training|nutrition|journal)(?:\/|$)/,
  );
  return match?.[1] || "today";
};

// "Tập luyện" chỉ cho khách coaching; "Đánh giá bản thân" cho HT Fitness+ và cho người hết hạn đã từng làm (chỉ xem lại).
export const isDashboardSectionVisible = (
  section,
  { accessMode, hasSelfAssessmentHistory = false } = {},
) => {
  if (section === "training") return accessMode === "coaching";
  if (section === "selfAssessment") {
    return (
      accessMode === "self_managed" ||
      (accessMode === "blocked" && hasSelfAssessmentHistory)
    );
  }
  return true;
};

export const customerReportFromHash = (hash) =>
  hash === "#journal"
    ? "health"
    : hash === "#nutrition-report"
      ? "nutrition"
      : null;

const TRAINER_CLIENT_OVERVIEW_SURFACES = Object.freeze({
  overview: Object.freeze({
    showAttention: false,
    showCustomerReports: false,
    showOverview: true,
  }),
  reports: Object.freeze({
    showAttention: true,
    showCustomerReports: true,
    showOverview: false,
  }),
});

export const getTrainerClientOverviewSurface = (surface) =>
  TRAINER_CLIENT_OVERVIEW_SURFACES[surface] ||
  TRAINER_CLIENT_OVERVIEW_SURFACES.overview;

export const CUSTOMER_DASHBOARD_THEME_STORAGE_KEY =
  "ht_customer_dashboard_theme_v1";

const VALID_CUSTOMER_DASHBOARD_THEMES = new Set(["light", "dark"]);

const resolveStorage = (storage) => storage ?? globalThis.localStorage;

export const resolveInitialCustomerDashboardTheme = (storage) => {
  try {
    const savedTheme = resolveStorage(storage)?.getItem(
      CUSTOMER_DASHBOARD_THEME_STORAGE_KEY,
    );
    return VALID_CUSTOMER_DASHBOARD_THEMES.has(savedTheme)
      ? savedTheme
      : "light";
  } catch {
    return "light";
  }
};

export const persistCustomerDashboardTheme = (theme, storage) => {
  if (!VALID_CUSTOMER_DASHBOARD_THEMES.has(theme)) return;

  try {
    resolveStorage(storage)?.setItem(
      CUSTOMER_DASHBOARD_THEME_STORAGE_KEY,
      theme,
    );
  } catch {
    // Keep the in-memory theme when storage is unavailable.
  }
};

export const PRICING_VIEW_MODE_KEY = "pricingViewMode";
export const DEFAULT_PRICING_VIEW_MODE = "customer";
export const GUEST_MEAL_PLAN_PREVIEW_KEY =
  "ht_guest_meal_plan_preview_used";

const PRICING_VIEW_MODES = new Set(["customer", "trainer"]);

function getBrowserStorage(storageName) {
  try {
    return globalThis[storageName] ?? null;
  } catch {
    return null;
  }
}

export function resolvePricingViewMode(value) {
  return PRICING_VIEW_MODES.has(value) ? value : DEFAULT_PRICING_VIEW_MODE;
}

export function loadPricingViewMode(
  storage = getBrowserStorage("localStorage"),
) {
  try {
    return resolvePricingViewMode(storage?.getItem(PRICING_VIEW_MODE_KEY));
  } catch {
    return DEFAULT_PRICING_VIEW_MODE;
  }
}

export function persistPricingViewMode(
  mode,
  storage = getBrowserStorage("localStorage"),
) {
  if (!PRICING_VIEW_MODES.has(mode)) return false;

  try {
    storage?.setItem(PRICING_VIEW_MODE_KEY, mode);
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function hasUsedGuestMealPlanPreview(
  storage = getBrowserStorage("sessionStorage"),
) {
  try {
    return storage?.getItem(GUEST_MEAL_PLAN_PREVIEW_KEY) === "true";
  } catch {
    return false;
  }
}

export function markGuestMealPlanPreviewUsed(
  storage = getBrowserStorage("sessionStorage"),
) {
  try {
    storage?.setItem(GUEST_MEAL_PLAN_PREVIEW_KEY, "true");
    return Boolean(storage);
  } catch {
    return false;
  }
}

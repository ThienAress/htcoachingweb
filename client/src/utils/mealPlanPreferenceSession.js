const STORAGE_KEY = "htcoaching.meal-plan.confirmed-preferences.v1";
const CONFIRMED_STATUSES = new Set(["none_known", "declared"]);

const getSessionStorage = () => {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
};

const normalizeSnapshot = (preferences) => {
  const allergyStatus = preferences?.allergyStatus;
  if (!CONFIRMED_STATUSES.has(allergyStatus)) return null;

  const allergens = Array.isArray(preferences?.allergens)
    ? preferences.allergens.filter((item) => typeof item === "string")
    : [];
  const otherAllergenText =
    typeof preferences?.otherAllergenText === "string"
      ? preferences.otherAllergenText
      : "";

  if (
    allergyStatus === "declared" &&
    allergens.length === 0 &&
    !otherAllergenText.trim()
  ) {
    return null;
  }

  return {
    allergyStatus,
    allergens: allergyStatus === "declared" ? [...new Set(allergens)] : [],
    otherAllergenText:
      allergyStatus === "declared" ? otherAllergenText : "",
    budgetVndPerDay: null,
  };
};

export const loadGuestMealPlanPreferences = (
  storage = getSessionStorage(),
) => {
  try {
    if (!storage) return null;
    return normalizeSnapshot(JSON.parse(storage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
};

export const saveGuestMealPlanPreferences = (
  preferences,
  storage = getSessionStorage(),
) => {
  const snapshot = normalizeSnapshot(preferences);
  if (!snapshot || !storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
};

export const clearGuestMealPlanPreferences = (
  storage = getSessionStorage(),
) => {
  try {
    if (!storage) return false;
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};

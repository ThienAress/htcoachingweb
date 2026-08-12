import { describe, expect, it } from "vitest";

import {
  clearGuestMealPlanPreferences,
  loadGuestMealPlanPreferences,
  saveGuestMealPlanPreferences,
} from "../mealPlanPreferenceSession";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

describe("Guest Meal Plan preference session", () => {
  it("round-trips only a confirmed allergy snapshot", () => {
    const storage = createStorage();
    const preference = {
      allergyStatus: "declared",
      allergens: ["fish"],
      otherAllergenText: "Cá thu",
      budgetVndPerDay: 999_999,
      privateNote: "must not persist",
    };

    expect({
      saved: saveGuestMealPlanPreferences(preference, storage),
      loaded: loadGuestMealPlanPreferences(storage),
    }).toEqual({
      saved: true,
      loaded: {
        allergyStatus: "declared",
        allergens: ["fish"],
        otherAllergenText: "Cá thu",
        budgetVndPerDay: null,
      },
    });
  });

  it("rejects unsure or incomplete snapshots", () => {
    const storage = createStorage();

    expect([
      saveGuestMealPlanPreferences({ allergyStatus: "unsure" }, storage),
      saveGuestMealPlanPreferences(
        { allergyStatus: "declared", allergens: [], otherAllergenText: "" },
        storage,
      ),
      loadGuestMealPlanPreferences(storage),
    ]).toEqual([false, false, null]);
  });

  it("clears the confirmed snapshot", () => {
    const storage = createStorage();
    saveGuestMealPlanPreferences(
      { allergyStatus: "none_known", allergens: [], otherAllergenText: "" },
      storage,
    );

    expect({
      cleared: clearGuestMealPlanPreferences(storage),
      loaded: loadGuestMealPlanPreferences(storage),
    }).toEqual({ cleared: true, loaded: null });
  });

  it("fails safely when session storage is unavailable", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect({
      loaded: loadGuestMealPlanPreferences(storage),
      saved: saveGuestMealPlanPreferences(
        { allergyStatus: "none_known", allergens: [], otherAllergenText: "" },
        storage,
      ),
      cleared: clearGuestMealPlanPreferences(storage),
    }).toEqual({ loaded: null, saved: false, cleared: false });
  });
});

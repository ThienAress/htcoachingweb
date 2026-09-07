import { describe, expect, it } from "vitest";

import {
  authorizeMealPlanSafetyMigration,
  getMealPlanSafetyIndexContracts,
} from "../20260810-meal-plan-safety-indexes.js";

describe("meal-plan safety production index migration", () => {
  it("derives the expected indexes from the model schema", () => {
    expect(getMealPlanSafetyIndexContracts().map(({ name }) => name)).toEqual([
      "food_price_lookup",
      "uniq_food_price_observation",
    ]);
  });

  it("binds production authorization to the shared migration guard", () => {
    expect(() =>
      authorizeMealPlanSafetyMigration({
        env: {
          APP_ENV: "production",
          MONGO_URI: "mongodb://localhost/htcoaching",
          MIGRATION_TARGET_DATABASE: "htcoaching",
          CONFIRM_MEAL_PLAN_SAFETY_INDEX_MIGRATION: "yes",
          CONFIRM_PRODUCTION_MIGRATION: "production",
          MIGRATION_BACKUP_SNAPSHOT_ID: "stale-backup-id",
          MIGRATION_APPROVAL_ID: "owner-approved-20260906",
        },
        args: new Set([
          "--target=production",
          "--apply",
          "--confirm-production-indexes",
        ]),
      }),
    ).toThrow(/MIGRATION_BACKUP/);
  });
});

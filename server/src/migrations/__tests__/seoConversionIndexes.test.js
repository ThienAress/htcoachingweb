import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import F1Customer from "../../models/F1Customer.js";
import {
  applySeoConversionIndexes,
  getSeoConversionIndexContracts,
  inspectSeoConversionIndexes,
} from "../20260809-seo-conversion-indexes.js";

describe("SEO and conversion production index migration", () => {
  beforeAll(async () => {
    await setupTestDB();
    await Promise.all(
      [...new Set(getSeoConversionIndexContracts().map(({ model }) => model))]
        .map((model) => model.createCollection().catch((error) => {
          if (error?.codeName !== "NamespaceExists") throw error;
        })),
    );
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("derives the complete nine-index manifest from model schemas", () => {
    expect(getSeoConversionIndexContracts().map(({ name }) => name)).toEqual([
      "uniq_f1_conversion_originBookingId",
      "uniq_f1_conversion_originContactMessageId",
      "uniq_order_conversion_originBookingId",
      "uniq_order_conversion_originContactMessageId",
      "uniq_seo_daily_metric",
      "seo_date_dimension",
      "seo_dimension_key_date",
      "uniq_analytics_sync_provider",
      "analytics_sync_status_lock",
    ]);
  });

  test("creates missing indexes and is idempotent on the next inspection", async () => {
    const models = [
      ...new Set(getSeoConversionIndexContracts().map(({ model }) => model)),
    ];
    await Promise.all(models.map((model) => model.collection.dropIndexes()));

    const firstInspection = await inspectSeoConversionIndexes();
    const created = await applySeoConversionIndexes(firstInspection);
    const secondInspection = await inspectSeoConversionIndexes();
    const rerun = await applySeoConversionIndexes(secondInspection);

    expect({
      accountedFor:
        firstInspection.filter(({ status }) => status === "present").length +
        created.filter(({ status }) => status === "created").length,
      present: secondInspection.filter(({ status }) => status === "present").length,
      unchanged: rerun.filter(({ status }) => status === "unchanged").length,
    }).toEqual({ accountedFor: 9, present: 9, unchanged: 9 });
  });

  test("reports duplicate conversion origins before a unique index is created", async () => {
    await F1Customer.collection.dropIndexes();
    const originBookingId = new mongoose.Types.ObjectId();
    const createdBy = new mongoose.Types.ObjectId();
    await F1Customer.collection.insertMany([
      {
        code: "F1-INDEX-DUPLICATE-1",
        fullName: "Duplicate One",
        age: 30,
        gender: "female",
        createdBy,
        originBookingId,
      },
      {
        code: "F1-INDEX-DUPLICATE-2",
        fullName: "Duplicate Two",
        age: 31,
        gender: "male",
        createdBy,
        originBookingId,
      },
    ]);

    const reports = await inspectSeoConversionIndexes();
    const target = reports.find(({ contract }) =>
      contract.name === "uniq_f1_conversion_originBookingId",
    );

    expect(target.duplicateGroupCount).toBe(1);
  });
});

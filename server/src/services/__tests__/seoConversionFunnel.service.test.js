import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import Booking from "../../models/Booking.js";
import ContactMessage from "../../models/ContactMessage.js";
import F1Customer from "../../models/F1Customer.js";
import Order from "../../models/Order.js";
import { getExplicitConversionFunnel } from "../seoConversionFunnel.service.js";

const start = new Date("2026-08-01T00:00:00.000Z");
const endExclusive = new Date("2026-08-06T00:00:00.000Z");

const attribution = {
  source: "google",
  medium: "organic",
  campaign: "macro",
  referrerHost: "google.com",
  landingPath: "/blog/cach-tinh-macro/",
  contentType: "blog",
  contentSlug: "cach-tinh-macro",
  capturedAt: new Date("2026-08-02T09:00:00.000Z"),
};

const createContact = (overrides = {}) =>
  ContactMessage.create({
    name: "Contact Lead",
    email: "contact@example.com",
    phone: "0912345678",
    social: "facebook",
    package: "ONLINE",
    attribution,
    createdAt: new Date("2026-08-02T10:00:00.000Z"),
    ...overrides,
  });

const createBooking = (overrides = {}) =>
  Booking.create({
    name: "Booking Lead",
    email: "booking@example.com",
    phone: "0912345678",
    gym: "Home gym",
    schedule: "Thu 2",
    package: "ONLINE",
    sessions: 12,
    clientRequestId: `request-${new mongoose.Types.ObjectId()}`,
    requestFingerprint: new mongoose.Types.ObjectId().toString().padEnd(64, "0"),
    attribution,
    createdAt: new Date("2026-08-03T10:00:00.000Z"),
    ...overrides,
  });

const createF1 = ({ actorId, ...overrides }) =>
  F1Customer.create({
    code: `F1-${new mongoose.Types.ObjectId()}`,
    fullName: "Khach Hang F1",
    age: 30,
    gender: "female",
    createdBy: actorId,
    ...overrides,
  });

beforeAll(async () => {
  await setupTestDB();
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("explicit SEO conversion funnel", () => {
  it("counts assessment and customer stages by explicit IDs and deduplicates a shared origin", async () => {
    const actor = await createTestUser({ role: "admin" });
    const contact = await createContact();
    const booking = await createBooking();
    await createF1({
      actorId: actor.user._id,
      originContactMessageId: contact._id,
      status: "assessment_completed",
    });
    await createF1({
      actorId: actor.user._id,
      originBookingId: booking._id,
      status: "program_started",
    });
    await Order.create({
      name: "Booking Lead",
      email: "booking@example.com",
      package: "ONLINE",
      sessions: 12,
      totalSessions: 12,
      gym: "Home gym",
      schedule: "Thu 2",
      status: "approved",
      originBookingId: booking._id,
    });

    const result = await getExplicitConversionFunnel({ start, endExclusive });

    expect(result).toMatchObject({ assessments: 2, customers: 1 });
  });

  it("reports current unattributed stages without inferring from PII", async () => {
    const actor = await createTestUser({ role: "admin" });
    await createF1({
      actorId: actor.user._id,
      status: "assessment_completed",
      createdAt: new Date("2026-08-04T10:00:00.000Z"),
    });
    await Order.create({
      name: "Same Name",
      email: "same@example.com",
      package: "ONLINE",
      sessions: 12,
      totalSessions: 12,
      gym: "Home gym",
      schedule: "Thu 2",
      status: "approved",
      createdAt: new Date("2026-08-04T10:00:00.000Z"),
    });
    await createContact({ name: "Same Name", email: "same@example.com" });

    const result = await getExplicitConversionFunnel({ start, endExclusive });

    expect(result.unattributed).toEqual({ assessments: 1, customers: 1 });
  });

  it("does not expose PII or count a deleted source in a Blog cohort", async () => {
    const actor = await createTestUser({ role: "admin" });
    const contact = await createContact();
    await createF1({
      actorId: actor.user._id,
      originContactMessageId: contact._id,
      status: "assessment_completed",
    });
    await ContactMessage.deleteOne({ _id: contact._id });

    const result = await getExplicitConversionFunnel({
      start,
      endExclusive,
      contentSlug: "cach-tinh-macro",
    });

    expect(result).toMatchObject({ assessments: 0, customers: 0 });
    expect(JSON.stringify(result)).not.toContain("contact@example.com");
  });
});

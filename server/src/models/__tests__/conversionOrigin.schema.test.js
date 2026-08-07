import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import F1Customer from "../F1Customer.js";
import Order from "../Order.js";

const actorId = new mongoose.Types.ObjectId();

const f1Payload = (overrides = {}) => ({
  code: `F1-ORIGIN-${new mongoose.Types.ObjectId()}`,
  fullName: "Khach Hang F1",
  age: 30,
  gender: "female",
  occupation: "Van phong",
  phone: "0912345678",
  email: "origin@gmail.com",
  createdBy: actorId,
  ...overrides,
});

const orderPayload = (overrides = {}) => ({
  name: "Khach Hang Order",
  email: "order@example.com",
  package: "Online",
  sessions: 12,
  totalSessions: 12,
  gym: "Home gym",
  schedule: "Thu 2",
  ...overrides,
});

describe("conversion origin schema contract", () => {
  it("keeps old F1 and Order documents valid without an origin", async () => {
    await expect(new F1Customer(f1Payload()).validate()).resolves.toBeUndefined();
    await expect(new Order(orderPayload()).validate()).resolves.toBeUndefined();
  });

  it("accepts one explicit origin ObjectId", async () => {
    const bookingId = new mongoose.Types.ObjectId();
    const contactId = new mongoose.Types.ObjectId();

    await expect(
      new F1Customer(f1Payload({ originBookingId: bookingId })).validate(),
    ).resolves.toBeUndefined();
    await expect(
      new Order(orderPayload({ originContactMessageId: contactId })).validate(),
    ).resolves.toBeUndefined();
  });

  it("rejects documents that contain both origin types", async () => {
    const bothOrigins = {
      originBookingId: new mongoose.Types.ObjectId(),
      originContactMessageId: new mongoose.Types.ObjectId(),
    };

    await expect(
      new F1Customer(f1Payload(bothOrigins)).validate(),
    ).rejects.toMatchObject({ errors: { conversionOrigin: expect.anything() } });
    await expect(
      new Order(orderPayload(bothOrigins)).validate(),
    ).rejects.toMatchObject({ errors: { conversionOrigin: expect.anything() } });
  });

  it("declares unique partial indexes without requiring a backfill", () => {
    for (const model of [F1Customer, Order]) {
      const indexes = model.schema.indexes();
      for (const field of ["originBookingId", "originContactMessageId"]) {
        expect(indexes).toContainEqual([
          { [field]: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { [field]: { $type: "objectId" } },
          }),
        ]);
      }
    }
  });
});

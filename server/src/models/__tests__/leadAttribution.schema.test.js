import { describe, expect, it } from "vitest";

import Booking from "../Booking.js";
import ContactMessage from "../ContactMessage.js";
import { normalizeLeadAttribution } from "../leadAttribution.schema.js";

const validAttribution = {
  source: "google",
  medium: "organic",
  campaign: "macro-launch",
  referrerHost: "www.google.com",
  landingPath: "/blog/cach-tinh-macro/",
  contentType: "blog",
  contentSlug: "cach-tinh-macro",
  capturedAt: "2026-08-05T10:00:00.000Z",
};

const contactFields = {
  name: "Nguyen Van Test",
  email: "lead@example.com",
  phone: "0912345678",
  social: "https://zalo.me/0912345678",
  package: "ONLINE",
};

const bookingFields = {
  name: "Nguyen Van Booking",
  phone: "0912345678",
  email: "booking@gmail.com",
  gym: "HT Gym",
  schedule: "Monday 09:00",
  package: "1-1 - Standard",
  sessions: 10,
  clientRequestId: "11111111-1111-4111-8111-111111111111",
  requestFingerprint: "a".repeat(64),
};

describe("lead attribution schema", () => {
  it("giữ documents cũ hợp lệ với attribution mặc định null", async () => {
    const contact = new ContactMessage(contactFields);
    const booking = new Booking(bookingFields);

    await expect(contact.validate()).resolves.toBeUndefined();
    await expect(booking.validate()).resolves.toBeUndefined();
    expect(contact.attribution).toBeNull();
    expect(booking.attribution).toBeNull();
  });

  it("chấp nhận cùng một bounded attribution contract", async () => {
    const contact = new ContactMessage({
      ...contactFields,
      attribution: validAttribution,
    });
    const booking = new Booking({
      ...bookingFields,
      attribution: validAttribution,
    });

    await expect(contact.validate()).resolves.toBeUndefined();
    await expect(booking.validate()).resolves.toBeUndefined();
    expect(contact.attribution.toObject()).toEqual(
      expect.objectContaining({ source: "google", contentSlug: "cach-tinh-macro" }),
    );
  });

  it("reject unknown hoặc unsafe attribution fields", async () => {
    const contact = new ContactMessage({
      ...contactFields,
      attribution: { ...validAttribution, rawIp: "127.0.0.1" },
    });

    await expect(contact.validate()).rejects.toThrow();
  });

  it("không ép kiểu field hoặc timestamp do client gửi", () => {
    expect(() =>
      normalizeLeadAttribution({
        ...validAttribution,
        source: 123,
      }),
    ).toThrow();
    expect(() =>
      normalizeLeadAttribution({
        ...validAttribution,
        capturedAt: 123,
      }),
    ).toThrow();
  });
});

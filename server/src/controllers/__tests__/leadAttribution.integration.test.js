import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";

vi.mock("../../utils/sendMail.js", () => ({
  sendContactNotificationToAdmin: vi.fn().mockResolvedValue(undefined),
  sendBookingNotificationToAdmin: vi.fn().mockResolvedValue(undefined),
}));

import {
  clearCollections,
  createTestApp,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import bookingRoutes from "../../routes/booking.routes.js";
import contactRoutes from "../../routes/contact.routes.js";
import Booking from "../../models/Booking.js";
import ContactMessage from "../../models/ContactMessage.js";

let app;

const attribution = {
  source: "google",
  medium: "organic",
  campaign: "macro-launch",
  referrerHost: "www.google.com",
  landingPath: "/blog/cach-tinh-macro/",
  contentType: "blog",
  contentSlug: "cach-tinh-macro",
  capturedAt: "2026-08-05T10:00:00.000Z",
};

const contactBody = {
  name: "Nguyen Van Contact",
  email: "contact@gmail.com",
  phone: "0912345678",
  social: "https://zalo.me/0912345678",
  package: "ONLINE",
};

const bookingBody = {
  name: "Nguyen Van Booking",
  phone: "0912345678",
  email: "booking@gmail.com",
  gym: "HT Gym",
  schedule: "Monday 09:00",
  note: "",
  package: "1-1 - Standard",
  sessions: 10,
  gifts: [],
  clientRequestId: "22222222-2222-4222-8222-222222222222",
};

const publicPost = (path, body) =>
  request(app)
    .post(path)
    .set("Cookie", ["csrfToken=test-csrf-token"])
    .set("X-CSRF-Token", "test-csrf-token")
    .send(body);

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/contact", contactRoutes);
  app.use("/api/bookings", bookingRoutes);
  await Promise.all([Booking.init(), ContactMessage.init()]);
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("public lead attribution", () => {
  it("giữ payload Contact cũ backward-compatible", async () => {
    const response = await publicPost("/api/contact", contactBody);

    expect(response.status).toBe(201);
    expect((await ContactMessage.findOne()).attribution).toBeNull();
  });

  it("normalize và persist Contact attribution", async () => {
    const response = await publicPost("/api/contact", {
      ...contactBody,
      attribution: { ...attribution, source: "Google" },
    });

    expect(response.status).toBe(201);
    expect((await ContactMessage.findOne()).attribution.source).toBe("google");
  });

  it("reject unknown attribution fields trước controller", async () => {
    const response = await publicPost("/api/contact", {
      ...contactBody,
      attribution: { ...attribution, rawIp: "127.0.0.1" },
    });

    expect(response.status).toBe(400);
    expect(await ContactMessage.countDocuments()).toBe(0);
  });

  it("reject attribution vượt giới hạn trước controller", async () => {
    const response = await publicPost("/api/contact", {
      ...contactBody,
      attribution: { ...attribution, campaign: "x".repeat(101) },
    });

    expect(response.status).toBe(400);
  });

  it("persist Booking attribution và giữ idempotent replay", async () => {
    const first = await publicPost("/api/bookings", {
      ...bookingBody,
      attribution,
    });
    const replay = await publicPost("/api/bookings", {
      ...bookingBody,
      attribution: {
        ...attribution,
        source: "newsletter",
        medium: "email",
      },
    });

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body.idempotentReplay).toBe(true);
    expect((await Booking.findOne()).attribution.contentSlug).toBe("cach-tinh-macro");
    expect((await Booking.findOne()).attribution.source).toBe("google");
    expect(await Booking.countDocuments()).toBe(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: { post: vi.fn() },
}));

import api from "../../utils/api";
import { createF1Customer } from "../f1Customer.service";
import { createOrder } from "../order.service";

describe("conversion origin client payloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ data: { success: true, data: {} } });
  });

  it("sends only a Booking ID as F1 conversion origin", async () => {
    await createF1Customer({
      fullName: "Khach Hang F1",
      age: 30,
      gender: "female",
      occupation: "Van phong",
      phone: "0912345678",
      email: "customer@gmail.com",
      assignedTrainerId: "trainer-id",
      originType: "booking",
      originId: "booking-id",
      originBookingId: "untrusted-direct-id",
      originContactMessageId: "untrusted-contact-id",
    });

    expect(api.post).toHaveBeenCalledWith("/f1-customers", {
      fullName: "Khach Hang F1",
      age: 30,
      gender: "female",
      occupation: "Van phong",
      phone: "0912345678",
      email: "customer@gmail.com",
      assignedTrainerId: "trainer-id",
      originBookingId: "booking-id",
    });
  });

  it("sends only a Contact ID as Order conversion origin", async () => {
    await createOrder({
      name: "Order Customer",
      email: "order@example.com",
      phone: "0912345678",
      package: "Online",
      sessions: 12,
      gym: "Home gym",
      schedule: "Thu 2",
      note: "",
      trainerId: null,
      originType: "contact",
      originId: "contact-id",
      originBookingId: "untrusted-booking-id",
    });

    expect(api.post).toHaveBeenCalledWith("/orders", {
      name: "Order Customer",
      email: "order@example.com",
      phone: "0912345678",
      package: "Online",
      sessions: 12,
      gym: "Home gym",
      schedule: "Thu 2",
      note: "",
      trainerId: null,
      originContactMessageId: "contact-id",
    });
  });

  it("keeps legacy creates origin-free when no selector value exists", async () => {
    await createOrder({
      name: "Legacy Customer",
      email: "legacy@example.com",
      package: "Online",
      sessions: 12,
      gym: "Home gym",
      schedule: "Thu 2",
      originType: "booking",
      originId: "",
    });

    expect(api.post.mock.calls[0][1]).not.toHaveProperty("originBookingId");
    expect(api.post.mock.calls[0][1]).not.toHaveProperty(
      "originContactMessageId",
    );
  });
});

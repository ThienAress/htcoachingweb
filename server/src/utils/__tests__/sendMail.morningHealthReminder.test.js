import { afterEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

vi.mock("resend", () => ({
  Resend: class Resend {
    emails = { send };
  },
}));

afterEach(() => {
  send.mockReset();
  vi.resetModules();
  delete process.env.EMAIL_DELIVERY_MODE;
  delete process.env.CLIENT_URL;
});

describe("sendMorningHealthReminderMail", () => {
  it("sends an escaped greeting with a dated Health Goals CTA", async () => {
    process.env.CLIENT_URL = "https://app.example.com/";
    send.mockResolvedValueOnce({ data: { id: "morning-mail-id" } });
    const { sendMorningHealthReminderMail } = await import("../sendMail.js");
    const deliveryKey = "a".repeat(64);

    const result = await sendMorningHealthReminderMail(
      "customer@example.com",
      {
        name: "Khách <Thử>",
        dateKey: "2026-08-29",
        deliveryKey,
      },
    );

    expect(result).toEqual({ providerMessageId: "morning-mail-id" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        subject: expect.stringContaining("Mục tiêu sức khỏe"),
        html: expect.stringMatching(
          /Khách &lt;Thử&gt;.*https:\/\/app\.example\.com\/dashboard\/today\/2026-08-29\/journal#customer-health-goals-title/s,
        ),
      }),
      { idempotencyKey: `morning-health-${deliveryKey}` },
    );
  });

  it("rejects invalid delivery data and does not swallow provider failures", async () => {
    const { sendMorningHealthReminderMail } = await import("../sendMail.js");

    await expect(
      sendMorningHealthReminderMail("customer@example.com", {
        name: "Khách",
        dateKey: "../../admin",
        deliveryKey: "a".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "MORNING_HEALTH_EMAIL_DATA_INVALID" });
    expect(send).not.toHaveBeenCalled();

    send.mockRejectedValueOnce(new Error("provider failed"));
    await expect(
      sendMorningHealthReminderMail("customer@example.com", {
        name: "Khách",
        dateKey: "2026-08-29",
        deliveryKey: "b".repeat(64),
      }),
    ).rejects.toThrow("provider failed");

    send.mockResolvedValueOnce({ data: null, error: { message: "rejected" } });
    await expect(
      sendMorningHealthReminderMail("customer@example.com", {
        name: "Khách",
        dateKey: "2026-08-29",
        deliveryKey: "c".repeat(64),
      }),
    ).rejects.toMatchObject({
      code: "MORNING_HEALTH_EMAIL_PROVIDER_FAILED",
    });
  });
});

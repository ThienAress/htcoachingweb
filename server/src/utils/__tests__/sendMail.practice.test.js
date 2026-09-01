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
});

describe("sendPracticeCenterMail", () => {
  it("delivers a clearly labelled simulation without swallowing provider failures", async () => {
    send.mockResolvedValueOnce({ data: { id: "practice-mail-id" } });
    const { sendPracticeCenterMail } = await import("../sendMail.js");

    const result = await sendPracticeCenterMail("owner@example.com", {
      scenario: "checkin",
      name: "HLV <Thử>",
      requestId: "a0000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({ providerMessageId: "practice-mail-id" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        subject: expect.stringContaining("[MÔ PHỎNG]"),
        html: expect.stringMatching(/\[MÔ PHỎNG\].*HLV &lt;Thử&gt;/s),
      }),
      {
        idempotencyKey:
          "practice-a0000000-0000-4000-8000-000000000001-checkin",
      },
    );

    send.mockRejectedValueOnce(new Error("provider failed"));
    await expect(
      sendPracticeCenterMail("owner@example.com", {
        scenario: "order",
        name: "HLV",
        requestId: "a0000000-0000-4000-8000-000000000002",
      }),
    ).rejects.toThrow("provider failed");

    send.mockResolvedValueOnce({
      data: null,
      error: { message: "provider rejected" },
    });
    await expect(
      sendPracticeCenterMail("owner@example.com", {
        scenario: "checkin",
        name: "HLV",
        requestId: "a0000000-0000-4000-8000-000000000003",
      }),
    ).rejects.toMatchObject({ code: "PRACTICE_EMAIL_PROVIDER_FAILED" });
  });
});

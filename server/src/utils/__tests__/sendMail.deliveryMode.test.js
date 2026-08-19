import { afterEach, describe, expect, test, vi } from "vitest";

const originalDeliveryMode = process.env.EMAIL_DELIVERY_MODE;
const originalResendApiKey = process.env.RESEND_API_KEY;

const restoreEnv = (key, value) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

afterEach(() => {
  restoreEnv("EMAIL_DELIVERY_MODE", originalDeliveryMode);
  restoreEnv("RESEND_API_KEY", originalResendApiKey);
  vi.resetModules();
});

describe("sendMail delivery mode", () => {
  test("loads without a Resend key when outbound email is disabled", async () => {
    process.env.EMAIL_DELIVERY_MODE = "disabled";
    delete process.env.RESEND_API_KEY;
    vi.resetModules();

    await expect(import("../sendMail.js")).resolves.toMatchObject({
      sendMail: expect.any(Function),
    });
  });
});

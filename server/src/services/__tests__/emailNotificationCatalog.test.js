import { describe, expect, it, vi } from "vitest";

vi.mock("resend", () => ({
  Resend: class ResendMock {
    constructor() {
      this.emails = { send: vi.fn() };
    }
  },
}));

import { EMAIL_NOTIFICATION_CATALOG } from "../../constants/emailNotificationCatalog.js";
import * as outboundMail from "../../utils/sendMail.js";

describe("email notification catalog", () => {
  it("covers every exported outbound email sender", () => {
    const exportedSenders = Object.keys(outboundMail)
      .filter((name) => name.startsWith("send"))
      .sort();
    const catalogSenders = EMAIL_NOTIFICATION_CATALOG
      .map((item) => item.sender)
      .sort();

    expect(catalogSenders).toEqual(exportedSenders);
  });
});

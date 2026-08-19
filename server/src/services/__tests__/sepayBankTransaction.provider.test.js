import crypto from "crypto";
import { describe, expect, it } from "vitest";

import {
  normalizeSePayApiTransaction,
  normalizeSePayWebhook,
  verifySePayWebhookSignature,
} from "../sepayBankTransaction.provider.js";
import { requireSePayWebhookConfig } from "../../config/sepay.js";

const webhookPayload = {
  id: 92704,
  gateway: "TPBank",
  transactionDate: "2026-08-15 10:30:00",
  accountNumber: "0123456789",
  code: "htc-ab12-cd34",
  content: "HTC-AB12-CD34 chuyen tien",
  transferType: "in",
  transferAmount: 150000,
  referenceCode: "FT260815ABC",
};

const signedHeaders = ({ rawBody, timestamp, secret }) => ({
  signatureHeader:
    "sha256=" +
    crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody.toString("utf8")}`)
      .digest("hex"),
  timestampHeader: String(timestamp),
});

describe("verifySePayWebhookSignature", () => {
  it("accepts a valid signature over the original raw body", () => {
    const rawBody = Buffer.from(JSON.stringify(webhookPayload));
    const timestamp = 1_800_000_000;
    const secret = "test-sepay-webhook-secret-with-32-bytes";

    expect(() =>
      verifySePayWebhookSignature({
        rawBody,
        secret,
        nowSeconds: timestamp,
        ...signedHeaders({ rawBody, timestamp, secret }),
      }),
    ).not.toThrow();
  });

  it("rejects a signature when the raw body was changed", () => {
    const originalBody = Buffer.from(JSON.stringify(webhookPayload));
    const changedBody = Buffer.from(
      JSON.stringify({ ...webhookPayload, transferAmount: 900000 }),
    );
    const timestamp = 1_800_000_000;
    const secret = "test-sepay-webhook-secret-with-32-bytes";

    expect(() =>
      verifySePayWebhookSignature({
        rawBody: changedBody,
        secret,
        nowSeconds: timestamp,
        ...signedHeaders({ rawBody: originalBody, timestamp, secret }),
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_SIGNATURE" }));
  });

  it("rejects a valid signature outside the five-minute replay window", () => {
    const rawBody = Buffer.from(JSON.stringify(webhookPayload));
    const timestamp = 1_800_000_000;
    const secret = "test-sepay-webhook-secret-with-32-bytes";

    expect(() =>
      verifySePayWebhookSignature({
        rawBody,
        secret,
        nowSeconds: timestamp + 301,
        ...signedHeaders({ rawBody, timestamp, secret }),
      }),
    ).toThrowError(expect.objectContaining({ code: "REQUEST_EXPIRED" }));
  });
});

describe("SePay transaction normalization", () => {
  it("normalizes a webhook payload into the canonical bank transaction shape", () => {
    const result = normalizeSePayWebhook(webhookPayload);

    expect(result).toMatchObject({
      provider: "sepay",
      source: "webhook",
      providerTransactionId: "92704",
      gateway: "TPBank",
      accountNumber: "0123456789",
      depositCode: "HTC-AB12-CD34",
      transferType: "in",
      amount: 150000,
      referenceCode: "FT260815ABC",
      transactionAt: new Date("2026-08-15T10:30:00+07:00"),
    });
  });

  it("restores separators when TPBank removes them from a deposit code", () => {
    const result = normalizeSePayWebhook({
      ...webhookPayload,
      code: null,
      content: "HTCE445DDDC FT26231604698561",
    });

    expect(result.depositCode).toBe("HTC-E445-DDDC");
  });

  it("keeps the legacy canonical deposit code unchanged", () => {
    const result = normalizeSePayWebhook({
      ...webhookPayload,
      code: "HTC-E445-DDDC",
      content: "chuyen tien",
    });

    expect(result).toMatchObject({
      depositCode: "HTC-E445-DDDC",
      depositCodeAmbiguous: false,
    });
  });

  it("treats canonical and compact forms of the same code as one candidate", () => {
    const result = normalizeSePayWebhook({
      ...webhookPayload,
      code: "HTC-E445-DDDC",
      content: "HTCE445DDDC FT26231604698561",
    });

    expect(result).toMatchObject({
      depositCode: "HTC-E445-DDDC",
      depositCodeAmbiguous: false,
    });
  });

  it("marks two different compact deposit codes as ambiguous", () => {
    const result = normalizeSePayWebhook({
      ...webhookPayload,
      code: null,
      content: "HTCE445DDDC HTCAB12CD34",
    });

    expect(result).toMatchObject({
      depositCode: "HTC-E445-DDDC",
      depositCodeAmbiguous: true,
    });
  });

  it("does not match embedded or overlong deposit-code tokens", () => {
    const result = normalizeSePayWebhook({
      ...webhookPayload,
      code: null,
      content: "XHTCE445DDDC HTCE445DDDC1 HTC-E445-DDDC-FFFF",
    });

    expect(result).toMatchObject({
      depositCode: null,
      depositCodeAmbiguous: false,
    });
  });

  it("normalizes an API v2 transaction without treating its UUID as a webhook id", () => {
    const result = normalizeSePayApiTransaction({
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      transaction_date: "2026-08-15 10:30:00",
      account_number: "0123456789",
      transfer_type: "in",
      amount_in: 150000,
      transaction_content: "HTC-AB12-CD34 chuyen tien",
      reference_number: "FT260815ABC",
      code: null,
      bank_brand_name: "TPBank",
    });

    expect(result).toMatchObject({
      source: "reconciliation",
      providerTransactionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      depositCode: "HTC-AB12-CD34",
      amount: 150000,
      transactionAt: new Date("2026-08-15T10:30:00+07:00"),
    });
  });

  it("rejects non-integer transfer amounts", () => {
    expect(() =>
      normalizeSePayWebhook({ ...webhookPayload, transferAmount: 1000.5 }),
    ).toThrowError(expect.objectContaining({ code: "MALFORMED_PAYLOAD" }));
  });

  it("rejects calendar rollover dates from the provider", () => {
    expect(() =>
      normalizeSePayWebhook({
        ...webhookPayload,
        transactionDate: "2026-02-31 10:30:00",
      }),
    ).toThrowError(expect.objectContaining({ code: "MALFORMED_PAYLOAD" }));
  });

  it("requires an explicit UTC ISO cutover timestamp", () => {
    expect(() =>
      requireSePayWebhookConfig({
        SEPAY_ENABLED: "true",
        SEPAY_MODE: "sandbox",
        SEPAY_WEBHOOK_SECRET: "test-sepay-webhook-secret-with-32-bytes",
        SEPAY_DATA_HASH_SECRET: "test-sepay-data-hash-secret-with-32-bytes",
        SEPAY_AUTOMATION_CUTOVER_AT: "August 15, 2026",
        BANK_ACCOUNT: "0123456789",
      }),
    ).toThrowError(expect.objectContaining({ code: "WEBHOOK_NOT_CONFIGURED" }));
  });
});

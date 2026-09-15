import { describe, expect, it } from "vitest";

import { waitForFailedRecoveryReceipt } from "../stagingAiChatAcceptance.browser.js";

const cohort = {
  jti: "recovery-jti",
  requestId: "recovery-request-id",
  runId: "recovery-run-id",
  actorId: "recovery-actor-id",
  releaseSha: "a".repeat(40),
  runtimeInstanceId: "recovery-runtime-id",
  action: "ai_chat",
  purpose: "provider_failure_retry",
  mode: "provider_failure_before_llm",
};

const failedReceipt = (overrides = {}) => ({
  _id: cohort.jti,
  recordType: "capability",
  receiptVersion: 2,
  receiptState: "settled",
  outcome: "failed",
  admittedAt: new Date("2026-09-15T00:00:00.000Z"),
  settledAt: new Date("2026-09-15T00:00:01.000Z"),
  ...cohort,
  ...overrides,
});

describe("AC-009 browser failure-recovery receipt barrier", () => {
  it("waits for delayed failed settlement before admitting recovery", async () => {
    let reads = 0;
    const receipt = await waitForFailedRecoveryReceipt({
      collection: { findOne: async () => (++reads === 1 ? { ...failedReceipt(), receiptState: "admitted" } : failedReceipt()) },
      ...cohort,
      timeoutMs: 10,
      pollMs: 1,
      wait: async () => {},
    });

    expect({ reads, receiptState: receipt.receiptState, outcome: receipt.outcome }).toEqual({
      reads: 2,
      receiptState: "settled",
      outcome: "failed",
    });
  });

  it("fails closed when the exact receipt cohort mismatches", async () => {
    await expect(waitForFailedRecoveryReceipt({
      collection: { findOne: async () => failedReceipt({ purpose: "provider_failure_edit" }) },
      ...cohort,
      timeoutMs: 10,
      pollMs: 1,
      wait: async () => {},
    })).rejects.toMatchObject({ code: "STAGING_AI_RECEIPT_MISMATCH" });
  });

  it("fails closed when settlement does not arrive before the bounded deadline", async () => {
    let now = 0;
    await expect(waitForFailedRecoveryReceipt({
      collection: { findOne: async () => ({ ...failedReceipt(), receiptState: "admitted" }) },
      ...cohort,
      timeoutMs: 3,
      pollMs: 1,
      now: () => now,
      wait: async (milliseconds) => { now += milliseconds; },
    })).rejects.toMatchObject({ code: "STAGING_AI_RECEIPT_UNSETTLED" });
  });
});

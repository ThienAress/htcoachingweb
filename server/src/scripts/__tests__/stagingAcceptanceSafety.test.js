import { describe, expect, it, vi } from "vitest";

import {
  createAcceptanceIdentity,
  reconciliationIssueDelta,
  runWithVerifiedCleanup,
} from "../stagingAcceptanceSafety.js";

describe("staging acceptance run safety", () => {
  it("treats only new wallet reconciliation issues as acceptance residue", () => {
    expect(reconciliationIssueDelta(1, 1)).toBe(0);
    expect(reconciliationIssueDelta(3, 1)).toBe(2);
    expect(reconciliationIssueDelta(0, 1)).toBe(0);
  });

  it("creates a canonical opaque marker from a UUID run id", () => {
    expect(
      createAcceptanceIdentity({
        runId: "018f47f0-72a4-7c3c-9b21-891c46ffcb16",
      }),
    ).toEqual({
      runId: "018f47f0-72a4-7c3c-9b21-891c46ffcb16",
      marker:
        "htcoaching-acceptance:018f47f0-72a4-7c3c-9b21-891c46ffcb16",
    });
  });

  it("always cleans and verifies a successful run", async () => {
    const calls = [];
    const result = await runWithVerifiedCleanup({
      execute: async () => {
        calls.push("execute");
        return { passed: 4 };
      },
      cleanup: async () => calls.push("cleanup"),
      verify: async () => {
        calls.push("verify");
        return { residue: 0, collections: { bookings: 0 } };
      },
    });

    expect(result).toEqual({
      value: { passed: 4 },
      cleanup: {
        verified: true,
        residue: 0,
        collections: { bookings: 0 },
      },
    });
    expect(calls).toEqual(["execute", "cleanup", "verify"]);
  });

  it("cleans after a failed flow and preserves the original failure", async () => {
    const cleanup = vi.fn();
    const verify = vi.fn().mockResolvedValue({ residue: 0 });

    await expect(
      runWithVerifiedCleanup({
        execute: async () => {
          throw new Error("flow failed");
        },
        cleanup,
        verify,
      }),
    ).rejects.toThrow("flow failed");
    expect(cleanup).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledOnce();
  });

  it("fails closed when cleanup leaves any synthetic residue", async () => {
    await expect(
      runWithVerifiedCleanup({
        execute: async () => ({ passed: 1 }),
        cleanup: async () => {},
        verify: async () => ({
          residue: 2,
          collections: { deposits: 1, walletTransactions: 1 },
        }),
      }),
    ).rejects.toMatchObject({
      code: "STAGING_ACCEPTANCE_CLEANUP_INCOMPLETE",
      cleanup: {
        verified: false,
        residue: 2,
      },
    });
  });
});

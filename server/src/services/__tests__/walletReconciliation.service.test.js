import { describe, expect, it } from "vitest";

import { subscriptionRequiresPurchaseLedger } from "../walletReconciliation.service.js";

describe("wallet reconciliation subscription scope", () => {
  it("requires a purchase ledger only for paid purchases and legacy paid records", () => {
    expect([
      subscriptionRequiresPurchaseLedger({ amount: 200000, source: "self_purchase" }),
      subscriptionRequiresPurchaseLedger({ amount: 200000, source: "legacy" }),
      subscriptionRequiresPurchaseLedger({ amount: 0, source: "free_trial" }),
      subscriptionRequiresPurchaseLedger({ amount: 200000, source: "admin_grant" }),
      subscriptionRequiresPurchaseLedger({ amount: 200000, source: "pending_grant" }),
    ]).toEqual([true, true, false, false, false]);
  });
});

import { describe, expect, it } from "vitest";

import {
  executeWalletReconciliationCli,
  reconciliationExitCode,
} from "../reconcileWallets.js";

describe("wallet reconciliation CLI exit contract", () => {
  it.each([
    [{ totalIssues: 0, coverageComplete: true }, 0],
    [{ totalIssues: 1, coverageComplete: true }, 2],
    [{ totalIssues: 0, coverageComplete: false }, 2],
  ])("maps report %j to exit code %i", (report, expected) => {
    expect(reconciliationExitCode(report)).toBe(expected);
  });

  it("returns exit 1 for runtime/config failure without echoing sensitive details", async () => {
    let errorText = "";
    const exitCode = await executeWalletReconciliationCli({
      run: async () => {
        const error = new Error(
          "synthetic connection failure with private credentials",
        );
        error.code = "MONGO_CONFIG_INVALID";
        throw error;
      },
      errorOutput: { write: (value) => { errorText += value; } },
    });

    expect({ exitCode, errorText }).toEqual({
      exitCode: 1,
      errorText:
        '{"error":"WALLET_RECONCILIATION_FAILED","code":"MONGO_CONFIG_INVALID"}\n',
    });
  });
});

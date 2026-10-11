import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../pages/ContractSign.jsx", import.meta.url),
  "utf8",
);
const viLocale = JSON.parse(
  readFileSync(new URL("../../i18n/locales/vi/coaching.json", import.meta.url), "utf8"),
);

describe("ContractSign recovery UX", () => {
  it("refetches an uncertain signing outcome before offering another signature", () => {
    expect(source).toContain("shouldRefetchSigningOutcome(requestError)");
    expect(source).toContain(
      'refetchQueries({ queryKey: ["contract", id], exact: true })',
    );
    expect(source).toContain('contract.status === "signing"');
    expect(source).toContain("!isSigning");
    expect(viLocale.contract.status_signing_reconciliation).toContain(
      "xác minh kết quả",
    );
  });
});

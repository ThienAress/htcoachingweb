import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../ContractsTab.jsx", import.meta.url), "utf8");
const viLocale = JSON.parse(
  readFileSync(
    new URL("../../../../i18n/locales/vi/account.json", import.meta.url),
    "utf8",
  ),
);

describe("ContractsTab status localization", () => {
  it("uses the contract namespace and exposes Vietnamese signed status", () => {
    expect(component).toContain('signed: { label: t("contracts.signed")');
    expect(component).not.toContain('t("status.signed")');
    expect(viLocale.contracts.signed).toBe("Đã ký");
  });
});

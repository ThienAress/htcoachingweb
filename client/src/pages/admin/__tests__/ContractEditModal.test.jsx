import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../ContractEditModal.jsx", import.meta.url),
  "utf8",
);

describe("ContractEditModal revision binding", () => {
  it("sends the revision returned by the successful save and preserves stale form state", () => {
    expect(source).toContain("getInitialDraftRevision(contract)");
    expect(source).toContain("buildSavedDraftSendCommand(contract._id, response)");
    expect(source).toContain("setRevisionConflict(true)");
    expect(source).toContain("Bản nháp đang nhập vẫn được giữ lại");
    expect(source).not.toContain("sendMut.mutate(contract._id)");
  });
});

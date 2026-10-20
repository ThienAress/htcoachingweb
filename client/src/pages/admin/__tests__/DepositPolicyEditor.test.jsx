import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const policy = {
  currency: "VND",
  minAmount: 10000,
  maxAmount: 1000000000,
  policyVersion: 4,
  tiers: [
    { key: "starter", minAmount: 10000, bonusRate: 10, label: null },
    { key: "growth", minAmount: 150000, bonusRate: 15, label: "Phổ biến" },
    { key: "premium", minAmount: 500000, bonusRate: 20, label: null },
  ],
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: policy, isPending: false, isError: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({}),
}));

import DepositPolicyEditor from "../deposits/DepositPolicyEditor";

describe("DepositPolicyEditor", () => {
  const html = renderToStaticMarkup(<DepositPolicyEditor />);

  it("shows the saved thresholds, rates and names for the three tiers", () => {
    expect(html).toContain('value="150000"');
    expect(html).toContain('value="500000"');
    expect(html).toContain('value="Phổ biến"');
    expect(html).toContain("Bậc 1 · Khởi đầu");
    expect(html).toContain("Phổ biến");
    expect(html).toContain("Bậc 3 · Tối ưu");
  });

  it("writes each editable threshold out in thousands so 150000 is easy to read", () => {
    expect(html).toContain("= 150.000");
    expect(html).toContain("= 500.000");
  });

  it("keeps the first tier's threshold fixed at the minimum deposit", () => {
    expect(html).toContain("mức nạp tối thiểu");
    expect(html).not.toContain('id="deposit-tier-min-starter" type="number"');
  });

  it("starts with the save button disabled and no error showing", () => {
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*Lưu chính sách/);
    expect(html).not.toContain('role="alert"');
  });
});

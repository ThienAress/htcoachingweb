import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: { post: vi.fn() },
}));

import api from "../../utils/api";
import { signContract } from "../contract.service";

describe("contract service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the handwritten signature and explicit consent", async () => {
    const payload = {
      signatureImage: "data:image/png;base64,AAAA",
      acceptedTerms: true,
    };
    api.post.mockResolvedValueOnce({ data: { success: true } });

    await signContract("contract-1", payload);

    expect(api.post).toHaveBeenCalledWith(
      "/contracts/contract-1/sign",
      payload,
    );
  });
});

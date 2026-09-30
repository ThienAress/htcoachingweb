import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: { post: vi.fn(), put: vi.fn() },
}));

import api from "../../utils/api";
import {
  sendContractToClient,
  signContract,
  updateContract,
} from "../contract.service";

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

  it("binds a draft update to the revision rendered by the editor", async () => {
    const payload = { clientInfo: { name: "Khách thử" } };
    api.put.mockResolvedValueOnce({ data: { success: true } });

    await updateContract("contract-1", payload, 7);

    expect(api.put).toHaveBeenCalledWith("/contracts/contract-1", {
      ...payload,
      expectedRevision: 7,
    });
  });

  it("issues the saved draft revision instead of an implicit latest snapshot", async () => {
    api.post.mockResolvedValueOnce({ data: { success: true } });

    await sendContractToClient("contract-1", 8);

    expect(api.post).toHaveBeenCalledWith("/contracts/contract-1/send", {
      expectedRevision: 8,
    });
  });
});

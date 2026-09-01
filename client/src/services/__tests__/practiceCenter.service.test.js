import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "../../utils/api";
import {
  getPracticeCenter,
  sendPracticeCenterSimulation,
} from "../practiceCenter.service";

vi.mock("../../utils/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

beforeEach(() => vi.clearAllMocks());

describe("practiceCenter.service", () => {
  it("uses the protected Practice Center API contract", async () => {
    const signal = new AbortController().signal;
    const payload = {
      scenario: "journey",
      requestId: "a0000000-0000-4000-8000-000000000001",
    };
    vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true } });
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } });

    await getPracticeCenter({ signal });
    await sendPracticeCenterSimulation(payload);

    expect(api.get).toHaveBeenCalledWith("/practice-center", { signal });
    expect(api.post).toHaveBeenCalledWith("/practice-center/send", payload);
  });
});

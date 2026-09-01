import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "../../utils/api";
import {
  executeTrainerTransfer,
  getActiveTrainerAssignments,
  getRecentTrainerOrders,
  previewTrainerTransfer,
} from "../trainerCoordination.service";

vi.mock("../../utils/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe("trainerCoordination.service", () => {
  it("uses the admin trainer coordination endpoints", async () => {
    const params = { page: 2, limit: 20 };
    const preview = { clientId: "client", fromTrainerId: "from", toTrainerId: "to" };
    const command = { ...preview, requestId: "request-001", previewToken: "a".repeat(64) };
    vi.mocked(api.get).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });

    await getRecentTrainerOrders(params);
    await getActiveTrainerAssignments(params);
    await previewTrainerTransfer(preview);
    await executeTrainerTransfer(command);

    expect([
      api.get.mock.calls,
      api.post.mock.calls,
    ]).toEqual([
      [
        ["/admin/trainer-coordination/orders/recent", { params }],
        ["/admin/trainer-coordination/assignments/active", { params }],
      ],
      [
        ["/admin/trainer-coordination/transfers/preview", preview],
        ["/admin/trainer-coordination/transfers", command],
      ],
    ]);
  });
});

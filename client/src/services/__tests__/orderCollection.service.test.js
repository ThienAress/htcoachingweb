import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: { get: vi.fn() },
}));

import api from "../../utils/api";
import { getAllOrders } from "../orderCollection.service";

describe("getAllOrders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses valid paginated requests instead of the old limit=0 sentinel", async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          data: {
            orders: [{ _id: "1" }],
            totalPages: 2,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            orders: [{ _id: "2" }],
            totalPages: 2,
          },
        },
      });

    await expect(getAllOrders()).resolves.toEqual([{ _id: "1" }, { _id: "2" }]);
    expect(api.get).toHaveBeenNthCalledWith(1, "/orders?page=1&limit=100");
    expect(api.get).toHaveBeenNthCalledWith(2, "/orders?page=2&limit=100");
    expect(api.get.mock.calls.flat().join(" ")).not.toContain("limit=0");
  });
});

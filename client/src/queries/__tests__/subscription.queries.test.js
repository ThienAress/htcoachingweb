import { describe, expect, test, vi } from "vitest";

vi.mock("../../services/trainerSubscription.service", () => ({
  getMySubscription: vi.fn(),
}));

import { getMySubscription } from "../../services/trainerSubscription.service";
import {
  mySubscriptionQueryOptions,
  selectMySubscriptionSnapshot,
} from "../subscription.queries";

describe("Subscription query options", () => {
  test("shares a full snapshot while default consumers select the subscription", async () => {
    const signal = new AbortController().signal;
    getMySubscription.mockResolvedValue({
      data: {
        data: { planCode: "PRO" },
        freeTrial: { status: "used" },
      },
    });
    const options = mySubscriptionQueryOptions({ userId: "user-1" });
    const snapshot = await options.queryFn({ signal });

    expect({
      snapshot,
      selected: options.select(snapshot),
      raw: selectMySubscriptionSnapshot(snapshot),
      call: getMySubscription.mock.calls[0][0],
    }).toEqual({
      snapshot: {
        subscription: { planCode: "PRO" },
        freeTrial: { status: "used" },
      },
      selected: { planCode: "PRO" },
      raw: {
        subscription: { planCode: "PRO" },
        freeTrial: { status: "used" },
      },
      call: { signal },
    });
  });
});

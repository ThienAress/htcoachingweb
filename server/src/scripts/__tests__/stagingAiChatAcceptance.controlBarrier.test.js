import { describe, expect, it } from "vitest";
import { waitControlStatus } from "../stagingAiChatAcceptance.controlBarrier.js";

const clock = () => {
  let elapsed = 0;
  return {
    now: () => elapsed,
    wait: async (milliseconds) => {
      elapsed += milliseconds;
    },
    pollMs: 1_000,
  };
};

const barrierError = { code: "STAGING_AI_CONTROL_BARRIER_FAILED" };

describe("staging control barrier deadlines", () => {
  it("accepts a first frame arriving after the legacy fifteen-second window", async () => {
    const timing = clock();
    const collection = {
      findOne: async () => ({ status: timing.now() >= 20_000 ? "first_frame" : "claimed" }),
    };
    await expect(waitControlStatus(collection, "paced-jti", "first_frame", timing))
      .resolves.toEqual({ status: "first_frame" });
  });

  it("fails closed at sixty seconds when no first frame arrives", async () => {
    const timing = clock();
    await expect(waitControlStatus({ findOne: async () => null }, "paced-jti", "first_frame", timing))
      .rejects.toMatchObject(barrierError);
    expect(timing.now()).toBe(60_000);
  });

  it("retains the fifteen-second deadline for Stop acknowledgement", async () => {
    const timing = clock();
    await expect(waitControlStatus({ findOne: async () => ({ status: "first_frame" }) },
      "stop-jti", "aborted", timing)).rejects.toMatchObject(barrierError);
    expect(timing.now()).toBe(15_000);
  });

  it.each(["aborted", "timed_out", "completed"])("fails immediately for terminal status %s", async (status) => {
    const timing = clock();
    await expect(waitControlStatus({ findOne: async () => ({ status }) }, "paced-jti", "first_frame", timing))
      .rejects.toMatchObject(barrierError);
    expect(timing.now()).toBe(0);
  });

  it("accepts the requested terminal status", async () => {
    await expect(waitControlStatus({ findOne: async () => ({ status: "aborted" }) },
      "stop-jti", "aborted", clock())).resolves.toEqual({ status: "aborted" });
  });
});

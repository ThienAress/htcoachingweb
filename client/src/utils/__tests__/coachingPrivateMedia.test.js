import { describe, expect, it } from "vitest";

import { buildExerciseFeedbackPayload } from "../coachingPrivateMedia";

describe("coaching private media client payload", () => {
  it("never sends an expiring feedback delivery URL back through autosave", () => {
    expect(
      buildExerciseFeedbackPayload({
        _id: "exercise-1",
        completed: true,
        clientFeedbackNote: "Đã hoàn thành",
        clientFeedbackVideo:
          "https://signed.example.test/private-review?expires=300",
      }),
    ).toEqual({
      exerciseId: "exercise-1",
      completed: true,
      clientFeedbackNote: "Đã hoàn thành",
    });
  });
});

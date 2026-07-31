import { describe, expect, it } from "vitest";
import { activityActorLabel } from "../activityTimelinePresentation";

describe("activity timeline presentation", () => {
  it("shows generic actor labels without exposing identity details", () => {
    expect(activityActorLabel("user")).toBe("Bạn");
    expect(activityActorLabel("trainer")).toBe("Huấn luyện viên");
    expect(activityActorLabel("admin")).toBe("Quản trị viên");
    expect(activityActorLabel()).toBe("Hệ thống");
  });
});

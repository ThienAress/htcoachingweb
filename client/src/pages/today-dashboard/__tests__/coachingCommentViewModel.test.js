import { describe, expect, it } from "vitest";
import {
  commentDisplay,
  commentThreadKey,
} from "../coachingCommentViewModel";

it("labels designated admin coach comments as coaching rather than student", () => {
  expect(commentDisplay({ actorRole: "admin", body: "Test", status: "visible" }).authorLabel).toBe("Huấn luyện viên");
});

describe("coachingCommentViewModel", () => {
  it("renders tombstones without retaining removed content", () => {
    expect(
      commentDisplay({
        status: "removed",
        body: "should-not-render",
        actorRole: "trainer",
        isMine: false,
      }),
    ).toEqual({
      body: "Bình luận đã được gỡ",
      authorLabel: "Huấn luyện viên",
      canChange: false,
      removed: true,
    });
  });

  it("marks only visible own comments editable", () => {
    expect(
      commentDisplay({
        status: "visible",
        body: "  Tiến độ tốt  ",
        actorRole: "user",
        isMine: true,
      }),
    ).toMatchObject({
      body: "Tiến độ tốt",
      authorLabel: "Bạn",
      canChange: true,
      removed: false,
    });
  });

  it("scopes query cache by exact contextual target", () => {
    expect(commentThreadKey("weekly_checkin", "abc")).toEqual([
      "coaching-comments",
      "weekly_checkin",
      "abc",
    ]);
  });
});

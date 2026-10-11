import { describe, expect, test } from "vitest";

import {
  SCULPT_ANIMATION_STATES,
  getAdjacentSculptState,
} from "../sculptAnimationStates";

const EXPECTED_STATE_IDS = [
  "idle",
  "anticipation",
  "hammer-swing",
  "impact",
  "shell-crack",
  "shell-breakup",
  "muscle-reveal",
  "debris-expansion",
  "transition-cover",
];

describe("Phase 2 sculpt animation states", () => {
  test("khóa đúng chín trạng thái theo thứ tự trong brief", () => {
    expect(SCULPT_ANIMATION_STATES.map(({ id }) => id)).toEqual(EXPECTED_STATE_IDS);
  });

  test("duyệt vòng qua state đầu và cuối mà không khởi chạy timeline", () => {
    expect({
      previousFromIdle: getAdjacentSculptState("idle", -1).id,
      nextFromCover: getAdjacentSculptState("transition-cover", 1).id,
    }).toEqual({
      previousFromIdle: "transition-cover",
      nextFromCover: "idle",
    });
  });
});

import { describe, expect, test } from "vitest";

import {
  SCULPT_PREVIEW_SEQUENCE,
  SCULPT_PREVIEW_TIMING,
} from "../sculptTransitionMotion";

describe("SCULPT_PREVIEW_TIMING", () => {
  test("khóa mỗi chu kỳ ở 5 giây và lặp vô hạn trong chế độ xem thử", () => {
    expect(SCULPT_PREVIEW_TIMING).toMatchObject({
      cycleSeconds: 5,
      repeat: -1,
    });
  });

  test("orchestrate đủ chín state và giữ impact là nhịp chính tại giây thứ hai", () => {
    expect({
      states: SCULPT_PREVIEW_SEQUENCE.map(({ id }) => id),
      impactAt: SCULPT_PREVIEW_SEQUENCE.find(({ id }) => id === "impact")?.at,
      coverAt: SCULPT_PREVIEW_SEQUENCE.find(
        ({ id }) => id === "transition-cover",
      )?.at,
    }).toEqual({
      states: [
        "idle",
        "anticipation",
        "hammer-swing",
        "impact",
        "shell-crack",
        "shell-breakup",
        "muscle-reveal",
        "debris-expansion",
        "transition-cover",
      ],
      impactAt: 2,
      coverAt: 3.55,
    });
  });
});

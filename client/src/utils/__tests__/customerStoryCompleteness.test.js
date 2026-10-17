import { describe, expect, it } from "vitest";

import {
  isStoryComplete,
  moveCompleteStoriesFirst,
} from "../customerStoryCompleteness";

const complete = (name, extra = {}) => ({
  name,
  beforeImg: ["/before.jpg"],
  afterImg: ["/after.jpg"],
  result: "-8kg",
  duration: "12 tuần",
  ...extra,
});

describe("customer story completeness", () => {
  it("counts a story as complete only with both photos, a result and a duration", () => {
    expect(isStoryComplete(complete("A"))).toBe(true);
    expect(isStoryComplete(complete("A", { beforeImg: "/before.jpg" }))).toBe(true);
    expect(isStoryComplete(complete("A", { afterImg: [] }))).toBe(false);
    expect(isStoryComplete(complete("A", { afterImg: "" }))).toBe(false);
    expect(isStoryComplete(complete("A", { result: "  " }))).toBe(false);
    expect(isStoryComplete(complete("A", { duration: undefined }))).toBe(false);
    expect(isStoryComplete(null)).toBe(false);
  });

  it("puts complete stories first and keeps the original order inside each group", () => {
    const stories = [
      complete("incomplete 1", { afterImg: [] }),
      complete("complete 1"),
      complete("incomplete 2", { result: "" }),
      complete("complete 2"),
    ];

    expect(moveCompleteStoriesFirst(stories).map((story) => story.name)).toEqual([
      "complete 1",
      "complete 2",
      "incomplete 1",
      "incomplete 2",
    ]);
  });

  it("returns an empty list for missing input", () => {
    expect(moveCompleteStoriesFirst(undefined)).toEqual([]);
  });
});

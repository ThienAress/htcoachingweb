import { describe, expect, it } from "vitest";

import { frameGroundedWebAnswer } from "../webAnswerFraming.js";

const BODY = "**Thành tích**\n\nAnh vô địch bốn lần. [Bài A](<https://a.example/x>)";

describe("grounded web answer framing", () => {
  it("answers a 'do you know' question the way a person would", () => {
    const framed = frameGroundedWebAnswer(BODY, "bạn biết LeBron James không bro, thành tích thế nào");
    expect(framed.startsWith("Biết chứ bro! 🔥")).toBe(true);
    expect(framed).toContain(BODY);
  });

  it("only says bro when the user did", () => {
    expect(frameGroundedWebAnswer(BODY, "bạn biết LeBron James không")).toMatch(/^Biết chứ! /u);
    expect(frameGroundedWebAnswer(BODY, "thành tích của LeBron James")).not.toMatch(/bro/u);
    expect(frameGroundedWebAnswer(BODY, "thành tích của LeBron James bro")).toMatch(/bro/u);
  });

  it("adds the coaching close only for training or diet questions", () => {
    const training = frameGroundedWebAnswer(BODY, "LeBron James tập luyện thế nào?");
    expect(training).toContain("**Điều đáng học hỏi**");
    expect(training).toContain("Bạn muốn mình gợi ý lịch tập");
    const achievements = frameGroundedWebAnswer(BODY, "LeBron James đạt danh hiệu gì?");
    expect(achievements).not.toContain("Điều đáng học hỏi");
  });

  it("keeps the facts intact and never invents a link or a number", () => {
    const framed = frameGroundedWebAnswer(BODY, "ăn uống của anh ấy thế nào bro?");
    const added = framed.replace(BODY, "");
    expect(added).not.toMatch(/https?:\/\//u);
    expect(added).not.toMatch(/\d/u);
  });

  it("returns an empty answer unchanged", () => {
    expect(frameGroundedWebAnswer("", "bạn biết X không")).toBe("");
  });
});

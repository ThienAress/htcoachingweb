import { describe, expect, it } from "vitest";

import { buildPublicFigureSearchQuery } from "../publicFigureRegistry.js";
import { buildStandaloneRetrievalQuery, routeAiRequest } from "../requestRouter.js";

const LEBRON_TURN = {
  role: "user",
  content:
    "bạn biết LeBron James không bro, thành tích của anh ấy vang dội như thế nào và anh ấy củng tập luyện rất kỷ luật",
};
const ANSWER_TURN = { role: "assistant", content: "..." };
const NAMELESS_TURN = { role: "user", content: "anh ấy tập luyện cụ thể như thế nào mỗi tuần vậy?" };

const decide = (message, prior) =>
  routeAiRequest(message, { contextualQuery: buildStandaloneRetrievalQuery(message, prior) });

describe("follow-ups about a public figure named earlier", () => {
  it.each([
    ["anh ấy tập luyện cụ thể như thế nào mỗi tuần vậy?"],
    ["còn chế độ ăn uống của anh ấy thì sao bro?"],
    ["so với Cristiano Ronaldo thì ai tập kỷ luật hơn?"],
  ])("carries the figure into %s even after a turn without a name", (message) => {
    const prior = [LEBRON_TURN, ANSWER_TURN, NAMELESS_TURN, ANSWER_TURN];
    const query = buildStandaloneRetrievalQuery(message, prior);
    expect(query).toContain("LeBron James");
    const decision = decide(message, prior);
    expect(decision.webSearchRequired).toBe(true);
    expect(decision.reasonCodes).toContain("public_person_claim");
  });

  it("does not carry a figure that was only named as someone's private record", () => {
    const prior = [
      { role: "user", content: "học viên Hoàng Hải Đăng bị tiểu đường, nên ăn gì?" },
      ANSWER_TURN,
    ];
    expect(buildStandaloneRetrievalQuery("anh ấy tập luyện thế nào?", prior)).toBe(
      "anh ấy tập luyện thế nào?",
    );
  });

  it("leaves unrelated messages and unrelated history alone", () => {
    const message = "tôi nặng 70kg, muốn có thân hình săn chắc thì nên bắt đầu từ đâu?";
    expect(buildStandaloneRetrievalQuery(message, [LEBRON_TURN, ANSWER_TURN])).toBe(message);
    expect(decide(message, [LEBRON_TURN, ANSWER_TURN]).webSearchRequired).toBe(false);
  });

  it("routes a direct training question about a registry figure to the web", () => {
    const decision = decide("LeBron James tập luyện cụ thể như thế nào mỗi tuần?", []);
    expect(decision.webSearchRequired).toBe(true);
  });
});

describe("focused search query for public figures", () => {
  it("uses the canonical name and topic keywords instead of the chat filler", () => {
    expect(
      buildPublicFigureSearchQuery(
        ["LeBron James"],
        "bạn biết LeBron James không bro, thành tích của anh ấy thế nào và anh ấy tập luyện kỷ luật",
      ),
    ).toBe("LeBron James career achievements championships awards training workout routine");
  });

  it("covers diet and two figures, and returns nothing without a topic", () => {
    expect(
      buildPublicFigureSearchQuery(
        ["LeBron James", "Cristiano Ronaldo"],
        "chế độ ăn uống của hai người này ra sao",
      ),
    ).toBe("LeBron James Cristiano Ronaldo diet nutrition meal plan");
    expect(buildPublicFigureSearchQuery(["LeBron James"], "LeBron James là ai?")).toBe("");
    expect(buildPublicFigureSearchQuery([], "thành tích")).toBe("");
  });
});

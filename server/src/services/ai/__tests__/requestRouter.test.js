import { describe, expect, it } from "vitest";

import {
  buildRequestRoutingBlock,
  buildStandaloneRetrievalQuery,
  getAllowedToolNamesForRoute,
  routeAiRequest,
} from "../requestRouter.js";

describe("AI request routing", () => {
  it("keeps stable fitness knowledge on the answer-first path", () => {
    const decision = routeAiRequest("Creatine có tác dụng gì?");

    expect(decision).toMatchObject({
      domain: "fitness",
      evidence: "internal_kb",
      knowledgeBaseEligible: true,
      webSearchRequired: false,
      risk: "low",
    });
    expect(getAllowedToolNamesForRoute(decision)).toEqual([
      "search_exercises",
      "search_blog",
    ]);
    expect(buildRequestRoutingBlock(decision)).toMatch(/KB\/tool là enrichment/);
  });

  it("does not classify a generic planning request as a public person claim", () => {
    const decision = routeAiRequest("Hãy tạo lịch tập tăng cơ 4 ngày mỗi tuần");

    expect(decision).toMatchObject({
      domain: "fitness",
      evidence: "internal_kb",
      webSearchRequired: false,
      risk: "low",
    });
    expect(decision.reasonCodes).not.toContain("public_person_claim");
  });

  it("keeps workout creation away from the flat exercise card tool", () => {
    const decision = routeAiRequest("Hãy tạo lịch tập tăng cơ 4 ngày mỗi tuần");

    expect(decision.reasonCodes).toContain("workout_creation");
    expect(getAllowedToolNamesForRoute(decision)).toEqual([]);
  });

  it("requires a source for a named person's claimed routine", () => {
    const decision = routeAiRequest("Ronaldo thường tập những bài gì?");

    expect(decision).toMatchObject({
      domain: "fitness",
      evidence: "web_required",
      webSearchRequired: true,
      preferredTool: "search_knowledge",
      maxWebSearchCalls: 1,
    });
    expect(getAllowedToolNamesForRoute(decision)).toEqual(["search_knowledge"]);
  });

  it("keeps high-stakes fitness questions away from external retrieval", () => {
    const decision = routeAiRequest("Tôi bị đau đầu gối, nên tập gì?");

    expect(decision).toMatchObject({
      domain: "fitness",
      evidence: "model_prior",
      risk: "high_stakes",
      knowledgeBaseEligible: false,
      webSearchRequired: false,
    });
    expect(getAllowedToolNamesForRoute(decision)).toEqual([]);
  });

  it("does not mistake the Vietnamese food word dầu for pain", () => {
    expect(routeAiRequest("Dầu ô liu có phù hợp trong thực đơn tăng cơ không?")).toMatchObject({
      domain: "fitness",
      risk: "low",
      evidence: "internal_kb",
    });
  });

  it("uses model prior for a stable general question", () => {
    const decision = routeAiRequest("Lisa là ai?");

    expect(decision).toMatchObject({
      domain: "general",
      evidence: "model_prior",
      webSearchRequired: false,
      risk: "low",
    });
  });

  it("keeps short follow-ups bound to the previous user topic", () => {
    const query = buildStandaloneRetrievalQuery("Còn bài nào khác?", [
      { role: "user", content: "Tôi muốn tìm bài tập ngực." },
    ]);

    expect(query).toBe("Tôi muốn tìm bài tập ngực.\nCòn bài nào khác?");
  });
});

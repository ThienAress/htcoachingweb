import { describe, expect, it } from "vitest";
import { resolveAiCapabilities, resolveWebPolicy } from "../capabilityPolicy.js";
import { routeAiRequest } from "../requestRouter.js";

describe("capability and source policy", () => {
  it("distinguishes required, optional and prohibited web without changing canonical actions", () => {
    expect(resolveWebPolicy(routeAiRequest("Cristiano Ronaldo là ai? Hãy trả lời có nguồn cập nhật.")))
      .toBe("web_required");
    expect(resolveWebPolicy(routeAiRequest("Explain gravity"), { optionalEvidenceRequested: true }))
      .toBe("web_optional");
    expect(resolveWebPolicy(routeAiRequest("Explain gravity"))).toBe("no_web");
    for (const query of ["Tôi đau đầu gối khi squat", "Tạo bữa ăn 600 kcal", "Bảng giá HTCOACHING"]) {
      expect(resolveWebPolicy(routeAiRequest(query), { optionalEvidenceRequested: true })).toBe("no_web");
    }
  });

  it("does not mistake Vibi function calling for native search or fall back to Gemini", () => {
    const env = { AI_PROVIDER: "deepseek", DEEPSEEK_ENDPOINT_PROFILE: "vibi",
      DEEPSEEK_MODEL: "deepseek-v4.1-flash", GEMINI_API_KEY: "synthetic" };
    expect(resolveAiCapabilities(env)).toMatchObject({
      chatProvider: "vibi", nativeWebSearch: false, canSearchWeb: false, searchProvider: null,
    });
    expect(resolveAiCapabilities({ ...env, AI_WEB_SEARCH_PROVIDER: "brave", BRAVE_SEARCH_API_KEY: "synthetic" }))
      .toMatchObject({ chatProvider: "vibi", canSearchWeb: true, searchProvider: "brave" });
  });
});

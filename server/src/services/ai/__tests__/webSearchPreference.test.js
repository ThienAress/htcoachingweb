import { describe, expect, it } from "vitest";

import { parseChatRequest } from "../../../utils/aiChat.js";
import {
  WEB_SEARCH_DISABLED_REASON,
  applyWebSearchPreference,
  buildRequestRoutingBlock,
  getAllowedToolNamesForRoute,
  routeAiRequest,
} from "../requestRouter.js";

const TIME_SENSITIVE = "Giá vàng hôm nay bao nhiêu, cho tôi nguồn mới nhất?";

describe("parseChatRequest webSearch", () => {
  it("keeps null when an older client omits the preference", () => {
    expect(parseChatRequest({ message: "Xin chào" }).value.webSearch).toBeNull();
  });

  it.each([true, false])("accepts a boolean preference: %s", (webSearch) => {
    expect(parseChatRequest({ message: "Xin chào", webSearch }).value.webSearch).toBe(webSearch);
  });

  it.each(["true", 1, {}, []])("rejects a non-boolean preference: %j", (webSearch) => {
    expect(parseChatRequest({ message: "Xin chào", webSearch }).error).toBeTruthy();
  });
});

describe("applyWebSearchPreference", () => {
  it("keeps the decision unchanged when search is on or unspecified", () => {
    const decision = routeAiRequest(TIME_SENSITIVE);
    expect(decision.webSearchRequired).toBe(true);
    expect(applyWebSearchPreference(decision, true)).toBe(decision);
    expect(applyWebSearchPreference(decision, null)).toBe(decision);
  });

  it("removes web search while keeping the evidence requirement when search is off", () => {
    const decision = applyWebSearchPreference(routeAiRequest(TIME_SENSITIVE), false);
    expect(decision).toMatchObject({
      evidence: "web_required",
      webSearchRequired: true,
      maxWebSearchCalls: 0,
      preferredTool: null,
    });
    expect(decision.reasonCodes).toContain(WEB_SEARCH_DISABLED_REASON);
    expect(Object.isFrozen(decision)).toBe(true);
    expect(getAllowedToolNamesForRoute(decision)).toEqual([]);
    expect(buildRequestRoutingBlock(decision)).toContain("tắt Tìm kiếm thông minh");
  });

  it("does not touch requests that never needed the web", () => {
    const decision = routeAiRequest("Cách squat đúng?");
    expect(applyWebSearchPreference(decision, false)).toBe(decision);
  });
});

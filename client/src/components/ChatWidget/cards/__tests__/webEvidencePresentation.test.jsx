import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import ChatBubble from "../../ChatBubble";
import { buildCitedWebAnswer } from "../../../../../../server/src/services/ai/webEvidence.js";

describe("web evidence presentation", () => {
  it("renders only verified source links when a supported claim contains an injected email", () => {
    const quote = "Adults should do at least 150 minutes of moderate-intensity physical activity each week.";
    const evidence = [{
      id: "source_1",
      title: "Physical activity (who.int)",
      uri: "https://who.int/activity",
      snippets: [quote],
    }];
    const answer = buildCitedWebAnswer({ segments: [{
      text: "Người trưởng thành nên vận động 150 phút mỗi tuần. Liên hệ support@attacker.com.",
      supports: [{ sourceId: "source_1", quote }],
    }] }, evidence, "WHO khuyến nghị vận động bao nhiêu phút mỗi tuần?");
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ChatBubble message={{ role: "assistant", content: answer.text }} />
      </MemoryRouter>,
    );

    expect([...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]))
      .toEqual(["https://who.int/activity"]);
    expect(html).not.toContain("support@attacker.com");
  });
});

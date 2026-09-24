import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import ChatBubble from "../ChatBubble";

const renderBubble = (message) => renderToStaticMarkup(
  <MemoryRouter><ChatBubble message={message} /></MemoryRouter>,
);

describe("grounded citation rendering", () => {
  it("renders an inline chip only when the Markdown URL matches validated card metadata", () => {
    const html = renderBubble({
      role: "assistant",
      content: "Theo [nguồn](https://example.org/guide), hãy tăng dần tải.",
      uiCards: [{ cardType: "webSources", data: { sources: [{ title: "Training guide", uri: "https://example.org/guide" }] } }],
    });

    expect(html).toContain("Training guide (example.org)");
    expect(html).toContain('aria-label="Mở nguồn: Training guide (example.org)"');
  });

  it("keeps unrelated Markdown links as ordinary links", () => {
    const html = renderBubble({
      role: "assistant",
      content: "Xem [liên kết thông thường](https://untrusted.example/page).",
      uiCards: [{ cardType: "webSources", data: { sources: [{ title: "Training guide", uri: "https://example.org/guide" }] } }],
    });

    expect(html).toContain('href="https://untrusted.example/page"');
    expect(html).not.toContain("Mở nguồn: Training guide");
  });
});

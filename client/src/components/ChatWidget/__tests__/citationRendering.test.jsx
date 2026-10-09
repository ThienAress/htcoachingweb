import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import ChatBubble from "../ChatBubble";

const renderBubble = (message) => renderToStaticMarkup(
  <MemoryRouter><ChatBubble message={message} /></MemoryRouter>,
);

describe("grounded citation rendering", () => {
  it("renders a compact publisher chip only when the Markdown URL matches validated card metadata", () => {
    const html = renderBubble({
      role: "assistant",
      content: "Theo [nguồn](https://example.org/guide), hãy tăng dần tải.",
      uiCards: [{ cardType: "webSources", data: { sources: [{ title: "Training guide", uri: "https://example.org/guide" }] } }],
    });

    expect(html).toContain(">example.org<");
    expect(html).toContain('aria-label="Mở nguồn Training guide từ example.org trong thẻ mới"');
    expect(html).toContain('title="Training guide"');
  });

  it("uses validated redirect provenance for a grounded NIH source", () => {
    const redirectUri = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/source-token";
    const html = renderBubble({
      role: "assistant",
      content: `Theo [nih.gov (vertexaisearch.cloud.google.com)](${redirectUri}).`,
      uiCards: [{ cardType: "webSources", data: { sources: [{
        title: "nih.gov (vertexaisearch.cloud.google.com)",
        uri: redirectUri,
        provenance: {
          kind: "google_grounding_redirect",
          publisherHost: "pmc.ncbi.nlm.nih.gov",
        },
      }] } }],
    });

    expect(html).toContain(">NIH<");
    expect(html).toContain('aria-label="Mở nguồn nih.gov từ NIH trong thẻ mới"');
    expect(html).not.toContain(">vertexaisearch.cloud.google.com<");
    expect(html).not.toContain(">V<");
    expect(html).toContain(`href="${redirectUri}"`);
  });

  it("does not present an untrusted title as the source identity", () => {
    const html = renderBubble({
      role: "assistant",
      content: "Theo [World Health Organization](https://www.evil.example/advice).",
      uiCards: [{ cardType: "webSources", data: { sources: [{
        title: "World Health Organization",
        uri: "https://www.evil.example/advice",
        provenance: {
          kind: "google_grounding_redirect",
          publisherHost: "who.int",
        },
      }] } }],
    });

    expect(html).toContain(">evil.example<");
    expect(html).toContain('title="World Health Organization"');
    expect(html).not.toContain(">World Health Organization<");
  });

  it.each([
    "127.0.0.1",
    "who.123",
    "localhost",
    "publisher.onion",
    "sub.example.org",
    "who.int\\nspoof.example",
  ])("uses the neutral fallback for malformed redirect provenance: %s", (publisherHost) => {
    const redirectUri = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/source_token=";
    const html = renderBubble({
      role: "assistant",
      content: `Theo [Nguồn giả](${redirectUri}).`,
      uiCards: [{ cardType: "webSources", data: { sources: [{
        title: "Spoofed WHO title",
        uri: redirectUri,
        provenance: { kind: "google_grounding_redirect", publisherHost },
      }] } }],
    });

    expect({
      neutralLabel: html.includes(">Nguồn web<"),
      globeAvatar: html.includes("lucide-globe"),
      spoofedPublisher: html.includes(">WHO<"),
    }).toEqual({ neutralLabel: true, globeAvatar: true, spoofedPublisher: false });
  });

  it("does not coerce an object publisherHost into trusted provenance", () => {
    const redirectUri = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/source_token";
    const html = renderBubble({
      role: "assistant",
      content: `Theo [Nguồn giả](${redirectUri}).`,
      uiCards: [{ cardType: "webSources", data: { sources: [{
        title: "Spoofed publisher object",
        uri: redirectUri,
        provenance: {
          kind: "google_grounding_redirect",
          publisherHost: { toString: () => "who.int" },
        },
      }] } }],
    });

    expect({
      neutralLabel: html.includes(">Nguồn web<"),
      spoofedPublisher: html.includes(">WHO<"),
    }).toEqual({ neutralLabel: true, spoofedPublisher: false });
  });

  it("does not repeat the sources card when every validated source is already cited inline", () => {
    const html = renderBubble({
      role: "assistant",
      content: "Theo [nghiên cứu](https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance), hãy tăng dần tải.",
      uiCards: [{ cardType: "webSources", data: { sources: [{ title: "Exercise and Athletic Performance", uri: "https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance" }] } }],
    });

    expect(html).toContain(">NIH ODS<");
    expect(html).not.toContain("Nguồn tham khảo");
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

  it.each([
    "Xem [liên kết khác](https://example.org/guide-extra).",
    "URL chỉ là ví dụ: `https://example.org/guide`.",
    "Ví dụ code: `[nguồn](https://example.org/guide)`.",
    "```markdown\n[nguồn](https://example.org/guide)\n```",
    "```markdown\n[nguồn](https://example.org/guide)",
    "~~~\n[nguồn](https://example.org/guide)",
    "\\[nguồn](https://example.org/guide)",
    "<!-- [nguồn](https://example.org/guide) -->",
    "![minh họa](https://example.org/guide)",
  ])("keeps validated sources visible when the URI is not a rendered exact citation: %s", (content) => {
    const html = renderBubble({ role: "assistant", content,
      uiCards: [{ cardType: "webSources", data: { sources: [{ title: "Training guide", uri: "https://example.org/guide" }] } }],
    });
    expect(html).toContain("Nguồn tham khảo");
    expect(html).toContain('href="https://example.org/guide"');
  });
});

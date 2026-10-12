import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import ChatBubble from "../ChatBubble";
import { getSafeWebImages } from "../webImages";

const image = (overrides = {}) => ({
  src: "https://imgs.search.brave.com/abc/rs:fit:500:0:0/g:ce/aHR0cHM",
  pageUrl: "https://www.nba.com/news/lebron-james",
  title: "LeBron James with the trophy",
  ...overrides,
});
const card = (images) => ({
  cardType: "webSources",
  data: { sources: [{ title: "Bài A", uri: "https://a.example/x" }], images },
});

describe("web answer thumbnails", () => {
  it("keeps only proxied https thumbnails linking to an https page, at most three", () => {
    const safe = getSafeWebImages([
      card([
        image(),
        image({ src: "https://imgs.search.brave.com/def", pageUrl: "https://espn.com/lebron" }),
        image({ src: "https://cdn.publisher.example/x.jpg" }),
        image({ src: "http://imgs.search.brave.com/ghi" }),
        image({ src: "https://imgs.search.brave.com/jkl", pageUrl: "javascript:alert(1)" }),
        image({ src: "https://imgs.search.brave.com/mno", pageUrl: "https://b.example/1" }),
        image({ src: "https://imgs.search.brave.com/pqr", pageUrl: "https://c.example/2" }),
      ]),
    ]);
    expect(safe).toHaveLength(3);
    expect(safe.every((item) => new URL(item.src).hostname === "imgs.search.brave.com")).toBe(true);
    expect(safe[0].host).toBe("nba.com");
  });

  it("renders a labelled strip above the answer and nothing without images", () => {
    const withImages = renderToStaticMarkup(
      <MemoryRouter>
        <ChatBubble message={{ role: "assistant", content: "Biết chứ! 🔥", uiCards: [card([image()])] }} />
      </MemoryRouter>,
    );
    expect(withImages).toContain('src="https://imgs.search.brave.com/abc/rs:fit:500:0:0/g:ce/aHR0cHM"');
    expect(withImages).toContain('href="https://www.nba.com/news/lebron-james"');
    expect(withImages).toContain(">nba.com<");
    expect(withImages.toLowerCase()).toContain("no-referrer");
    const without = renderToStaticMarkup(
      <MemoryRouter>
        <ChatBubble message={{ role: "assistant", content: "Biết chứ!", uiCards: [card([])] }} />
      </MemoryRouter>,
    );
    expect(without).not.toContain("imgs.search.brave.com");
  });
});

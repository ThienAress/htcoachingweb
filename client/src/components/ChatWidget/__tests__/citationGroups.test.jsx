import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import ChatBubble from "../ChatBubble";
import { splitTrailingCitations } from "../citationGroups";

const sources = {
  "https://a.example/x": { uri: "https://a.example/x", title: "Bài A", publisher: "a.example" },
  "https://b.example/y": { uri: "https://b.example/y", title: "Bài B", publisher: "b.example" },
};
const resolve = (href) => sources[href] || null;
const link = (href) => createElement("a", { key: href, href }, "x");

const renderBubble = (message) => renderToStaticMarkup(
  <MemoryRouter><ChatBubble message={message} /></MemoryRouter>,
);

describe("splitTrailingCitations", () => {
  it("groups two or more trailing source links and keeps the text", () => {
    const result = splitTrailingCitations(
      ["Một câu. ", link("https://a.example/x"), " ", link("https://b.example/y")],
      resolve,
    );
    expect(result.sources.map((source) => source.publisher)).toEqual(["a.example", "b.example"]);
    expect(result.lead).toHaveLength(1);
  });

  it("leaves a single source and unknown links alone", () => {
    expect(splitTrailingCitations(["Câu. ", link("https://a.example/x")], resolve)).toBeNull();
    expect(
      splitTrailingCitations(["Câu. ", link("https://x.example/1"), link("https://x.example/2")], resolve),
    ).toBeNull();
  });

  it("does not group sources that appear in the middle of a paragraph", () => {
    expect(
      splitTrailingCitations(
        [link("https://a.example/x"), link("https://b.example/y"), " còn lại"],
        resolve,
      ),
    ).toBeNull();
  });
});

describe("grouped sources in a chat answer", () => {
  const uiCards = [{ cardType: "webSources", data: { sources: [
    { title: "Bài A", uri: "https://a.example/x" },
    { title: "Bài B", uri: "https://b.example/y" },
    { title: "Bài C", uri: "https://c.example/z" },
  ] } }];

  it("shows one grouped control for the sources that end a paragraph", () => {
    const html = renderBubble({
      role: "assistant",
      content: "**Thành tích**\n\nAnh vô địch bốn lần. [Bài A](<https://a.example/x>) [Bài B](<https://b.example/y>) [Bài C](<https://c.example/z>)",
      uiCards,
    });
    expect(html).toContain('aria-label="Xem 3 nguồn"');
    expect(html).toContain("+2");
    expect(html).not.toContain("Mở nguồn Bài A");
  });

  it("keeps a lone source as a normal chip", () => {
    const html = renderBubble({
      role: "assistant",
      content: "Anh vô địch bốn lần. [Bài A](<https://a.example/x>)",
      uiCards,
    });
    expect(html).toContain("Mở nguồn Bài A");
    expect(html).not.toContain("Xem 1 nguồn");
  });
});

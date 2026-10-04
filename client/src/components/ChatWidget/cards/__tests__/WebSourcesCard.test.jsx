import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import WebSourcesCard from "../WebSourcesCard";

const renderCard = (data) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <WebSourcesCard data={data} />
    </MemoryRouter>,
  );

describe("WebSourcesCard", () => {
  it("chỉ render nguồn HTTPS hợp lệ và loại URL trùng lặp", () => {
    const html = renderCard({
      topic: "Creatine monohydrate",
      searchedAt: "2026-09-20T03:42:00.000Z",
      sources: [
        {
          title: "NIH Office of Dietary Supplements (ods.od.nih.gov)",
          uri: "https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance",
        },
        {
          title: "Nguồn trùng",
          uri: "https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance",
        },
        { title: "Không an toàn", uri: "javascript:alert(document.domain)" },
        {
          title: "Có credential",
          uri: "https://user:password@example.com/private",
        },
      ],
    });

    expect(html.match(/<li/g)).toHaveLength(1);
    expect(html).toContain("NIH Office of Dietary Supplements");
    expect(html).not.toContain("Nguồn trùng");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("password");
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("không render card khi không có nguồn hợp lệ", () => {
    expect(
      renderCard({
        sources: [{ title: "Không an toàn", uri: "http://example.com" }],
      }),
    ).toBe("");
  });

  it("dùng fallback trung tính cho redirect legacy chưa có provenance", () => {
    const redirectUri = "https://vertexaisearch.cloud.google.com/grounding/redirect?source=cdc";
    const html = renderCard({
      sources: [{
        title: "CDC — Creatine guidance (vertexaisearch.cloud.google.com)",
        uri: redirectUri,
      }],
    });

    expect(html).toContain("CDC — Creatine guidance");
    expect(html).toContain(">Nguồn web</p>");
    expect(html).toContain("lucide-globe");
    expect(html).toContain(`href="${redirectUri}"`);
  });

  it("keeps the actual host beside a spoofable publisher name", () => {
    const html = renderCard({
      sources: [{ title: "World Health Organization", uri: "https://evil.example/advice" }],
    });

    expect(html).toContain(">evil.example</p>");
    expect(html).toContain('title="World Health Organization"');
  });

  it("uses an honest round monogram avatar without fetching a remote favicon", () => {
    const html = renderCard({
      sources: [{ title: "Exercise guidance", uri: "https://www.who.int/news-room/fact-sheets/detail/physical-activity" }],
    });

    expect(html).toContain('aria-label="WHO"');
    expect(html).toContain(">W<");
    expect(html).not.toContain("favicon");
  });

  it("does not use a legacy transport hostname as publisher identity", () => {
    const html = renderCard({
      sources: [{
        title: "vertexaisearch.cloud.google.com",
        uri: "https://vertexaisearch.cloud.google.com/grounding/redirect?target=cdc",
      }],
    });

    expect(html).toContain('aria-label="Nguồn web"');
    expect(html).toContain(">Nguồn web</p>");
    expect(html).toContain('title="vertexaisearch.cloud.google.com"');
  });

  it("deduplicates fragmented URI copies while retaining separate articles from one publisher", () => {
    const html = renderCard({
      sources: [
        { title: "BMJ first article", uri: "https://www.bmj.com/article-a#abstract" },
        { title: "BMJ duplicate fragment", uri: "https://www.bmj.com/article-a#methods" },
        { title: "BMJ second article", uri: "https://www.bmj.com/article-b#summary" },
      ],
    });

    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain("BMJ first article");
    expect(html).toContain("BMJ second article");
    expect(html).not.toContain("BMJ duplicate fragment");
    expect(html.match(/>BMJ<\/p>/g)).toHaveLength(2);
  });
});

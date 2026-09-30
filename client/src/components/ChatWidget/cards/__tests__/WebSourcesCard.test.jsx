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

  it("giữ href redirect legacy nhưng không lộ hostname điều hướng trong nhãn", () => {
    const html = renderCard({
      sources: [{
        title: "CDC — Creatine guidance (vertexaisearch.cloud.google.com)",
        uri: "https://vertexaisearch.cloud.google.com/grounding/redirect?target=cdc",
      }],
    });

    expect(html).toContain("CDC — Creatine guidance");
    expect(html.replace(/href="[^"]+"/g, "")).not.toContain("vertexaisearch.cloud.google.com");
    expect(html).toContain('href="https://vertexaisearch.cloud.google.com/grounding/redirect?target=cdc"');
  });

  it("keeps the actual host beside a spoofable publisher name", () => {
    const html = renderCard({
      sources: [{ title: "World Health Organization", uri: "https://evil.example/advice" }],
    });

    expect(html).toContain("World Health Organization (evil.example)");
  });

  it("uses a neutral label when a legacy redirect only supplies its transport hostname", () => {
    const html = renderCard({
      sources: [{
        title: "vertexaisearch.cloud.google.com",
        uri: "https://vertexaisearch.cloud.google.com/grounding/redirect?target=cdc",
      }],
    });

    expect(html).toContain(">Nguồn<");
    expect(html.replace(/href="[^"]+"/g, "")).not.toContain("vertexaisearch.cloud.google.com");
  });
});

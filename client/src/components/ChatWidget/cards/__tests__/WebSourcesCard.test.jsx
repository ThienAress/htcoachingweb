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
});

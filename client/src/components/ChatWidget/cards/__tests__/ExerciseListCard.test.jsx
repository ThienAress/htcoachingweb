import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import ExerciseListCard from "../ExerciseListCard";

describe("ExerciseListCard", () => {
  it("nói rõ khi catalog chỉ trả được một phần số bài user yêu cầu", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ExerciseListCard
          data={{
            searchedFor: "ngực cho người mới",
            requestedCount: 5,
            resultCount: 1,
            catalogInsufficient: true,
            exercises: [
              {
                name: "Incline Push Up",
                description: "Chống đẩy dốc cho người mới.",
                muscleGroup: "Cơ ngực",
              },
            ],
          }}
        />
      </MemoryRouter>,
    );

    expect(html).toContain("Hiện tìm thấy 1/5 bài phù hợp");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("đã đủ 5 bài");
  });

  it("phân biệt giới hạn quét với catalog thực sự thiếu dữ liệu", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ExerciseListCard
          data={{
            searchedFor: "ngực không dụng cụ",
            requestedCount: 5,
            resultCount: 1,
            catalogInsufficient: false,
            scanIncomplete: true,
            exercises: [{
              name: "Push Up",
              description: "Chống đẩy trên sàn.",
              muscleGroup: "Cơ ngực",
            }],
          }}
        />
      </MemoryRouter>,
    );

    expect(html).toContain("chưa quét hết thư viện");
    expect(html).not.toContain("Hiện tìm thấy 1/5 bài phù hợp");
    expect(html).toContain('role="status"');
  });
});

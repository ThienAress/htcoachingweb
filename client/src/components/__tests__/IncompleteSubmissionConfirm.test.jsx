import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { IncompleteSubmissionConfirm } from "../IncompleteSubmissionConfirm";

describe("IncompleteSubmissionConfirm", () => {
  it("names every empty field and still offers an explicit send action", () => {
    const html = renderToStaticMarkup(
      <IncompleteSubmissionConfirm
        missingFields={["Năng lượng", "Mức đau"]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain("Còn 2 mục bạn chưa điền");
    expect(html).toContain("Năng lượng");
    expect(html).toContain("Mức đau");
    expect(html).toContain("Tiếp tục điền");
    expect(html).toContain("Vẫn gửi");
  });
});

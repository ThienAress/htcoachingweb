import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WellnessFields } from "../WellnessFields";

const renderFields = () =>
  renderToStaticMarkup(
    <WellnessFields
      register={(name) => ({ name })}
      errors={{}}
      disabled={false}
      painValue={0}
    />,
  );

describe("WellnessFields", () => {
  it("shows semantic choices without exposing the numeric scale", () => {
    const html = renderFields();

    expect(html).toContain("Cạn kiệt");
    expect(html).toContain("Bình thường");
    expect(html).toContain("Rất sung sức");
    expect(html).not.toContain("/10");
  });

  it("renders the pain-free choice with representative value zero", () => {
    const html = renderFields();

    expect(html).toContain('name="pain"');
    expect(html).toContain('value="0"');
    expect(html).toContain("Không đau");
  });

  it("uses one shared instruction for the five unselected feeling fields", () => {
    const html = renderFields();

    expect((html.match(/>Chưa chọn</g) || [])).toHaveLength(5);
    expect(
      (html.match(/Chọn mô tả gần nhất với cảm nhận của bạn\./g) || []),
    ).toHaveLength(1);
  });
});

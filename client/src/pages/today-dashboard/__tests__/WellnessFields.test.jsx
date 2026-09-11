import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WellnessFields } from "../WellnessFields";

const renderFields = (props = {}) =>
  renderToStaticMarkup(
    <WellnessFields
      register={(name) => ({ name })}
      errors={{}}
      disabled={false}
      painValue={0}
      {...props}
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

  it("only shows the note shared with the trainer", () => {
    const html = renderFields();

    expect(html).not.toContain("Ghi chú riêng");
    expect(html).not.toContain('name="privateNote"');
    expect(html).toContain("Chia sẻ với HLV");
    expect((html.match(/<textarea/g) || [])).toHaveLength(1);
  });

  it("removes trainer sharing from the self-managed form", () => {
    const html = renderFields({ selfManaged: true, painValue: 10 });

    expect(html).not.toMatch(/HLV|Chia sẻ với/);
    expect(html).toContain("liên hệ chuyên gia y tế phù hợp");
    expect(html).not.toContain('<textarea');
  });
});

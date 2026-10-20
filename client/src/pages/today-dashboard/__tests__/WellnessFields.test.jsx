import { renderToStaticMarkup } from "react-dom/server";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { WellnessFields } from "../WellnessFields";
import { WELLNESS_SEMANTIC_OPTIONS } from "../wellness";

const Harness = ({ defaults = {}, ...props }) => {
  const { register, control } = useForm({
    defaultValues: { energy: "", hunger: "", stress: "", soreness: "", pain: 0, ...defaults },
  });
  return (
    <WellnessFields
      register={register}
      control={control}
      errors={{}}
      disabled={false}
      painValue={0}
      {...props}
    />
  );
};

const renderFields = (props = {}) => renderToStaticMarkup(<Harness {...props} />);

const labels = (name) => WELLNESS_SEMANTIC_OPTIONS[name].map((option) => option.label);

describe("WellnessFields", () => {
  it("offers semantic choices without exposing the numeric scale", () => {
    const energy = WELLNESS_SEMANTIC_OPTIONS.energy;
    expect(labels("energy")).toEqual(expect.arrayContaining(["Cạn kiệt", "Bình thường", "Rất sung sức"]));

    // Ô chọn bo góc đóng: chỉ hiện nhãn mô tả của lựa chọn đang chọn, không hiện thang số.
    const html = renderFields({ defaults: { energy: energy[0].value } });
    expect(html).toContain("Cạn kiệt");
    expect(html).not.toContain("/10");
  });

  it("renders the pain-free choice with representative value zero", () => {
    const painFree = WELLNESS_SEMANTIC_OPTIONS.pain.find((option) => option.value === 0);

    expect(painFree.label).toBe("Không đau");
    expect(renderFields()).toContain("Không đau");
  });

  it("uses one shared instruction for the four unselected feeling fields", () => {
    const html = renderFields();

    expect((html.match(/>Chưa chọn</g) || [])).toHaveLength(4);
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

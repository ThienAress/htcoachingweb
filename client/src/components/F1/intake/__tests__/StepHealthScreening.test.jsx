import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import StepHealthScreening from "../StepHealthScreening";

const renderStep = (values) =>
  renderToStaticMarkup(
    <StepHealthScreening
      register={(name) => ({ name })}
      watch={(name) => values[name.replace("healthScreening.", "")]}
      setValue={vi.fn()}
      errors={{}}
    />,
  );

describe("StepHealthScreening toggles", () => {
  it("exposes every toggle as an accessible switch that starts off", () => {
    const markup = renderStep({ hasPainNow: false, warningSigns: [] });

    expect(markup.match(/role="switch"/g)).toHaveLength(6);
    expect(markup.match(/aria-checked="false"/g)).toHaveLength(6);
    expect(markup).not.toContain("<textarea");
  });

  it("opens the sections that already have draft text", () => {
    const markup = renderStep({
      hasPainNow: false,
      injuries: "Trật vai cũ",
      medications: "  ",
      warningSigns: [],
    });

    expect(markup).toContain(
      'aria-checked="true" aria-label="Có chấn thương cần lưu ý không?"',
    );
    expect(markup).toContain('name="healthScreening.injuries"');
    expect(markup).not.toContain('name="healthScreening.medications"');
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SelectField from "../SelectField";
import { parseSelectOptions } from "../selectOptions";

describe("parseSelectOptions", () => {
  it("reads options written inline, from a map and inside a fragment", () => {
    const children = [
      <option key="all" value="">Tất cả</option>,
      ...["Quận 1", "Quận 7"].map((name) => (
        <option key={name} value={name}>{name}</option>
      )),
      <>
        <option key="x" value="x" disabled>Khoá</option>
      </>,
    ];

    expect(parseSelectOptions(children)).toEqual([
      { value: "", label: "Tất cả", disabled: false },
      { value: "Quận 1", label: "Quận 1", disabled: false },
      { value: "Quận 7", label: "Quận 7", disabled: false },
      { value: "x", label: "Khoá", disabled: true },
    ]);
  });

  it("falls back to the option text when no value is given and stringifies numbers", () => {
    const options = parseSelectOptions([
      <option key="a">Cao</option>,
      <option key="b" value={12}>12 tuần</option>,
    ]);

    expect(options.map((item) => item.value)).toEqual(["Cao", "12"]);
  });
});

describe("SelectField", () => {
  const render = (props) =>
    renderToStaticMarkup(
      <SelectField aria-label="Khu vực" {...props}>
        <option value="">Tất cả khu vực</option>
        <option value="q7">Quận 7</option>
      </SelectField>,
    );

  it("shows the label of the selected option as a combobox instead of a native select", () => {
    const html = render({ value: "q7" });

    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Khu vực"');
    expect(html).toContain("Quận 7");
    expect(html).not.toContain("<select");
  });

  it("accepts a number as the value like a native select does", () => {
    const html = renderToStaticMarkup(
      <SelectField aria-label="Số tuần" value={12}>
        <option value="8">8 tuần</option>
        <option value="12">12 tuần</option>
      </SelectField>,
    );

    expect(html).toContain("12 tuần");
  });

  it("keeps native required validation through a hidden field", () => {
    expect(render({ value: "", required: true })).toContain("required");
    expect(render({ value: "q7" })).not.toContain("required");
  });
});

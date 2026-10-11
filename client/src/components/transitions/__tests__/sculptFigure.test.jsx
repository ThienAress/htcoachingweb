import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import SculptFigure from "../SculptFigure";

describe("SculptFigure visual contract", () => {
  test("dùng asset raster đã duyệt thay cho nhân vật SVG đơn giản", () => {
    const markup = renderToStaticMarkup(<SculptFigure />);

    expect({
      approvedAsset: markup.includes('data-sculpt-source="approved-reference"'),
      responsiveImage: markup.includes("object-cover"),
      decorative: markup.includes('aria-hidden="true"'),
      noInlineSvg: !markup.includes("<svg"),
    }).toEqual({
      approvedAsset: true,
      responsiveImage: true,
      decorative: true,
      noInlineSvg: true,
    });
  });
});

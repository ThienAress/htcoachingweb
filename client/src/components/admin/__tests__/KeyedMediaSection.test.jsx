import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  HOME_CLASS_CATALOG,
  HOME_TOOL_CATALOG,
} from "../../../config/homeSectionCatalog";
import KeyedMediaSection from "../KeyedMediaSection";

const renderSection = (catalog, imagesByKey = {}) => renderToStaticMarkup(
  <KeyedMediaSection
    title="Test media"
    description="Test description"
    catalog={catalog}
    imagesByKey={imagesByKey}
    onUpload={vi.fn()}
    onRemove={vi.fn()}
    onPreview={vi.fn()}
  />,
);

const renderClosedSection = () => renderToStaticMarkup(
  <KeyedMediaSection
    title="Closed media"
    description="Closed description"
    catalog={HOME_CLASS_CATALOG}
    imagesByKey={{}}
    onUpload={vi.fn()}
    onRemove={vi.fn()}
    onPreview={vi.fn()}
    defaultOpen={false}
  />,
);

describe("KeyedMediaSection", () => {
  it("renders one labeled upload input for every class catalog item", () => {
    const html = renderSection(HOME_CLASS_CATALOG);

    expect({
      inputs: (html.match(/type="file"/g) || []).length,
      labels: HOME_CLASS_CATALOG.every((item) => (
        html.includes(item.adminLabel.replaceAll("&", "&amp;"))
      )),
    }).toEqual({ inputs: HOME_CLASS_CATALOG.length, labels: true });
  });

  it("renders all current tools including Meal Scan", () => {
    const html = renderSection(HOME_TOOL_CATALOG);

    expect({
      inputs: (html.match(/type="file"/g) || []).length,
      mealScan: html.includes("Quét món ăn AI"),
    }).toEqual({ inputs: HOME_TOOL_CATALOG.length, mealScan: true });
  });

  it("marks a keyed override as customizable and removable", () => {
    const html = renderSection(HOME_CLASS_CATALOG, {
      boxing: "boxing-upload.webp",
    });

    expect(html).toContain("Xóa ảnh riêng");
  });

  it("exposes accordion state and keeps a closed section compact", () => {
    const html = renderClosedSection();

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("hidden=\"\"");
  });
});

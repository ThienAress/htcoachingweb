import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BodySilhouette } from "../BodySilhouette";

describe("five-region selection", () => {
  it("starts neutral without an active region", () => {
    const html = renderToStaticMarkup(<BodySilhouette onSelect={() => {}} label="Sơ đồ" />);
    expect((html.match(/aria-pressed="false"/g) || [])).toHaveLength(5);
    expect(html).not.toContain('aria-pressed="true"');
    expect((html.match(/class="fill-slate-400 stroke/g) || [])).toHaveLength(5);
  });
  it("exposes five labelled selectable regions and preserves selected region", () => {
    const html = renderToStaticMarkup(<BodySilhouette selectedRegion="leftArm" onSelect={() => {}} label="Sơ đồ" />);
    expect((html.match(/data-body-region=/g) || [])).toHaveLength(5);
    expect((html.match(/aria-pressed="true"/g) || [])).toHaveLength(1);
    expect(html).toMatch(/data-body-region="leftArm"[^>]+aria-pressed="true"[^>]+fill-blue-400/);
    expect(html).toContain("hover:fill-emerald-400");
    expect(html).toContain("motion-reduce:transition-none");
  });
});

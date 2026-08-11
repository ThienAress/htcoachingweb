import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("ChatWidget motion contract", () => {
  it("does not use transition-all in the ChatWidget pilot", () => {
    const sources = [
      "../ChatPanel.jsx",
      "../ChatWidget.jsx",
      "../ChatBubble.jsx",
      "../cards/TdeeFormCard.jsx",
    ].map(read);

    for (const source of sources) expect(source).not.toMatch(/transition-all/);
  });

  it("disables recurring/entrance motion and pointer hover for reduced capability", () => {
    const css = read("../../../App.css");

    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/\.chat-card-enter[\s\S]*animation:\s*none/);
    expect(css).toMatch(/\.thinking-dot[\s\S]*animation:\s*none/);
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
  });

  it("keeps the launcher keyboard-visible and the closed dialog inert", () => {
    const panel = read("../ChatPanel.jsx");

    expect(panel).toContain('role={pillExpanded ? "group" : "button"}');
    expect(panel).toContain('tabIndex={pillExpanded ? -1 : 0}');
    expect(panel).toContain("focus-visible:ring-2");
    expect(panel).toContain("aria-hidden={!isOpen}");
    expect(panel).toContain("inert={!isOpen}");
    expect(panel).toContain("size-11");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../AiMemorySettings.jsx", import.meta.url),
  "utf8",
);

describe("AI Memory settings accessibility contract", () => {
  it("owns focus while open and restores it when the modal closes", () => {
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("closeButtonRef.current?.focus()");
    expect(source).toContain('document.addEventListener("keydown", handleKeyDown, true)');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain("previousFocus.focus()");
  });
});

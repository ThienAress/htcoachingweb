import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import decodeHashTarget from "../../utils/decodeHashTarget";

const source = readFileSync(
  new URL("../ScrollRestoration.jsx", import.meta.url),
  "utf8",
);

describe("ScrollRestoration hash contract", () => {
  it("decodes valid anchors and rejects malformed percent encoding safely", () => {
    expect(decodeHashTarget("#pricing%20plans")).toBe("pricing plans");
    expect(decodeHashTarget("#%")).toBeNull();
    expect(decodeHashTarget("#%E0%A4%A")).toBeNull();
  });

  it("waits for lazy content and smooth-scrolls to the hash with reduced-motion support", () => {
    expect(source).toContain("document.getElementById(targetId)");
    expect(source).toContain("attempts < 60");
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain('behavior: reduceMotion ? "auto" : "smooth"');
  });
});

import { describe, expect, it } from "vitest";

import { createNoindexFallbackShell } from "../prerender-shell.js";

describe("prerender noindex fallback shell", () => {
  it("adds one fail-closed robots tag without a canonical", () => {
    const html = createNoindexFallbackShell(
      "<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>",
    );

    expect(html.match(/name="robots"/g)).toHaveLength(1);
    expect(html).toContain('content="noindex,follow"');
    expect(html).not.toMatch(/rel=["']canonical["']/i);
  });

  it("rejects an unsafe or already annotated app shell", () => {
    expect(() => createNoindexFallbackShell("<html></html>")).toThrow(
      /closing head/i,
    );
    expect(() =>
      createNoindexFallbackShell(
        '<html><head><meta name="robots" content="index,follow"></head></html>',
      ),
    ).toThrow(/already contains/i);
  });
});

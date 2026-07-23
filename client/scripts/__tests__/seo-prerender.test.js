import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

import { validatePrerenderSnapshot } from "../prerender-validation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appShell = fs.readFileSync(
  path.resolve(__dirname, "../../index.html"),
  "utf8",
);

describe("SEO app shell", () => {
  it("does not hard-code route-specific metadata before React renders", () => {
    expect(appShell).not.toMatch(/<title[\s>]/i);
    expect(appShell).not.toMatch(/<link[^>]+rel=["']canonical["']/i);
    expect(appShell).not.toMatch(/<meta[^>]+name=["']description["']/i);
    expect(appShell).not.toMatch(/<meta[^>]+name=["']robots["']/i);
    expect(appShell).not.toMatch(/<meta[^>]+property=["']og:/i);
    expect(appShell).not.toMatch(/<meta[^>]+name=["']twitter:/i);
  });
});

describe("prerender SEO validation", () => {
  const validSnapshot = {
    rootLength: 500,
    titles: ["Bài viết | HTCOACHING"],
    descriptions: ["Mô tả duy nhất"],
    canonicals: ["https://htcoachingweb.io.vn/blog/bai-viet"],
    robots: ["index,follow"],
  };

  it("accepts a rendered route with one self-referencing canonical", () => {
    expect(
      validatePrerenderSnapshot(
        validSnapshot,
        "https://htcoachingweb.io.vn/blog/bai-viet",
      ),
    ).toEqual([]);
  });

  it("rejects the duplicate homepage canonical regression", () => {
    expect(
      validatePrerenderSnapshot(
        {
          ...validSnapshot,
          titles: ["Bài viết | HTCOACHING", "HTCOACHING"],
          canonicals: [
            "https://htcoachingweb.io.vn/",
            "https://htcoachingweb.io.vn/blog/bai-viet",
          ],
        },
        "https://htcoachingweb.io.vn/blog/bai-viet",
      ),
    ).toEqual(
      expect.arrayContaining([
        "expected one non-empty title, received 2",
        "expected one canonical, received 2",
      ]),
    );
  });

  it("rejects empty or incorrectly canonicalized output", () => {
    expect(
      validatePrerenderSnapshot(
        {
          ...validSnapshot,
          rootLength: 0,
          canonicals: ["https://htcoachingweb.io.vn/"],
        },
        "https://htcoachingweb.io.vn/blog/bai-viet",
      ),
    ).toEqual(
      expect.arrayContaining([
        "rendered root is empty",
        expect.stringMatching(/^canonical mismatch:/),
      ]),
    );
  });
});

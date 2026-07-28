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

  it("rejects homepage JSON-LD when trainer plan offers are missing", () => {
    expect(
      validatePrerenderSnapshot(
        {
          ...validSnapshot,
          canonicals: ["https://htcoachingweb.io.vn/"],
          structuredData: [
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Service",
                  name: "HTCOACHING trainer platform",
                },
              ],
            },
          ],
        },
        "https://htcoachingweb.io.vn/",
        {
          expectedServiceOffers: [
            { price: 0, priceCurrency: "VND" },
            { price: 200000, priceCurrency: "VND" },
          ],
        },
      ),
    ).toContain("expected 2 Service offers in JSON-LD, received 0");
  });

  it("rejects homepage JSON-LD when an offer amount drifts", () => {
    expect(
      validatePrerenderSnapshot(
        {
          ...validSnapshot,
          canonicals: ["https://htcoachingweb.io.vn/"],
          structuredData: [
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Service",
                  name: "HTCOACHING trainer platform",
                  offers: [
                    { "@type": "Offer", price: 0, priceCurrency: "VND" },
                    {
                      "@type": "Offer",
                      price: 5,
                      priceCurrency: "VND",
                    },
                  ],
                },
              ],
            },
          ],
        },
        "https://htcoachingweb.io.vn/",
        {
          expectedServiceOffers: [
            { price: 0, priceCurrency: "VND" },
            { price: 200000, priceCurrency: "VND" },
          ],
        },
      ),
    ).toContain("Service offer prices or currencies do not match the catalog");
  });
});

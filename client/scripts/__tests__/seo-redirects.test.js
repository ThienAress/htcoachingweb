import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, test } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const redirects = fs.readFileSync(
  path.resolve(__dirname, "../../public/_redirects"),
  "utf8",
);

describe("public SEO redirects", () => {
  test("redirects the retired customer-story typo before the final 404", () => {
    const typoRedirects = [
      "/ket-qua-khach-hang/le-thanh-phan-1-thang /ket-qua-khach-hang/le-thanh-nhan-1-thang/ 301",
      "/ket-qua-khach-hang/le-thanh-phan-1-thang/ /ket-qua-khach-hang/le-thanh-nhan-1-thang/ 301",
    ];

    typoRedirects.forEach((typoRedirect) => {
      expect(redirects).toContain(typoRedirect);
      expect(redirects.indexOf(typoRedirect)).toBeLessThan(
        redirects.indexOf("/* /404.html 404"),
      );
    });
  });

  test("allows only known app routes to use the SPA shell", () => {
    expect(redirects.split(/\r?\n/)).not.toContain("/* /index.html 200");
    expect(redirects).not.toContain("/admin/* /index.html 200");
    expect(redirects).toContain(
      "/admin/service-access-policies /index.html 200",
    );
    expect(redirects).toContain("/dashboard/today/* /index.html 200");
    expect(redirects).toContain(
      "/cong-thuc-nau-an/* /dynamic-detail-shell.html 200",
    );
    expect(redirects).toContain(
      "/exercises/* /dynamic-detail-shell.html 200",
    );
    expect(redirects.trim().endsWith("/* /404.html 404")).toBe(true);
  });

  test("lets every fixed admin and trainer page open directly or after a refresh", () => {
    const lines = redirects.split(/\r?\n/);
    const app = fs.readFileSync(path.join(__dirname, "../../src/App.jsx"), "utf8");
    const section = (start, end) => {
      const from = app.indexOf(start);
      return app.slice(from, app.indexOf(end, from));
    };
    const fixedPaths = (block, prefix) =>
      [...block.matchAll(/<Route path="([a-z0-9-]+)" element/g)].map((m) => `${prefix}/${m[1]}`);

    const adminPages = fixedPaths(section("{/* ADMIN PANEL */}", "</Routes>"), "/admin");
    const trainerPages = fixedPaths(section("path=\"/trainer\"", "{/* ADMIN PANEL */}"), "/trainer");

    expect(adminPages.length).toBeGreaterThan(15);
    expect(trainerPages.length).toBeGreaterThan(5);
    for (const page of [...adminPages, ...trainerPages]) {
      expect(lines, `${page} is missing from _redirects`).toContain(`${page} /index.html 200`);
    }
  });

  test("keeps non-cohort dynamic detail routes usable without broadening the site fallback", () => {
    [
      "/cong-thuc-nau-an/* /dynamic-detail-shell.html 200",
      "/exercises/* /dynamic-detail-shell.html 200",
    ].forEach((rewrite) => {
      expect(redirects.indexOf(rewrite)).toBeGreaterThan(-1);
      expect(redirects.indexOf(rewrite)).toBeLessThan(
        redirects.indexOf("/* /404.html 404"),
      );
    });
  });
});

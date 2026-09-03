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

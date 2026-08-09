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
  test("redirects the retired customer-story typo before the SPA fallback", () => {
    const typoRedirects = [
      "/ket-qua-khach-hang/le-thanh-phan-1-thang /ket-qua-khach-hang/le-thanh-nhan-1-thang/ 301",
      "/ket-qua-khach-hang/le-thanh-phan-1-thang/ /ket-qua-khach-hang/le-thanh-nhan-1-thang/ 301",
    ];

    typoRedirects.forEach((typoRedirect) => {
      expect(redirects).toContain(typoRedirect);
      expect(redirects.indexOf(typoRedirect)).toBeLessThan(
        redirects.indexOf("/* /index.html 200"),
      );
    });
  });
});

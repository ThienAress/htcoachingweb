import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (name) =>
  fs.readFileSync(path.resolve(__dirname, "../../public", name), "utf8");

const noindexRules = () => {
  const lines = read("_headers").split(/\r?\n/);
  const rules = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || line.startsWith("#") || line.startsWith(" ")) continue;
    const block = [];
    for (let next = index + 1; next < lines.length && lines[next].startsWith(" "); next += 1) {
      block.push(lines[next].trim());
    }
    if (block.includes("X-Robots-Tag: noindex, nofollow")) rules.push(line.trim());
  }
  return rules;
};

const covered = (rules, route) =>
  rules.some((rule) => {
    if (rule === route) return true;
    if (rule.endsWith("/*")) {
      const prefix = rule.slice(0, -1);
      return route.startsWith(prefix);
    }
    return false;
  });

describe("noindex headers for private app routes", () => {
  test("every app-shell rewrite has an X-Robots-Tag noindex rule", () => {
    const rules = noindexRules();
    const privateRoutes = read("_redirects")
      .split(/\r?\n/)
      .filter((line) => line.endsWith(" /index.html 200"))
      .map((line) => line.split(" ")[0]);

    expect(privateRoutes.length).toBeGreaterThan(20);
    const missing = privateRoutes.filter((route) => {
      const probe = route.replace(/\*/g, "x");
      return !covered(rules, probe);
    });
    expect(missing).toEqual([]);
  });

  test("never marks public SEO pages as noindex", () => {
    const rules = noindexRules();
    for (const route of ["/", "/blog/", "/exercises/", "/cong-thuc-nau-an/", "/tdee-calculator/"]) {
      expect(covered(rules, route)).toBe(false);
    }
  });

  test("robots.txt does not disallow routes that rely on the noindex header", () => {
    const robots = read("robots.txt");
    expect(robots).not.toMatch(/Disallow:\s*\/dashboard/);
    expect(robots).not.toMatch(/Disallow:\s*\/wallet/);
  });
});

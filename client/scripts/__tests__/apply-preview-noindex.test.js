import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  NOINDEX_BLOCK,
  applyPreviewNoindex,
  shouldNoindex,
} from "../apply-preview-noindex.js";

const directories = [];
const makeDist = (headers) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "htcoaching-noindex-"));
  directories.push(dir);
  if (headers !== undefined) fs.writeFileSync(path.join(dir, "_headers"), headers);
  return dir;
};
const silent = { log: () => {} };

afterEach(() => {
  for (const dir of directories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("preview noindex", () => {
  test("applies only to non-production Netlify contexts", () => {
    expect(shouldNoindex({ NETLIFY: "true", CONTEXT: "branch-deploy" })).toBe(true);
    expect(shouldNoindex({ NETLIFY: "true", CONTEXT: "deploy-preview" })).toBe(true);
    expect(shouldNoindex({ NETLIFY: "true", CONTEXT: "production" })).toBe(false);
    expect(shouldNoindex({ CONTEXT: "branch-deploy" })).toBe(false);
    expect(shouldNoindex({})).toBe(false);
  });

  test("appends the header block to the existing _headers file", () => {
    const dist = makeDist("/favicon/site.webmanifest\n  Content-Type: application/manifest+json\n");

    const result = applyPreviewNoindex({
      distDir: dist,
      env: { NETLIFY: "true", CONTEXT: "branch-deploy" },
      logger: silent,
    });
    const content = fs.readFileSync(path.join(dist, "_headers"), "utf8");

    expect(result.applied).toBe(true);
    expect(content).toContain("Content-Type: application/manifest+json");
    expect(content.endsWith(NOINDEX_BLOCK)).toBe(true);
  });

  test("is idempotent and leaves production untouched", () => {
    const dist = makeDist("/a\n  X-Test: 1\n");
    const env = { NETLIFY: "true", CONTEXT: "deploy-preview" };

    applyPreviewNoindex({ distDir: dist, env, logger: silent });
    const second = applyPreviewNoindex({ distDir: dist, env, logger: silent });
    const production = applyPreviewNoindex({
      distDir: makeDist("/a\n  X-Test: 1\n"),
      env: { NETLIFY: "true", CONTEXT: "production" },
      logger: silent,
    });

    expect(second.applied).toBe(false);
    expect(production.applied).toBe(false);
    expect(
      fs.readFileSync(path.join(dist, "_headers"), "utf8").match(/X-Robots-Tag/g),
    ).toHaveLength(1);
  });

  test("creates _headers when the build did not produce one", () => {
    const dist = makeDist();

    applyPreviewNoindex({
      distDir: dist,
      env: { NETLIFY: "true", CONTEXT: "branch-deploy" },
      logger: silent,
    });

    expect(fs.readFileSync(path.join(dist, "_headers"), "utf8")).toBe(NOINDEX_BLOCK);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { resolveCloudinaryFolder } from "../cloudinaryPath.js";

const originalAppEnv = process.env.APP_ENV;

afterEach(() => {
  if (originalAppEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = originalAppEnv;
});

describe("Cloudinary folder isolation", () => {
  it("keeps production folders unchanged", () => {
    process.env.APP_ENV = "production";
    expect(resolveCloudinaryFolder("htcoaching/blog")).toBe(
      "htcoaching/blog",
    );
  });

  it("places staging assets under an isolated prefix", () => {
    process.env.APP_ENV = "staging";
    expect(resolveCloudinaryFolder("htcoaching/blog")).toBe(
      "htcoaching/staging/blog",
    );
    expect(resolveCloudinaryFolder("htcoaching/staging/blog")).toBe(
      "htcoaching/staging/blog",
    );
  });
});

import { describe, expect, it } from "vitest";

import enHome from "../locales/en/home.json";
import viHome from "../locales/vi/home.json";

describe("home hero product copy", () => {
  it.each([
    ["vi", viHome],
    ["en", enHome],
  ])("keeps %s progress tracking on HTCOACHING", (_language, locale) => {
    const heroCopy = [locale.hero.subtitle, ...locale.hero.checklist].join(" ");

    expect(heroCopy).toContain("HTCOACHING");
    expect(heroCopy).not.toMatch(/notion/i);
  });
});

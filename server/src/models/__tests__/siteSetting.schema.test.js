import { describe, expect, it } from "vitest";

import SiteSetting from "../SiteSetting.js";

describe("SiteSetting keyed media schema", () => {
  it("keeps legacy documents valid with empty keyed maps", async () => {
    const settings = new SiteSetting({
      classesImages: ["legacy-class.jpg"],
      toolsImage: "legacy-tdee.jpg",
    });

    await expect(settings.validate()).resolves.toBeUndefined();
    expect(settings.toJSON()).toMatchObject({
      classesImages: ["legacy-class.jpg"],
      toolsImage: "legacy-tdee.jpg",
      heroImagesByKey: {},
      heroAvatarsByKey: {},
      aboutImagesByKey: {},
      trainerImagesByKey: {},
      classesImagesByKey: {},
      toolsImagesByKey: {},
    });
  });

  it("serializes keyed image maps as public response objects", () => {
    const settings = new SiteSetting({
      heroImagesByKey: { "banner-1": "hero.webp" },
      heroAvatarsByKey: { "student-avatar-1": "avatar.webp" },
      aboutImagesByKey: { "about-slide-1": "about.webp" },
      trainerImagesByKey: { "trainer-photo": "trainer.webp" },
      classesImagesByKey: { boxing: "boxing.webp" },
      toolsImagesByKey: { "meal-scan": "meal-scan.webp" },
    });

    expect(settings.toJSON()).toMatchObject({
      heroImagesByKey: { "banner-1": "hero.webp" },
      heroAvatarsByKey: { "student-avatar-1": "avatar.webp" },
      aboutImagesByKey: { "about-slide-1": "about.webp" },
      trainerImagesByKey: { "trainer-photo": "trainer.webp" },
      classesImagesByKey: { boxing: "boxing.webp" },
      toolsImagesByKey: { "meal-scan": "meal-scan.webp" },
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  HOME_ABOUT_CATALOG,
  HOME_CLASS_CATALOG,
  HOME_HERO_AVATAR_CATALOG,
  HOME_HERO_CATALOG,
  HOME_TRAINER_CATALOG,
  HOME_TOOL_CATALOG,
  buildCatalogMediaItems,
} from "../homeSectionCatalog";

const ALL_CATALOGS = [
  HOME_HERO_CATALOG,
  HOME_HERO_AVATAR_CATALOG,
  HOME_ABOUT_CATALOG,
  HOME_TRAINER_CATALOG,
  HOME_CLASS_CATALOG,
  HOME_TOOL_CATALOG,
];

describe("home section media catalog", () => {
  it("uses unique stable keys for every class and tool", () => {
    const keys = ALL_CATALOGS.flat().map(
      (item) => `${item.section}:${item.key}`,
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("defines every fixed media slot rendered by the homepage", () => {
    expect({
      hero: HOME_HERO_CATALOG.map((item) => item.key),
      avatars: HOME_HERO_AVATAR_CATALOG.map((item) => item.key),
      about: HOME_ABOUT_CATALOG.map((item) => item.key),
      trainer: HOME_TRAINER_CATALOG.map((item) => item.key),
    }).toEqual({
      hero: ["banner-1", "banner-2", "banner-3", "banner-4", "banner-5"],
      avatars: ["student-avatar-1", "student-avatar-2", "student-avatar-3"],
      about: [
        "about-slide-1",
        "about-slide-2",
        "about-slide-3",
        "about-slide-4",
        "about-slide-5",
      ],
      trainer: ["trainer-photo"],
    });
  });

  it("keeps optional empty slots out of public sliders until an image exists", () => {
    const heroImages = buildCatalogMediaItems(HOME_HERO_CATALOG).map((item) => item.image);
    const avatarImages = buildCatalogMediaItems(HOME_HERO_AVATAR_CATALOG).map((item) => item.image);

    expect(heroImages.filter(Boolean)).toHaveLength(3);
    expect(avatarImages.filter(Boolean)).toHaveLength(0);
  });

  it("includes every tool currently rendered on the homepage", () => {
    expect(HOME_TOOL_CATALOG.map((item) => item.key)).toEqual([
      "tdee",
      "exercises",
      "recipes",
      "meal-plan",
      "meal-scan",
    ]);
  });

  it("keeps keyed images attached after catalog reordering", () => {
    const reorderedCatalog = [...HOME_CLASS_CATALOG].reverse();
    const items = buildCatalogMediaItems(reorderedCatalog, {
      imagesByKey: {
        boxing: "boxing-upload.webp",
        "personal-training": "personal-training-upload.webp",
      },
    });

    expect(Object.fromEntries(items.map((item) => [item.key, item.image]))).toMatchObject({
      boxing: "boxing-upload.webp",
      "personal-training": "personal-training-upload.webp",
    });
  });

  it("falls back to legacy class positions and the legacy TDEE image", () => {
    const classItems = buildCatalogMediaItems(HOME_CLASS_CATALOG, {
      legacyImages: ["legacy-pt.jpg", "legacy-cardio.jpg", "legacy-boxing.jpg"],
    });
    const toolItems = buildCatalogMediaItems(HOME_TOOL_CATALOG, {
      legacyImage: "legacy-tdee.jpg",
    });

    expect({
      classes: Object.fromEntries(classItems.map((item) => [item.key, item.image])),
      tdee: toolItems.find((item) => item.key === "tdee")?.image,
    }).toMatchObject({
      classes: {
        "personal-training": "legacy-pt.jpg",
        "cardio-hiit": "legacy-cardio.jpg",
        boxing: "legacy-boxing.jpg",
      },
      tdee: "legacy-tdee.jpg",
    });
  });

  it("automatically builds a media slot for a newly registered item", () => {
    const extendedCatalog = [
      ...HOME_CLASS_CATALOG,
      {
        section: "classes",
        key: "pilates",
        adminLabel: "Pilates",
        defaultImage: "pilates-default.jpg",
      },
    ];

    expect(buildCatalogMediaItems(extendedCatalog).at(-1)).toMatchObject({
      key: "pilates",
      image: "pilates-default.jpg",
    });
  });

  it("can resolve only a custom or legacy trainer override without its admin preview default", () => {
    const [trainer] = buildCatalogMediaItems(HOME_TRAINER_CATALOG, {
      includeDefaults: false,
    });

    expect(trainer.image).toBe("");
  });
});

import class1 from "../assets/images/classes/class1.jpg";
import class2 from "../assets/images/classes/class2.jpg";
import class3 from "../assets/images/classes/class3.jpg";
import hero1 from "../assets/images/hero/hero1.webp";
import hero2 from "../assets/images/hero/hero2.webp";
import hero3 from "../assets/images/hero/hero3.webp";
import trainerImage from "../assets/images/trainer/trainer.jpg";

export const HOME_HERO_CATALOG = Object.freeze([
  {
    section: "hero",
    key: "banner-1",
    adminLabel: "Banner 1",
    legacyIndex: 0,
    defaultImage: hero1,
  },
  {
    section: "hero",
    key: "banner-2",
    adminLabel: "Banner 2",
    legacyIndex: 1,
    defaultImage: hero2,
  },
  {
    section: "hero",
    key: "banner-3",
    adminLabel: "Banner 3",
    legacyIndex: 2,
    defaultImage: hero3,
  },
  {
    section: "hero",
    key: "banner-4",
    adminLabel: "Banner 4 (tùy chọn)",
    legacyIndex: 3,
    defaultImage: "",
  },
  {
    section: "hero",
    key: "banner-5",
    adminLabel: "Banner 5 (tùy chọn)",
    legacyIndex: 4,
    defaultImage: "",
  },
]);

export const HOME_HERO_AVATAR_CATALOG = Object.freeze([
  {
    section: "heroAvatars",
    key: "student-avatar-1",
    adminLabel: "Avatar học viên 1",
    legacyIndex: 0,
    defaultImage: "",
  },
  {
    section: "heroAvatars",
    key: "student-avatar-2",
    adminLabel: "Avatar học viên 2",
    legacyIndex: 1,
    defaultImage: "",
  },
  {
    section: "heroAvatars",
    key: "student-avatar-3",
    adminLabel: "Avatar học viên 3",
    legacyIndex: 2,
    defaultImage: "",
  },
]);

export const HOME_ABOUT_CATALOG = Object.freeze([
  {
    section: "about",
    key: "about-slide-1",
    adminLabel: "Ảnh giới thiệu 1",
    legacyIndex: 0,
    defaultImage: hero1,
  },
  {
    section: "about",
    key: "about-slide-2",
    adminLabel: "Ảnh giới thiệu 2",
    legacyIndex: 1,
    defaultImage: hero2,
  },
  {
    section: "about",
    key: "about-slide-3",
    adminLabel: "Ảnh giới thiệu 3",
    legacyIndex: 2,
    defaultImage: hero3,
  },
  {
    section: "about",
    key: "about-slide-4",
    adminLabel: "Ảnh giới thiệu 4 (tùy chọn)",
    legacyIndex: 3,
    defaultImage: "",
  },
  {
    section: "about",
    key: "about-slide-5",
    adminLabel: "Ảnh giới thiệu 5 (tùy chọn)",
    legacyIndex: 4,
    defaultImage: "",
  },
]);

export const HOME_TRAINER_CATALOG = Object.freeze([
  {
    section: "trainer",
    key: "trainer-photo",
    adminLabel: "Ảnh huấn luyện viên nổi bật",
    legacySingle: true,
    defaultImage: trainerImage,
  },
]);

export const HOME_CLASS_CATALOG = Object.freeze([
  {
    section: "classes",
    key: "personal-training",
    adminLabel: "Personal Training",
    contentIndex: 0,
    legacyIndex: 0,
    defaultImage: class1,
  },
  {
    section: "classes",
    key: "cardio-hiit",
    adminLabel: "Cardio & HIIT",
    contentIndex: 1,
    legacyIndex: 1,
    defaultImage: class2,
  },
  {
    section: "classes",
    key: "boxing",
    adminLabel: "Boxing",
    contentIndex: 2,
    legacyIndex: 2,
    defaultImage: class3,
  },
]);

export const HOME_TOOL_CATALOG = Object.freeze([
  {
    section: "tools",
    key: "tdee",
    adminLabel: "TDEE",
    titleKey: "tools.tdee_title",
    descriptionKey: "tools.tdee_desc",
    ctaKey: "tools.tdee_cta",
    route: "/tdee-calculator/",
    icon: "calculator",
    featured: true,
    legacySingle: true,
    defaultImage: hero1,
  },
  {
    section: "tools",
    key: "exercises",
    adminLabel: "Hệ thống bài tập",
    titleKey: "tools.exercise_title",
    descriptionKey: "tools.exercise_desc",
    ctaKey: "tools.exercise_cta",
    route: "/exercises/",
    icon: "dumbbell",
    cardClassName: "col-span-2",
    defaultImage: class1,
  },
  {
    section: "tools",
    key: "recipes",
    adminLabel: "Công thức nấu ăn",
    titleKey: "tools.recipe_title",
    descriptionKey: "tools.recipe_desc",
    ctaKey: "tools.recipe_cta",
    route: "/cong-thuc-nau-an/",
    icon: "utensils",
    cardClassName: "col-span-2 md:col-span-1",
    defaultImage: hero2,
  },
  {
    section: "tools",
    key: "meal-plan",
    adminLabel: "Gợi ý thực đơn",
    titleKey: "tools.mealplan_title",
    descriptionKey: "tools.mealplan_desc",
    ctaKey: "tools.mealplan_cta",
    route: "/mealplan/",
    icon: "calendar",
    cardClassName: "col-span-2 md:col-span-1",
    defaultImage: hero3,
  },
  {
    section: "tools",
    key: "meal-scan",
    adminLabel: "Quét món ăn AI",
    titleKey: "tools.mealscan_title",
    descriptionKey: "tools.mealscan_desc",
    ctaKey: "tools.mealscan_cta",
    route: "/quet-mon-an/",
    icon: "scan",
    cardClassName: "col-span-2",
    imageClassName: "object-center",
    defaultImage: hero1,
  },
]);

const readKeyedImage = (imagesByKey, key) => {
  const value = imagesByKey instanceof Map
    ? imagesByKey.get(key)
    : imagesByKey?.[key];

  return typeof value === "string" && value.trim() ? value : "";
};

const readLegacyImage = (item, { legacyImages, legacyImage }) => {
  if (Number.isInteger(item.legacyIndex)) {
    const value = legacyImages?.[item.legacyIndex];
    return typeof value === "string" && value.trim() ? value : "";
  }

  if (item.legacySingle && typeof legacyImage === "string") {
    return legacyImage.trim();
  }

  return "";
};

export const buildCatalogMediaItems = (
  catalog,
  {
    imagesByKey = {},
    legacyImages = [],
    legacyImage = "",
    includeDefaults = true,
  } = {},
) => catalog.map((item) => ({
  ...item,
  image:
    readKeyedImage(imagesByKey, item.key)
    || readLegacyImage(item, { legacyImages, legacyImage })
    || (includeDefaults ? item.defaultImage : ""),
}));

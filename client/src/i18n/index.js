import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Vietnamese
import viCommon from "./locales/vi/common.json";
import viHome from "./locales/vi/home.json";
import viTdee from "./locales/vi/tdee.json";
import viMealPlan from "./locales/vi/mealplan.json";
import viRecipe from "./locales/vi/recipe.json";
import viExercises from "./locales/vi/exercises.json";
import viStories from "./locales/vi/stories.json";
import viTrainer from "./locales/vi/trainer.json";
import viClub from "./locales/vi/club.json";
import viBooking from "./locales/vi/booking.json";
import viBlog from "./locales/vi/blog.json";
import viAuth from "./locales/vi/auth.json";
import viAccount from "./locales/vi/account.json";
import viCoaching from "./locales/vi/coaching.json";

// English
import enCommon from "./locales/en/common.json";
import enHome from "./locales/en/home.json";
import enTdee from "./locales/en/tdee.json";
import enMealPlan from "./locales/en/mealplan.json";
import enRecipe from "./locales/en/recipe.json";
import enExercises from "./locales/en/exercises.json";
import enStories from "./locales/en/stories.json";
import enTrainer from "./locales/en/trainer.json";
import enClub from "./locales/en/club.json";
import enBooking from "./locales/en/booking.json";
import enBlog from "./locales/en/blog.json";
import enAuth from "./locales/en/auth.json";
import enAccount from "./locales/en/account.json";
import enCoaching from "./locales/en/coaching.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: {
        common: viCommon,
        home: viHome,
        tdee: viTdee,
        mealplan: viMealPlan,
        recipe: viRecipe,
        exercises: viExercises,
        stories: viStories,
        trainer: viTrainer,
        club: viClub,
        booking: viBooking,
        blog: viBlog,
        auth: viAuth,
        account: viAccount,
        coaching: viCoaching,
      },
      en: {
        common: enCommon,
        home: enHome,
        tdee: enTdee,
        mealplan: enMealPlan,
        recipe: enRecipe,
        exercises: enExercises,
        stories: enStories,
        trainer: enTrainer,
        club: enClub,
        booking: enBooking,
        blog: enBlog,
        auth: enAuth,
        account: enAccount,
        coaching: enCoaching,
      },
    },
    defaultNS: "common",
    fallbackLng: "vi",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "ht_language",
      caches: ["localStorage"],
    },
  });

export default i18n;

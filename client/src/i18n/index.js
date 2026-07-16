import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Vietnamese
import viCommon from "./locales/vi/common.json";
import viHome from "./locales/vi/home.json";

// English
import enCommon from "./locales/en/common.json";
import enHome from "./locales/en/home.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: {
        common: viCommon,
        home: viHome,
      },
      en: {
        common: enCommon,
        home: enHome,
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

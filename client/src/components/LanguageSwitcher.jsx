import { useTranslation } from "react-i18next";

export default function LanguageSwitcher({ isSolidHeader = false }) {
  const { i18n } = useTranslation();

  const currentLang = i18n.language === "en" ? "en" : "vi";

  const toggleLanguage = () => {
    i18n.changeLanguage(currentLang === "vi" ? "en" : "vi");
  };

  // Adjust colors based on whether the header has a solid background (dark) or transparent (light)
  const bgClass = isSolidHeader
    ? "bg-white/20 hover:bg-white/30" // Dark background header
    : "bg-black/10 hover:bg-black/20"; // Light background header (unscrolled)

  const activeTextClass = isSolidHeader ? "text-orange-600" : "text-black";
  const inactiveTextClass = isSolidHeader ? "text-white/70" : "text-black/50";

  return (
    <button
      onClick={toggleLanguage}
      className={`relative flex items-center w-14 h-[28px] rounded-full transition-colors shadow-inner cursor-pointer ${bgClass}`}
      aria-label="Toggle language"
    >
      <div
        className={`absolute flex items-center justify-center w-[22px] h-[22px] rounded-full bg-white shadow-sm transform transition-transform duration-300 ${
          currentLang === "en" ? "translate-x-[31px]" : "translate-x-[3px]"
        }`}
      >
        <span className={`text-[10px] font-bold ${activeTextClass}`}>
          {currentLang === "vi" ? "VN" : "EN"}
        </span>
      </div>
      <div className="w-full flex justify-between px-1.5 text-[9px] font-bold">
        <span className={`${inactiveTextClass} ${currentLang === "vi" ? 'opacity-0' : 'opacity-100'}`}>VN</span>
        <span className={`${inactiveTextClass} ${currentLang === "en" ? 'opacity-0' : 'opacity-100'}`}>EN</span>
      </div>
    </button>
  );
}

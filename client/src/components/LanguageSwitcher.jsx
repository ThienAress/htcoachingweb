import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const LANGUAGES = [
  { code: "vi", label: "VN", flag: "🇻🇳" },
  { code: "en", label: "EN", flag: "🇺🇸" },
];

export default function LanguageSwitcher({ variant = "default" }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (code) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  const isHeader = variant === "header";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
          isHeader
            ? "text-white/80 hover:text-white hover:bg-white/10"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        }`}
        aria-label="Chuyển ngôn ngữ"
      >
        <Globe size={15} />
        <span>{currentLang.flag} {currentLang.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleChange(lang.code)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                lang.code === currentLang.code
                  ? "bg-orange-50 text-orange-600 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.code === "vi" ? "Tiếng Việt" : "English"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";

const CountryCombobox = ({ value, onChange, areas }) => {
  const { t } = useTranslation("recipe");
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        // Reset search term khi đóng dropdown mà không chọn
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredAreas = areas.filter(a => 
    a.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-primary h-[50px]"
        onClick={() => setIsOpen(true)}
      >
        {!isOpen && !value && <span className="text-white">{t("combobox.country")}</span>}
        {!isOpen && value && <span>{value}</span>}
        {isOpen && (
          <input
            type="text"
            className="bg-transparent border-none outline-none w-full text-white placeholder-zinc-500"
            placeholder={t("combobox.search")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        )}
        <ChevronDown className={`w-5 h-5 text-zinc-500 shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-500">
          <div 
            className="px-4 py-2.5 hover:bg-zinc-700 cursor-pointer text-zinc-300 transition-colors border-b border-zinc-700/50"
            onClick={() => {
              onChange("");
              setIsOpen(false);
              setSearchTerm("");
            }}
          >
            {t("combobox.all")}
          </div>
          {filteredAreas.length === 0 ? (
            <div className="px-4 py-3 text-zinc-500 text-sm italic">{t("combobox.no_found")}</div>
          ) : (
            filteredAreas.map(a => (
              <div 
                key={a}
                className={`px-4 py-2.5 hover:bg-zinc-700 cursor-pointer flex items-center gap-2 transition-colors ${value === a ? 'bg-primary/10 text-primary font-medium' : 'text-white'}`}
                onClick={() => {
                  onChange(a);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                {a}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CountryCombobox;

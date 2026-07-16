import React from "react";
import { Check, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const ClassCard = ({ image, title, desc, benefits }) => {
  const { t } = useTranslation("home");
  return (
    <div className="group flex flex-col bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] 
    hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)] transition-all duration-500 
    hover:-translate-y-2 border border-slate-100 overflow-hidden">

      {/* Image Section */}
      <div className="relative h-56 sm:h-72 w-full overflow-hidden shrink-0">
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Subtle gradient overlay to make image blend smoothly */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      {/* Content Section */}
      <div className="flex flex-col flex-1 p-5 sm:p-8">
        <h3 className="text-fluid-xl font-bold text-slate-800 mb-2 sm:mb-3 tracking-tight">
          {title}
        </h3>

        <p className="text-slate-500 text-fluid-sm leading-relaxed mb-4 sm:mb-6">
          {desc}
        </p>

        <ul className="space-y-2.5 sm:space-y-3.5 mb-6 sm:mb-8">
          {benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-[#ff5500]/10 p-1">
                <Check className="h-3.5 w-3.5 text-primary stroke-[3]" />
              </div>
              <span className="text-slate-600 text-fluid-sm font-medium leading-relaxed">
                {b}
              </span>
            </li>
          ))}
        </ul>

        {/* Action Button */}
        <div className="mt-auto pt-2">
          <a
            href="#contact"
            className="group/btn flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-slate-50 hover:bg-primary text-slate-700 hover:text-white rounded-xl font-semibold transition-all duration-300 border border-slate-200 hover:border-transparent"
          >
            <span>{t("classes.cta")}</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
          </a>
        </div>
      </div>

    </div>
  );
};

export default ClassCard;


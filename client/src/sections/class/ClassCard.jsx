import React from "react";
import { Check, ArrowRight } from "lucide-react";

const ClassCard = ({ image, title, desc, benefits }) => {
  return (
    <div className="group flex flex-col h-full bg-transparent">
      
      {/* Image Section - Nổi bật và bo tròn */}
      <div className="relative h-64 sm:h-80 w-full overflow-hidden rounded-[2rem] shadow-sm group-hover:shadow-2xl transition-all duration-500">
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
      </div>

      {/* Content Section - Nằm lơ lửng bên dưới không có hộp bao quanh */}
      <div className="flex flex-col flex-1 pt-6 sm:pt-8 px-1">
        <h3 className="text-2xl sm:text-[1.75rem] font-bold text-slate-800 mb-3 tracking-tight">
          {title}
        </h3>
        
        <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-6">
          {desc}
        </p>

        <ul className="space-y-3 mb-8">
          {benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="mt-1">
                <Check className="h-4 w-4 text-blue-600 stroke-[3]" />
              </div>
              <span className="text-slate-700 text-sm sm:text-[15px] font-medium">
                {b}
              </span>
            </li>
          ))}
        </ul>

        {/* Action Link (Thay vì nút to) */}
        <div className="mt-auto pt-2">
          <a
            href="#contact"
            className="group/btn inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-bold text-sm sm:text-base transition-colors uppercase tracking-wide"
          >
            <span>Nhận tư vấn miễn phí</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1.5" />
          </a>
        </div>
      </div>
      
    </div>
  );
};

export default ClassCard;


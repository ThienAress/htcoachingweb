import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";

import { getFlagUrl } from "./constants";

const RecipeCard = ({ recipe }) => {
  const { t, i18n } = useTranslation("recipe");
  const { name, slug, category, thumbnail, prepTime, tags } = recipe;
  const area = recipe.area ? t(`areas.${recipe.area}`, { defaultValue: recipe.area }) : "";

  return (
    <Link
      to={`/cong-thuc-nau-an/${slug}`}
      className="group bg-zinc-800/50 rounded-2xl border border-zinc-700 overflow-hidden transition-all hover:-translate-y-1 hover:border-primary hover:shadow-xl hover:shadow-primary/10"
    >
      {/* Thumbnail */}
      <div className="relative h-48 overflow-hidden bg-zinc-700">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-500">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
        )}

        {/* Area badge — cờ quốc gia */}
        {area && (
          <span className="absolute top-3 left-3 px-2.5 py-1 flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-sm text-xs font-medium text-zinc-200 rounded-full">
            {getFlagUrl(area) ? (
              <img src={getFlagUrl(area)} alt={area} className="w-5 h-auto rounded-[2px]" loading="lazy" />
            ) : (
              <span className="text-sm">🌍</span>
            )}
            <span className="drop-shadow-md">{area}</span>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-white text-base leading-tight line-clamp-2 group-hover:text-primary transition">
          {i18n.language === "en" && recipe.nameEn ? recipe.nameEn : name}
        </h3>

        <div className="flex items-center gap-3 mt-2.5 text-xs text-zinc-400">
          {category && (
            <span className="bg-zinc-700/60 px-2 py-0.5 rounded">
              {category}
            </span>
          )}
          {prepTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {prepTime}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2 py-0.5 bg-primary/10 text-primary rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
};

export default RecipeCard;

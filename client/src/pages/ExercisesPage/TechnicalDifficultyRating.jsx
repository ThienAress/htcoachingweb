import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

const TechnicalDifficultyRating = ({ rating, theme = "dark" }) => {
  const { t } = useTranslation("exercises");
  const normalizedRating = Number.isInteger(rating) && rating >= 1 && rating <= 5
    ? rating
    : null;

  if (!normalizedRating) {
    return (
      <span className={`text-xs font-medium ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}>
        {t("difficulty.not_rated")}
      </span>
    );
  }

  const accessibleLabel = t("difficulty.rating_label", {
    rating: normalizedRating,
  });

  return (
    <span
      className="inline-flex flex-col gap-1"
      aria-label={accessibleLabel}
      title={t("difficulty.tooltip")}
    >
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => {
          const active = index < normalizedRating;
          return (
            <Star
              key={index}
              data-active={active}
              className={active
                ? "h-4 w-4 fill-amber-400 text-amber-400"
                : `h-4 w-4 ${theme === "light" ? "text-gray-300" : "text-gray-600"}`}
            />
          );
        })}
        <span className={`ml-1 text-xs font-semibold ${theme === "light" ? "text-gray-700" : "text-gray-200"}`}>
          {normalizedRating}/5
        </span>
      </span>
      <span className="sr-only">{t("difficulty.tooltip")}</span>
    </span>
  );
};

export default TechnicalDifficultyRating;

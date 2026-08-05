import { useTranslation } from "react-i18next";
import { Beef, Droplets, Flame, Wheat } from "lucide-react";

const MACROS = [
  {
    key: "calories",
    labelKey: "result.calories",
    unit: "kcal",
    icon: Flame,
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    value: "text-orange-700",
  },
  {
    key: "protein",
    labelKey: "result.protein",
    unit: "g",
    icon: Beef,
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
    value: "text-sky-700",
  },
  {
    key: "carb",
    labelKey: "result.carb",
    unit: "g",
    icon: Wheat,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    value: "text-amber-700",
  },
  {
    key: "fat",
    labelKey: "result.fat",
    unit: "g",
    icon: Droplets,
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    value: "text-violet-700",
  },
];

export default function MealMacroSummary({ total }) {
  const { t } = useTranslation("mealScan");

  return (
    <div>
      <p className="mb-3 text-xs leading-5 text-slate-500">
        {t("result.range_help")}
      </p>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {MACROS.map(({
          key,
          labelKey,
          unit,
          icon: Icon,
          color,
          bg,
          border,
          value,
        }) => {
          const range = total[key];
          return (
            <div
              key={key}
              className={`rounded-xl border ${border} ${bg} px-4 py-3`}
            >
              <div className="flex items-center gap-2">
                <Icon size={14} className={color} aria-hidden="true" />
                <p className={`text-xs font-bold uppercase tracking-wide ${color}`}>
                  {t(labelKey)}
                </p>
              </div>
              <p className={`mt-2 text-2xl font-black ${value}`}>
                {range.estimate}
                <span className="ml-1 text-sm font-semibold text-slate-500">
                  {unit}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                <span className="font-semibold">{t("result.range_label")}:</span>{" "}
                {range.min}–{range.max} {unit}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

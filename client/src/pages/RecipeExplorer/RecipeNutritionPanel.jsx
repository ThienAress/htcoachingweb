import { useTranslation } from "react-i18next";

const NUTRIENTS = [
  { key: "calories", unitKey: "unit_kcal" },
  { key: "protein", unitKey: "unit_gram" },
  { key: "carb", unitKey: "unit_gram" },
  { key: "fat", unitKey: "unit_gram" },
  { key: "sugars", unitKey: "unit_gram" },
  { key: "salt", unitKey: "unit_gram" },
];

const formatValue = (value, key, language, unit = "") => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat(language === "en" ? "en-US" : "vi-VN", {
    maximumFractionDigits:
      key === "calories" || unit === "kcal" ? 0 : unit === "g" ? 6 : 1,
  }).format(number);
};

const normalizeAdditionalNutrient = (item) =>
  item.unit === "mg"
    ? { ...item, unit: "g", value: Number(item.value) / 1000 }
    : item;

const RecipeNutritionPanel = ({ nutrition }) => {
  const { t, i18n } = useTranslation("recipe");
  const status = nutrition?.status || "unavailable";
  const values = nutrition?.values || {};
  const additional = (nutrition?.additional || []).map(
    normalizeAdditionalNutrient,
  );
  const coreRows = NUTRIENTS.filter(({ key }) => Number.isFinite(Number(values[key])));
  const hasTotals =
    status === "available" && (coreRows.length > 0 || additional.length > 0);

  return (
    <section aria-labelledby="recipe-nutrition-title" className="space-y-5">
      <div>
        <h2 id="recipe-nutrition-title" className="font-bold text-white text-lg">
          {t("detail.nutrition.title")}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">{t("detail.nutrition.caption")}</p>
      </div>

      {hasTotals ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-700/70">
          <table className="w-full min-w-[300px] border-collapse text-sm">
            <caption className="sr-only">{t("detail.nutrition.caption")}</caption>
            <thead className="bg-zinc-900/80 text-left text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{t("detail.nutrition.title")}</th>
                <th scope="col" className="py-3 pl-4 pr-16 text-right font-semibold sm:px-4">{t("detail.nutrition.value")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700/60">
              {coreRows.map(({ key, unitKey }) => (
                <tr key={key} className="bg-zinc-800/40">
                  <th scope="row" className="px-4 py-3 text-left font-semibold text-zinc-100">
                    {t(`detail.nutrition.${key}`)}
                    <span className="ml-1 font-normal text-zinc-500">({t(`detail.nutrition.${unitKey}`)})</span>
                  </th>
                  <td className="py-3 pl-4 pr-16 text-right font-bold text-primary sm:px-4">{formatValue(values[key], key, i18n.language)}</td>
                </tr>
              ))}
              {additional.map((item) => (
                <tr key={`${item.label}:${item.unit}`} className="bg-zinc-800/40">
                  <th scope="row" className="px-4 py-3 text-left font-semibold text-zinc-100">
                    {item.label}
                    <span className="ml-1 font-normal text-zinc-500">({item.unit})</span>
                  </th>
                  <td className="py-3 pl-4 pr-16 text-right font-bold text-primary sm:px-4">
                    {formatValue(
                      item.value,
                      item.unit === "kcal" ? "calories" : item.label,
                      i18n.language,
                      item.unit,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-700/70 bg-zinc-900/40 p-4 text-sm text-zinc-400">
          {t("detail.nutrition.empty")}
        </div>
      )}

      <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
        {t("detail.nutrition.warning")}
      </p>
    </section>
  );
};

export default RecipeNutritionPanel;

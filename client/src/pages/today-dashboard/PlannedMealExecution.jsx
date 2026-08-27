import { Check, SlidersHorizontal, SkipForward } from "lucide-react";
import { useState } from "react";
import { nutritionComparison } from "./dailyNutrition";

const STATUS_OPTIONS = [
  { value: "eaten", label: "Đã ăn", Icon: Check },
  { value: "skipped", label: "Bỏ bữa", Icon: SkipForward },
];

const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value) =>
  numeric(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 });

const formatCalories = (value) =>
  Math.round(numeric(value)).toLocaleString("vi-VN");

const sumMealTotals = (meals) =>
  meals.reduce(
    (totals, meal) =>
      Object.fromEntries(
        Object.keys(totals).map((key) => [
          key,
          totals[key] + numeric(meal.totals?.[key]),
        ]),
      ),
    { calories: 0, protein: 0, carb: 0, fat: 0 },
  );

const FoodNutritionLine = ({ food }) => (
  <li className="text-sm leading-6 text-slate-300">
    <span className="font-semibold text-slate-100">
      {formatNumber(food.actualAmountGrams ?? food.amountGrams)}g{" "}
      {food.labelSnapshot || food.label}
    </span>{" "}
    <span className="text-slate-400">
      ({formatNumber(food.nutrition?.protein)}P/
      {formatNumber(food.nutrition?.carb)}C/
      {formatNumber(food.nutrition?.fat)}F) -{" "}
      {formatCalories(food.nutrition?.calories)} kcal
    </span>
  </li>
);

export const PlannedMealExecution = ({
  plan,
  entries,
  disabled,
  onStatus,
  onAdjust = () => {},
}) => {
  const [editingMealKey, setEditingMealKey] = useState("");
  const [amounts, setAmounts] = useState({});
  const [formError, setFormError] = useState("");
  if (!plan) return null;
  const meals = Array.isArray(plan.meals) ? plan.meals : [];
  const comparisons = nutritionComparison(
    entries,
    plan.totals || sumMealTotals(meals),
  );
  const labels = {
    calories: ["Kcal", "kcal"],
    protein: ["Protein", "g"],
    carb: ["Carb", "g"],
    fat: ["Fat", "g"],
  };
  const openAdjustment = (meal, execution) => {
    const actualById = new Map(
      (execution?.actualFoods || []).map((food) => [
        String(food.foodId),
        food.actualAmountGrams,
      ]),
    );
    setAmounts(
      Object.fromEntries(
        (meal.foods || []).map((food) => [
          String(food.foodId),
          actualById.get(String(food.foodId)) ?? food.amountGrams,
        ]),
      ),
    );
    setFormError("");
    setEditingMealKey(meal.key);
  };
  const saveAdjustment = (event, meal) => {
    event.preventDefault();
    const adjustments = (meal.foods || []).map((food) => ({
      foodId: food.foodId,
      amountGrams: Number(amounts[String(food.foodId)]),
    }));
    if (
      adjustments.some(
        ({ amountGrams }) =>
          !Number.isFinite(amountGrams) || amountGrams < 1 || amountGrams > 1000,
      )
    ) {
      setFormError("Khối lượng mỗi thực phẩm phải từ 1 đến 1.000g.");
      return;
    }
    onAdjust(meal.key, adjustments);
    setEditingMealKey("");
  };
  return (
    <div className="mt-5">
      <h3 className="font-semibold text-white">Bữa ăn theo kế hoạch</h3>
      <ul className="mt-3 grid gap-3 lg:grid-cols-2">
        {meals.map((meal) => {
          const execution = entries.find(
            (entry) =>
              entry.mode === "follow_plan" &&
              entry.plannedMealKey === meal.key,
          );
          const displayedFoods =
            execution?.actualFoods?.length > 0
              ? execution.actualFoods
              : meal.foods || [];
          const displayedTotals = execution?.actualTotals || meal.totals;
          return (
            <li
              key={meal.key}
              className="rounded-xl border border-slate-700 bg-slate-950/70 p-4"
            >
              <header className="border-b border-slate-700/80 pb-3">
                <h4
                  aria-label={`${meal.name} — ${formatCalories(displayedTotals?.calories)} kcal`}
                  className="text-base font-black text-slate-50"
                >
                  {meal.name}{" "}
                  <span className="text-orange-300">
                    — {formatCalories(displayedTotals?.calories)} kcal
                  </span>
                </h4>
              </header>
              <div className="min-w-0 pt-3">
                <ul className="space-y-1">
                  {displayedFoods.map((food) => (
                    <FoodNutritionLine
                      key={food.foodId || food.label}
                      food={food}
                    />
                  ))}
                </ul>
                <p className="mt-2 text-sm font-bold text-orange-200">
                  Tổng: {formatNumber(displayedTotals?.protein)}P |{" "}
                  {formatNumber(displayedTotals?.carb)}C |{" "}
                  {formatNumber(displayedTotals?.fat)}F
                </p>
              </div>
              {editingMealKey === meal.key && (
                <form
                  className="mt-4 space-y-3 rounded-xl border border-orange-400/20 bg-orange-500/5 p-3"
                  onSubmit={(event) => saveAdjustment(event, meal)}
                >
                  <p className="text-sm font-bold text-orange-100">
                    Điều chỉnh lượng thực tế
                  </p>
                  {(meal.foods || []).map((food) => (
                    <label
                      key={food.foodId}
                      className="grid gap-2 text-sm text-slate-300 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center"
                    >
                      <span>{food.label}</span>
                      <span className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          step="0.1"
                          value={amounts[String(food.foodId)] ?? ""}
                          onChange={(event) =>
                            setAmounts((current) => ({
                              ...current,
                              [String(food.foodId)]: event.target.value,
                            }))
                          }
                          disabled={disabled}
                          aria-label={`Khối lượng ${food.label}`}
                          className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-right text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-40"
                        />
                        <span>g</span>
                      </span>
                    </label>
                  ))}
                  {formError && (
                    <p className="text-sm text-red-300" role="alert">
                      {formError}
                    </p>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingMealKey("")}
                      className="min-h-11 rounded-lg px-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={disabled}
                      className="min-h-11 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
                    >
                      Lưu điều chỉnh
                    </button>
                  </div>
                </form>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(({ value, label, Icon }) => {
                  const selected = execution?.status === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onStatus(meal.key, value)}
                      disabled={disabled}
                      aria-pressed={selected}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected
                          ? "border-orange-400 bg-orange-500/15 text-orange-200"
                          : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
                      }`}
                    >
                      <Icon size={15} aria-hidden="true" /> {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => openAdjustment(meal, execution)}
                  disabled={disabled}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-orange-400/60 hover:bg-orange-500/10 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SlidersHorizontal size={15} aria-hidden="true" /> Điều chỉnh
                </button>
              </div>
              {execution?.status === "changed" && (
                <p className="mt-2 text-xs font-semibold text-orange-200">
                  Đã điều chỉnh, hãy xác nhận “Đã ăn” để cộng vào tổng ngày.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <section
        className="mt-4 rounded-xl border border-orange-400/30 bg-orange-500/5 p-4 sm:p-5"
        aria-labelledby="daily-nutrition-summary-title"
      >
        <h4
          id="daily-nutrition-summary-title"
          className="text-base font-black text-white"
        >
          Tổng dinh dưỡng cả ngày
        </h4>
        <dl className="mt-3 divide-y divide-slate-700/80">
          {comparisons.map((row) => {
            const [label, unit] = labels[row.key];
            const differenceLabel =
              row.state === "met"
                ? "Đã đạt"
                : `${row.state === "over" ? "Vượt" : "Còn thiếu"} ${
                    row.key === "calories"
                      ? formatCalories(row.difference)
                      : formatNumber(row.difference)
                  } ${unit}`;
            return (
              <div
                key={row.key}
                className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              >
                <dt className="text-sm font-semibold text-slate-300">
                  {label}
                </dt>
                <dd className="text-sm font-black tabular-nums text-orange-200">
                  {row.key === "calories"
                    ? formatCalories(row.actual)
                    : formatNumber(row.actual)}{" "}
                  /{" "}
                  {row.key === "calories"
                    ? formatCalories(row.target)
                    : formatNumber(row.target)}{" "}
                  {unit}
                </dd>
                <dd
                  className={`text-xs font-bold sm:text-right ${
                    row.state === "met"
                      ? "text-emerald-300"
                      : row.state === "over"
                        ? "text-amber-300"
                        : "text-slate-400"
                  }`}
                >
                  {differenceLabel}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>
    </div>
  );
};

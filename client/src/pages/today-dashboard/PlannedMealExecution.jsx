import { Check, CircleDot, SkipForward } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "eaten", label: "Đã ăn", Icon: Check },
  { value: "changed", label: "Đã đổi", Icon: CircleDot },
  { value: "skipped", label: "Bỏ bữa", Icon: SkipForward },
];

export const PlannedMealExecution = ({
  plan,
  entries,
  disabled,
  onStatus,
}) => {
  if (!plan) return null;
  return (
    <div className="mt-5">
      <h3 className="font-semibold text-white">Bữa ăn theo kế hoạch</h3>
      <ul className="mt-3 grid gap-3 lg:grid-cols-2">
        {plan.meals.map((meal) => {
          const execution = entries.find(
            (entry) =>
              entry.mode === "follow_plan" &&
              entry.plannedMealKey === meal.key,
          );
          return (
            <li
              key={meal.key}
              className="rounded-xl border border-slate-700 bg-slate-950/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{meal.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {meal.foods.map((food) => food.label).join(" · ")}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-semibold text-orange-300">
                  {Math.round(meal.totals.calories)} kcal
                </span>
              </div>
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
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

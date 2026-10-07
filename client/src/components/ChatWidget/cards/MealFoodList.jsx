export default function MealFoodList({ meal, mealIndex, selection, canReplace, disabled, onSelect }) {
  return (
    <ul aria-label={`Món trong ${meal.label || `bữa ${mealIndex + 1}`}`} className="mt-2 space-y-1.5">
      {(meal.foods || []).map((food, foodIndex) => {
        const selected = selection.mealIndex === mealIndex && selection.foodIndex === foodIndex;
        const amount = Number.isFinite(Number(food.amountGrams))
          ? Number(food.amountGrams).toLocaleString("vi-VN")
          : "—";
        const portion = food.amountGrams
          ? `${amount}g`
          : null;
        const content = (
          <>
            <span className="min-w-0 break-words font-medium">{food.name}</span>
            {portion && <span className="shrink-0 tabular-nums">{portion}</span>}
          </>
        );

        return (
          <li key={`${food.foodId || food.name}-${foodIndex}`}>
            {canReplace ? (
              <button
                aria-pressed={selected}
                className={[
                  "flex min-h-11 w-full items-start justify-between gap-3 rounded-xl border px-2.5 py-2",
                  "text-left text-xs leading-5 transition-[border-color,color,background-color]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500",
                  "disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none",
                  selected
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 " +
                      "dark:border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-950"
                    : "border-slate-200 text-slate-600 hover:border-emerald-500 " +
                      "dark:border-white/10 dark:text-zinc-300 dark:hover:border-emerald-400",
                ].join(" ")}
                disabled={disabled}
                onClick={() => onSelect({ mealIndex, foodIndex })}
                type="button"
              >
                {content}
              </button>
            ) : (
              <div
                className="flex items-start justify-between gap-3 text-xs leading-5 text-slate-600 dark:text-zinc-300"
              >
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

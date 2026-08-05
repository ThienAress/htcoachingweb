import {
  Check,
  LockKeyhole,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { MAX_DECLARED_INGREDIENTS } from "./mealScan.declaredIngredients";

export default function MealScanIngredientSetup({
  rows,
  locked,
  lockedIngredients,
  errorCode,
  onChange,
  onAdd,
  onRemove,
  onLock,
  onUnlock,
}) {
  const { t } = useTranslation("mealScan");

  return (
    <section
      className="flex min-h-[34rem] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-labelledby="meal-scan-setup-title"
    >
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          {t("setup.eyebrow")}
        </p>
        <h2
          id="meal-scan-setup-title"
          className="mt-1.5 text-2xl font-black text-slate-950"
        >
          {t("setup.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {t("setup.description")}
        </p>
      </div>

      <div className="flex-1 px-6 py-5">
        {locked ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <Check size={14} aria-hidden="true" />
                {t("setup.locked")}
              </span>
              <button
                type="button"
                onClick={onUnlock}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <PencilLine size={15} aria-hidden="true" />
                {t("setup.unlock")}
              </button>
            </div>

            {lockedIngredients.length > 0 ? (
              <ul className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
                {lockedIngredients.map((item) => (
                  <li
                    key={`${item.name}-${item.grams}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <span className="font-semibold text-slate-800">
                      {item.name}
                    </span>
                    <span className="shrink-0 font-bold text-slate-600">
                      {item.grams} g
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                {t("setup.locked_empty")}
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              {t("setup.optional")}
            </p>

            <div className="mt-5 space-y-3">
              {rows.map((row, index) => (
                <div
                  key={row.id}
                  className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_9rem_2.75rem] sm:items-end"
                >
                  <label className="text-sm font-semibold text-slate-700">
                    {t("setup.name_label", { index: index + 1 })}
                    <input
                      type="text"
                      maxLength={80}
                      value={row.name}
                      onChange={(event) =>
                        onChange(row.id, "name", event.target.value)
                      }
                      placeholder={t("setup.name_placeholder")}
                      className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {t("setup.grams_label")}
                    <span className="relative mt-2 block">
                      <input
                        type="number"
                        min="1"
                        max="3000"
                        step="0.1"
                        inputMode="decimal"
                        value={row.grams}
                        onChange={(event) =>
                          onChange(row.id, "grams", event.target.value)
                        }
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 pr-8 text-right text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                        aria-label={t("setup.grams_for", {
                          item: row.name || index + 1,
                        })}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                        g
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => onRemove(row.id)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={t("setup.remove", { index: index + 1 })}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onAdd}
              disabled={rows.length >= MAX_DECLARED_INGREDIENTS}
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={15} aria-hidden="true" />
              {t("setup.add")}
            </button>

            {errorCode && (
              <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
                {t(`setup.errors.${errorCode}`)}
              </p>
            )}
          </div>
        )}
      </div>

      {!locked && (
        <div className="border-t border-slate-100 px-6 py-5">
          <button
            type="button"
            onClick={onLock}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <LockKeyhole size={17} aria-hidden="true" />
            {t("setup.lock")}
          </button>
        </div>
      )}
    </section>
  );
}

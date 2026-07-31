import { useQuery } from "@tanstack/react-query";
import { BookOpen, PenLine, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useDebounce } from "../../hooks/useDebounce";
import { getRecipes } from "../../services/recipe.service";
import {
  createManualMealEntry,
  createRecipeMealEntry,
} from "./dailyNutrition";

const newEntryId = () => window.crypto.randomUUID();

export const QuickMealLogger = ({ entryCount, disabled, onAdd }) => {
  const [mode, setMode] = useState("manual");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [error, setError] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const recipesQuery = useQuery({
    queryKey: ["daily-meal-recipes", debouncedSearch],
    queryFn: ({ signal }) =>
      getRecipes({ search: debouncedSearch, page: 1, limit: 5 }, signal),
    enabled: mode === "recipe" && debouncedSearch.trim().length >= 2,
    staleTime: 60_000,
  });
  const recipes = recipesQuery.data?.data || [];
  const limitReached = entryCount >= 10;

  const submit = (event) => {
    event.preventDefault();
    setError("");
    if (limitReached) {
      setError("Mỗi ngày có tối đa 10 mục bữa ăn.");
      return;
    }
    if (mode === "manual") {
      if (!description.trim()) {
        setError("Vui lòng mô tả ngắn bữa ăn.");
        return;
      }
      onAdd(
        createManualMealEntry({
          entryId: newEntryId(),
          description,
        }),
      );
      setDescription("");
      return;
    }
    if (!selectedRecipe) {
      setError("Vui lòng chọn một công thức đã xuất bản.");
      return;
    }
    onAdd(
      createRecipeMealEntry({
        entryId: newEntryId(),
        recipeId: selectedRecipe._id,
      }),
    );
    setSelectedRecipe(null);
    setSearch("");
  };

  return (
    <form
      onSubmit={submit}
      className="mt-5 rounded-xl border border-slate-700 bg-slate-950/70 p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">Ghi bữa ăn nhanh</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Mô tả thủ công và recipe không được gắn macro chính xác tự động.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-400">
          {entryCount}/10 mục
        </span>
      </div>

      <div className="mt-4 flex gap-2" role="group" aria-label="Chế độ ghi bữa ăn">
        <button
          type="button"
          onClick={() => setMode("manual")}
          aria-pressed={mode === "manual"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
            mode === "manual"
              ? "border-orange-400 text-orange-200"
              : "border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          <PenLine size={16} aria-hidden="true" /> Mô tả
        </button>
        <button
          type="button"
          onClick={() => setMode("recipe")}
          aria-pressed={mode === "recipe"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
            mode === "recipe"
              ? "border-orange-400 text-orange-200"
              : "border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          <BookOpen size={16} aria-hidden="true" /> Công thức
        </button>
      </div>

      {mode === "manual" ? (
        <div className="mt-4">
          <label htmlFor="quick-meal-description" className="text-sm text-slate-300">
            Bạn đã ăn gì?
          </label>
          <input
            id="quick-meal-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={240}
            disabled={disabled || limitReached}
            placeholder="Ví dụ: sữa chua và một quả chuối"
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
          />
        </div>
      ) : (
        <div className="mt-4">
          <label htmlFor="quick-meal-recipe" className="text-sm text-slate-300">
            Tìm công thức đã xuất bản
          </label>
          <input
            id="quick-meal-recipe"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedRecipe(null);
            }}
            maxLength={100}
            disabled={disabled || limitReached}
            placeholder="Nhập ít nhất 2 ký tự"
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
          />
          {recipesQuery.isFetching && (
            <p className="mt-2 text-xs text-slate-400" role="status">
              Đang tìm công thức...
            </p>
          )}
          {recipesQuery.isError && (
            <button
              type="button"
              onClick={() => recipesQuery.refetch()}
              className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <RefreshCw size={15} /> Thử tìm lại
            </button>
          )}
          {!recipesQuery.isFetching &&
            !recipesQuery.isError &&
            debouncedSearch.trim().length >= 2 &&
            recipes.length === 0 && (
              <p className="mt-2 text-xs text-slate-400">
                Không tìm thấy công thức phù hợp.
              </p>
            )}
          {recipes.length > 0 && (
            <ul className="mt-2 grid gap-2">
              {recipes.map((recipe) => (
                <li key={recipe._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRecipe(recipe)}
                    aria-pressed={selectedRecipe?._id === recipe._id}
                    className={`min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                      selectedRecipe?._id === recipe._id
                        ? "border-orange-400 bg-orange-500/10 text-orange-100"
                        : "border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {recipe.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled || limitReached}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={16} aria-hidden="true" /> Thêm bữa ăn
      </button>
    </form>
  );
};

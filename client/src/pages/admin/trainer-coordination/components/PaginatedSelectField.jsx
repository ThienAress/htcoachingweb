import { ChevronLeft, ChevronRight, Search } from "lucide-react";

const PaginatedSelectField = ({
  label,
  searchDraft,
  onSearchDraftChange,
  onSearch,
  searchPlaceholder,
  searchAriaLabel,
  field,
  onValueChange,
  emptyLabel,
  options,
  getOptionKey,
  getOptionValue,
  getOptionLabel,
  errorMessage,
  page,
  totalPages,
  pageLabel,
  onPrevious,
  onNext,
}) => (
  <label className="block text-sm font-semibold text-slate-800">
    {label}
    <span className="mt-2 flex gap-2">
      <span className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400"
          aria-hidden="true"
        />
        <input
          value={searchDraft}
          onChange={(event) => onSearchDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch(event);
          }}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 font-normal text-slate-950 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
        />
      </span>
      <button
        type="button"
        onClick={onSearch}
        className="min-h-11 rounded-lg border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
      >
        Tìm
      </button>
    </span>
    <select
      {...field}
      onChange={(event) => {
        field.onChange(event);
        onValueChange(event.target.value);
      }}
      className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-950 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
    >
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={getOptionKey(option)} value={getOptionValue(option)}>
          {getOptionLabel(option)}
        </option>
      ))}
    </select>
    {errorMessage && (
      <span className="mt-1 block text-xs font-normal text-rose-700">
        {errorMessage}
      </span>
    )}
    <span className="mt-2 flex items-center justify-between font-normal text-slate-600">
      <button
        type="button"
        aria-label={`Trang ${pageLabel} trước`}
        disabled={page <= 1}
        onClick={onPrevious}
        className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-xs">
        Trang {page}/{totalPages}
      </span>
      <button
        type="button"
        aria-label={`Trang ${pageLabel} sau`}
        disabled={page >= totalPages}
        onClick={onNext}
        className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
    </span>
  </label>
);

export default PaginatedSelectField;

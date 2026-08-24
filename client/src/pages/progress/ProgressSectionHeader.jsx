import { ArrowLeft } from "lucide-react";

export const ProgressSectionHeader = ({
  description,
  headingRef,
  onBack,
  rangeControls,
  source,
  title,
  titleId,
}) => (
  <header className="border-b border-slate-800 px-5 py-5 sm:px-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại danh sách Tiến trình"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        )}
        <div className="min-w-0">
          <h2
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-bold text-white outline-none"
          >
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            {description}
          </p>
          {source && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              {source}
            </p>
          )}
        </div>
      </div>
      {rangeControls && <div className="shrink-0">{rangeControls}</div>}
    </div>
  </header>
);

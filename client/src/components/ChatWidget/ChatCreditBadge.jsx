import { useEffect, useId, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  formatChatQuotaReset,
  getChatQuotaPresentation,
  getChatQuotaWindows,
} from "./chatPanelRuntime";

const TONE_CLASSES = {
  normal: "text-gray-900 dark:text-white",
  low: "text-amber-700 dark:text-amber-300",
  exhausted: "text-rose-700 dark:text-rose-300",
};

const COST_ROWS = [
  ["chat", "Câu hỏi thường"],
  ["chat_image", "Câu hỏi kèm ảnh"],
  ["smart_search", "Tìm kiếm thông minh"],
  ["meal_scan", "Meal Scan"],
];

const resolveCost = (costs, key) =>
  key === "smart_search"
    ? (costs?.chat ?? 0) + (costs?.smart_search_surcharge ?? 0)
    : costs?.[key];

export default function ChatCreditBadge({ quota, costs }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const popoverId = useId();
  const presentation = getChatQuotaPresentation(quota);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey, true);
    };
  }, [open]);

  if (!presentation) return null;
  const windows = getChatQuotaWindows(quota);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={`${presentation.label}. Xem chi tiết credit`}
        className={`flex h-11 items-center gap-1.5 rounded-full border border-gray-200 bg-white/90 px-3 text-sm font-semibold shadow-sm backdrop-blur-md transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15 ${TONE_CLASSES[presentation.tone]}`}
      >
        <Sparkles size={16} className="text-amber-500" aria-hidden="true" />
        {presentation.compactLabel}
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Chi tiết credit AI"
          className="absolute right-0 top-12 z-20 w-72 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-xl dark:border-white/10 dark:bg-[#1f1f1f] dark:text-gray-200"
        >
          <p className={`text-base font-semibold ${TONE_CLASSES[presentation.tone]}`}>
            {presentation.label}
          </p>
          <ul className="mt-2 space-y-1">
            {windows.map((window) => {
              const reset = formatChatQuotaReset(window.resetAt);
              return (
                <li key={window.key || window.periodLabel} className="flex justify-between gap-3">
                  <span>{window.periodLabel ? `Trong ${window.periodLabel}` : "Hạn mức"}</span>
                  <span className="text-right tabular-nums">
                    {window.remaining}/{window.limit}
                    {reset && (
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        Làm mới {reset}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {costs && (
            <>
              <p className="mt-3 border-t border-gray-200 pt-3 font-medium dark:border-white/10">
                Mỗi lần dùng trừ
              </p>
              <ul className="mt-1 space-y-1">
                {COST_ROWS.map(([key, label]) => {
                  const cost = resolveCost(costs, key);
                  if (!Number.isSafeInteger(cost)) return null;
                  return (
                    <li key={key} className="flex justify-between gap-3">
                      <span>{label}</span>
                      <span className="tabular-nums">{cost} credit</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Bật Tìm kiếm thông minh nhưng câu đó không cần tra web thì phần phụ phí được hoàn lại.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { Trash2 } from "lucide-react";

const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(value))
    : "";

export const QuickMealHistory = ({ entries, disabled, onRemove }) => {
  const quickEntries = entries.filter((entry) => entry.mode !== "follow_plan");
  if (quickEntries.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="font-semibold text-white">Bữa ăn đã ghi</h3>
      <ul className="mt-3 grid gap-2">
        {quickEntries.map((entry) => (
          <li
            key={entry.entryId}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-200">
                {entry.labelSnapshot || entry.description}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {entry.mode === "recipe" ? "Công thức" : "Mô tả thủ công"}
                {entry.recordedAt ? ` · ${formatTime(entry.recordedAt)}` : ""}
                {" · Không có macro tự động"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(entry.entryId)}
              disabled={disabled}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40"
              aria-label={`Xóa ${entry.labelSnapshot || entry.description}`}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

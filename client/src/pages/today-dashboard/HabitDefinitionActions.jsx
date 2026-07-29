import { Archive, Pause, Play } from "lucide-react";
import { useState } from "react";

export const HabitDefinitionActions = ({ habit, disabled, onStatus }) => {
  const [confirmArchive, setConfirmArchive] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
    <button
      type="button"
      onClick={() =>
        onStatus(habit, habit.status === "paused" ? "active" : "paused")
      }
      disabled={disabled}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
    >
      {habit.status === "paused" ? (
        <Play size={15} aria-hidden="true" />
      ) : (
        <Pause size={15} aria-hidden="true" />
      )}
      {habit.status === "paused" ? "Bật lại" : "Tạm dừng"}
    </button>
      {confirmArchive ? (
        <>
          <button
            type="button"
            onClick={() => onStatus(habit, "archived")}
            disabled={disabled}
            className="min-h-11 rounded-lg bg-red-900/40 px-3 py-2 text-sm font-semibold text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40"
          >
            Xác nhận lưu trữ
          </button>
          <button
            type="button"
            onClick={() => setConfirmArchive(false)}
            className="min-h-11 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            Hủy
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmArchive(true)}
          disabled={disabled}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40"
        >
          <Archive size={15} aria-hidden="true" /> Lưu trữ
        </button>
      )}
    </div>
  );
};

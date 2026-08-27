import { Pencil, Save, X } from "lucide-react";
import { useState } from "react";

const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(value))
    : "";

export const QuickMealHistory = ({ entries, disabled, onUpdate }) => {
  const [editingId, setEditingId] = useState(null);
  const [mealName, setMealName] = useState("");
  const [foodDescription, setFoodDescription] = useState("");
  const [error, setError] = useState("");
  const quickEntries = entries.filter((entry) => entry.mode !== "follow_plan");
  if (quickEntries.length === 0) return null;

  const cancelEdit = () => {
    setEditingId(null);
    setMealName("");
    setFoodDescription("");
    setError("");
  };

  const saveEdit = (entry) => {
    setError("");
    if (!mealName.trim() || !foodDescription.trim()) {
      setError("Vui lòng nhập đủ tên bữa ăn và đồ ăn.");
      return;
    }
    try {
      onUpdate({
        entryId: entry.entryId,
        mealName,
        foodDescription,
      });
      cancelEdit();
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  return (
    <div className="mt-5">
      <h3 className="font-semibold text-white">Bữa ăn phát sinh đã ghi</h3>
      <ul className="mt-3 grid gap-2">
        {quickEntries.map((entry) => {
          const isEditing = editingId === entry.entryId;
          const canUpdate = entry.mode === "manual" && Number(entry.editCount || 0) < 1;
          return (
            <li
              key={entry.entryId}
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-3"
            >
              {isEditing ? (
                <div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-400">
                      Bữa ăn
                      <input
                        value={mealName}
                        onChange={(event) => setMealName(event.target.value)}
                        maxLength={80}
                        disabled={disabled}
                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-40"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-400">
                      Đồ ăn
                      <input
                        value={foodDescription}
                        onChange={(event) => setFoodDescription(event.target.value)}
                        maxLength={240}
                        disabled={disabled}
                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-40"
                      />
                    </label>
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-300" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(entry)}
                      disabled={disabled}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-3 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
                    >
                      <Save size={15} aria-hidden="true" /> Lưu cập nhật
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={disabled}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-40"
                    >
                      <X size={15} aria-hidden="true" /> Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-200">
                      {entry.mode === "manual"
                        ? entry.mealName || "Bữa ăn phát sinh"
                        : entry.labelSnapshot}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {entry.mode === "manual"
                        ? entry.description
                        : "Bữa ăn từ công thức đã lưu trước đây"}
                    </p>
                    {entry.recordedAt && (
                      <p className="mt-1 text-xs text-slate-500">
                        {formatTime(entry.recordedAt)}
                      </p>
                    )}
                  </div>
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(entry.entryId);
                        setMealName(entry.mealName || "Bữa ăn phát sinh");
                        setFoodDescription(entry.description || "");
                        setError("");
                      }}
                      disabled={disabled}
                      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-300 hover:border-orange-400/60 hover:bg-slate-800 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
                    >
                      <Pencil size={15} aria-hidden="true" /> Cập nhật
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

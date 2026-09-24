import { Check } from "lucide-react";

export const WellnessHeader = ({
  saveState,
  submitted = false,
  selfManaged = false,
  saved = false,
}) => {
  const saveLabel = {
    saving: selfManaged ? "Đang lưu..." : "Đang gửi...",
    saved: selfManaged ? "Đã lưu" : "Đã cập nhật",
    error: selfManaged ? "Chưa lưu được" : "Chưa gửi được",
    conflict: "Dữ liệu vừa thay đổi",
  };
  const persisted = selfManaged ? saved : submitted;

  return (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h3 className="text-xl font-bold text-white sm:text-2xl">
        Sức khỏe hôm nay
      </h3>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
        {selfManaged
          ? "Điền các chỉ số phù hợp rồi lưu để cập nhật Tiến trình của bạn."
          : "Điền các chỉ số phù hợp rồi nhấn gửi một lần. Dữ liệu chỉ xuất hiện trong Tiến trình sau khi gửi nhật ký ngày."}
      </p>
    </div>
    <span
      className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-400"
      role="status"
      aria-live="polite"
    >
      {(saveState === "saved" || (saveState === "idle" && persisted)) && (
        <Check size={16} className="text-emerald-400" />
      )}
      {saveLabel[saveState] ||
        (selfManaged
          ? persisted
            ? "Đã lưu"
            : "Chưa lưu"
          : persisted
            ? "Đã gửi"
            : "Chưa gửi")}
    </span>
  </div>
  );
};

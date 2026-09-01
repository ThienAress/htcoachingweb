import { Check } from "lucide-react";

const saveLabel = {
  saving: "Đang gửi...",
  saved: "Đã cập nhật",
  error: "Chưa gửi được",
  conflict: "Dữ liệu vừa thay đổi",
};

export const WellnessHeader = ({ saveState, submitted = false }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h3 className="text-xl font-bold text-white sm:text-2xl">
        Sức khỏe hôm nay
      </h3>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
        Điền các chỉ số phù hợp rồi nhấn gửi một lần. Dữ liệu chỉ xuất hiện
        trong Tiến trình sau khi gửi nhật ký ngày.
      </p>
    </div>
    <span
      className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-400"
      role="status"
      aria-live="polite"
    >
      {(saveState === "saved" || (saveState === "idle" && submitted)) && (
        <Check size={16} className="text-emerald-400" />
      )}
      {saveLabel[saveState] || (submitted ? "Đã gửi" : "Chưa gửi")}
    </span>
  </div>
);

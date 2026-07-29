import { Check } from "lucide-react";

const saveLabel = {
  idle: "Tự động lưu khi bạn thay đổi",
  saving: "Đang lưu...",
  saved: "Đã lưu",
  error: "Chưa lưu được",
  conflict: "Có phiên bản mới hơn",
};

export const WellnessHeader = ({ saveState }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 className="text-lg font-bold text-white">Wellness hôm nay</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
        Ghi nhanh trạng thái cơ thể. Ghi chú riêng không hiển thị cho HLV.
      </p>
    </div>
    <span
      className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-400"
      role="status"
      aria-live="polite"
    >
      {saveState === "saved" && (
        <Check size={16} className="text-emerald-400" />
      )}
      {saveLabel[saveState]}
    </span>
  </div>
);

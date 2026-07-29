import { RefreshCw } from "lucide-react";

export const WellnessSaveError = ({
  state,
  onReload,
  onRetry,
}) => {
  if (state !== "error" && state !== "conflict") return null;
  const conflict = state === "conflict";
  return (
    <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3">
      <p className="text-sm text-red-100">
        {conflict
          ? "Dữ liệu đã thay đổi ở nơi khác. Hãy tải bản mới trước khi lưu lại."
          : "Không thể lưu. Dữ liệu vẫn còn trên màn hình để bạn thử lại."}
      </p>
      <button
        type="button"
        onClick={conflict ? onReload : onRetry}
        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-800 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <RefreshCw size={16} />
        {conflict ? "Tải bản mới" : "Thử lưu lại"}
      </button>
    </div>
  );
};

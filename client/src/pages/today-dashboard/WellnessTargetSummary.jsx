import { RefreshCw, Target } from "lucide-react";
import { buildTargetComparisons } from "./wellnessTarget";

export const WellnessTargetSummary = ({
  target,
  actual,
  isLoading,
  isError,
  onRetry,
}) => {
  const comparisons = buildTargetComparisons(target, actual);

  return (
    <div className="mb-5 border-y border-slate-800 py-4">
      <div className="flex items-start gap-3">
        <Target className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white">Mục tiêu do HLV thiết lập</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Chỉ dùng để so sánh với số bạn tự ghi, không ảnh hưởng phần trăm hoàn thành và không phải đánh giá y khoa.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 h-16 animate-pulse rounded-xl bg-slate-900" role="status">
          <span className="sr-only">Đang tải mục tiêu sức khỏe...</span>
        </div>
      ) : isError ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-200">
          <span>Chưa tải được mục tiêu sức khỏe.</span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold hover:bg-amber-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Thử lại
          </button>
        </div>
      ) : comparisons.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          HLV chưa thiết lập mục tiêu cho ngày này.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {comparisons.map((item) => (
            <div key={item.key}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-300">{item.label}</span>
                <span className="text-slate-400">{item.actualLabel}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                {item.percent !== null && (
                  <div
                    className="h-full rounded-full bg-cyan-500"
                    style={{ width: item.percent + "%" }}
                    role="progressbar"
                    aria-label={`${item.label}: ${item.actualLabel}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.percent}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {target?.note && !isLoading && !isError && (
        <p className="mt-4 text-sm leading-6 text-slate-300">
          <span className="font-semibold text-slate-200">Ghi chú của HLV:</span>{" "}
          {target.note}
        </p>
      )}
    </div>
  );
};

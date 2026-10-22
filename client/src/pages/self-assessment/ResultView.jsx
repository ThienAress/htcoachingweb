import { AlertTriangle, RotateCcw } from "lucide-react";

import { formatDate } from "./format";
import Recommendation, { CautionsCard, InsightsCard } from "./ResultRecommendation";
import { LEVEL_TONES, METRIC_LABELS, METRIC_UNITS, VARIANT_LABELS } from "./constants";

const formatValue = (key, metric) => {
  const unit = METRIC_UNITS[key];
  const base = `${metric.value} ${unit}`;
  const variant = metric.variant ? ` (${VARIANT_LABELS[metric.variant] || ""})` : "";
  return key === "cardio" && metric.vo2max ? `${base}, VO2max ước lượng ${metric.vo2max}` : `${base}${variant}`;
};

const MetricList = ({ scoring }) => {
  const entries = Object.entries(scoring?.metrics || {}).filter(([, metric]) => Number.isFinite(metric.value));
  if (entries.length === 0) return null;
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <h3 className="text-base font-bold text-white">Kết quả từng bài</h3>
      <ul className="mt-3 divide-y divide-slate-800">
        {entries.map(([key, metric]) => (
          <li key={key} className="py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-white">{METRIC_LABELS[key]}</p>
                <p className="text-slate-400">
                  {metric.exercise}: {formatValue(key, metric)}
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  LEVEL_TONES[metric.level] || "border-slate-600 text-slate-300"
                }`}
              >
                {metric.levelLabel || "Lưu làm mốc"}
              </span>
            </div>
            {metric.note && <p className="mt-1 text-xs leading-5 text-slate-500">{metric.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
};

const ResultView = ({ assessment, retest, canWrite, onRedo }) => {
  const { scoring, recommendation } = assessment.result;
  const isHold = recommendation.mode === "hold";

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-orange-400/20 bg-orange-400/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">
          Kết quả ngày {formatDate(assessment.completedAt)}
        </p>
        {isHold ? (
          <h2 className="mt-1 text-2xl font-bold text-white">Bạn nên được đánh giá y tế trước khi tập</h2>
        ) : (
          <h2 className="mt-1 text-2xl font-bold text-white">
            {scoring.overallLevelLabel
              ? `Mức thể lực tổng: ${scoring.overallLevelLabel}`
              : "Chưa đủ dữ liệu để xếp mức thể lực"}
          </h2>
        )}
        {!isHold && !scoring.overallLevelLabel && (
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Các bài bạn nhập chưa có bảng chuẩn phù hợp với độ tuổi hoặc giới tính, nên được lưu làm mốc so sánh. Gợi ý bên dưới dựa trên hồ sơ của bạn.
          </p>
        )}
      </header>

      {isHold && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Bạn đã được hệ thống đề nghị tạm dừng các bài kiểm tra thể lực. Hãy làm theo lưu ý an toàn bên dưới.</p>
        </div>
      )}

      {isHold ? (
        <>
          <CautionsCard cautions={recommendation.cautions} />
          <InsightsCard insights={recommendation.insights} />
        </>
      ) : (
        <>
          <MetricList scoring={scoring} />
          <Recommendation recommendation={recommendation} />
        </>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        <p>
          {retest?.isEarly
            ? `Nên làm lại sau ${retest.recommendedAfterDays} ngày (từ ${formatDate(retest.nextEligibleAt)}) để so sánh tiến bộ.`
            : "Đã đến lúc làm lại để so sánh tiến bộ của bạn."}
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={onRedo}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-orange-400/50 px-5 py-2 font-semibold text-orange-200 transition-colors hover:bg-orange-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Làm lại đánh giá
          </button>
        )}
      </section>
    </div>
  );
};

export default ResultView;

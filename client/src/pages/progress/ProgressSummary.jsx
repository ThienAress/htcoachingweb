import { Activity } from "lucide-react";

import { ProgressWellnessOverview } from "./ProgressWellnessOverview";
import { WeightTrendChart } from "./WeightTrendChart";
import {
  progressMetricRows,
  summarizeProgressAvailability,
} from "./progressPresentation";

const MetricGrid = ({ compliance }) => {
  const rows = progressMetricRows(compliance);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <Activity className="text-orange-400" size={22} aria-hidden="true" />
        <div>
          <h2 className="font-bold text-white">Mức độ thực hiện</h2>
          <p className="mt-1 text-sm text-slate-400">
            Chỉ tính những lịch, kế hoạch và thói quen thực sự áp dụng.
          </p>
        </div>
      </div>
      <div className="mt-5 divide-y divide-slate-800 border-y border-slate-800">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-2 py-4 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_auto] sm:items-center sm:gap-4"
          >
            <h3 className="text-sm font-semibold text-slate-200">{row.label}</h3>
            {row.percent === null ? (
              <p className="text-xs text-slate-500">
                Chưa có kế hoạch áp dụng trong khoảng này.
              </p>
            ) : (
              <progress
                value={row.percent}
                max="100"
                className="h-2 w-full accent-orange-500"
                aria-label={`${row.label}: ${row.displayPercent}`}
              />
            )}
            <p className="text-sm font-semibold text-orange-300">
              {row.displayPercent}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {row.numerator}/{row.denominator}
              </span>
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">Bảng số liệu mức độ thực hiện</caption>
          <thead className="border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-3 py-3 font-medium">Chỉ số</th>
              <th className="px-3 py-3 font-medium">Hoàn thành</th>
              <th className="px-3 py-3 font-medium">Áp dụng</th>
              <th className="px-3 py-3 font-medium">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-slate-900">
                <th className="px-3 py-3 font-medium text-slate-200">{row.label}</th>
                <td className="px-3 py-3 text-slate-300">{row.numerator}</td>
                <td className="px-3 py-3 text-slate-300">{row.denominator}</td>
                <td className="px-3 py-3 text-slate-300">{row.displayPercent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export const ProgressSummary = ({ progress }) => (
  <div className="space-y-4">
    {!summarizeProgressAvailability(progress) && (
      <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-5 text-sm text-slate-400">
        Chưa có dữ liệu trong khoảng này. Các chỉ số sẽ xuất hiện khi bạn có lịch hoặc ghi nhật ký.
      </p>
    )}
    <MetricGrid compliance={progress.compliance} />
    <div className="grid gap-4 xl:grid-cols-2">
      <ProgressWellnessOverview wellness={progress.wellness} />
      <WeightTrendChart trend={progress.weightTrend} />
    </div>
  </div>
);

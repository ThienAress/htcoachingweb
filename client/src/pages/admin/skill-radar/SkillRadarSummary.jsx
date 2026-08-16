import { Activity, Clock3, GitCompareArrows, RadioTower } from "lucide-react";

import { formatRadarDate, formatRadarRunDate } from "./skillRadarPresentation";

export default function SkillRadarSummary({ summary, schedule }) {
  const metrics = [
    { label: "Tổng nguồn", value: summary.total },
    { label: "Đang theo dõi", value: summary.active },
    { label: "Có thay đổi", value: summary.changed },
    { label: "Đến hạn review", value: summary.reviewDue },
    { label: "Giới hạn API", value: summary.rateLimited },
    { label: "Ngủ đông", value: summary.dormant },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white" aria-labelledby="radar-summary-heading">
      <div className="flex flex-col gap-4 border-b border-zinc-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
            <RadioTower className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="radar-summary-heading" className="font-bold text-zinc-950">Chu kỳ theo dõi</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Baseline quét {schedule.label}; nguồn Admin theo lịch riêng trong bảng. Review semantic vẫn cần phê duyệt.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-emerald-800">
            <Clock3 className="size-4" aria-hidden="true" />
            Lần quét dự kiến: {formatRadarRunDate(schedule.nextRunAt)}
          </span>
          <span className="inline-flex items-center gap-2 text-zinc-600">
            <GitCompareArrows className="size-4" aria-hidden="true" />
            Snapshot: {formatRadarDate(schedule.generatedAt)}
          </span>
          {schedule.failures > 0 && (
            <span className="inline-flex items-center gap-2 font-semibold text-rose-800">
              <Activity className="size-4" aria-hidden="true" />
              {schedule.failures} nguồn lỗi
            </span>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 divide-x divide-y divide-zinc-200 sm:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
        {metrics.map((metric) => (
          <div key={metric.label} className="px-4 py-3 first:border-l-0">
            <dt className="text-xs font-medium text-zinc-500">{metric.label}</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-zinc-950">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

import { Scale } from "lucide-react";

import {
  buildWeightChartModel,
  WEIGHT_CHART_VIEWBOX,
} from "./progressCharts";

const formatDate = (dateKey) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${dateKey}T12:00:00+07:00`));

export const WeightTrendChart = ({ trend }) => {
  const chart = buildWeightChartModel(trend?.points || []);
  const labelEvery = Math.max(1, Math.ceil(chart.points.length / 5));

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <Scale className="text-orange-400" size={22} aria-hidden="true" />
        <div>
          <h2 className="font-bold text-white">Xu hướng cân nặng theo tuần</h2>
          <p className="mt-1 text-sm text-slate-400">
            Dựa trên báo cáo tuần đã gửi; không phải kết luận y khoa.
          </p>
        </div>
      </div>

      {chart.points.length === 0 ? (
        <figure className="mt-5" aria-labelledby="empty-weight-chart-caption">
          <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-700">
            <svg
              viewBox={WEIGHT_CHART_VIEWBOX}
              className="h-auto w-full"
              role="img"
              aria-label="Biểu đồ cân nặng chưa có dữ liệu"
            >
              {[24, 103, 182].map((y) => (
                <line
                  key={y}
                  x1="52"
                  x2="588"
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-slate-800"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-medium text-slate-400">
              Chưa có dữ liệu cân nặng
            </p>
          </div>
          <figcaption
            id="empty-weight-chart-caption"
            className="mt-2 text-xs leading-5 text-slate-500"
          >
            Biểu đồ đường sẽ xuất hiện khi bạn gửi ít nhất một báo cáo tuần có
            cân nặng.
          </figcaption>
        </figure>
      ) : (
        <>
          <p className="mt-5 text-sm text-slate-300">
            Thay đổi trong khoảng:{" "}
            <strong className="text-white">
              {trend.changeKg === null
                ? "Cần ít nhất 2 tuần"
                : `${trend.changeKg > 0 ? "+" : ""}${trend.changeKg} kg`}
            </strong>
          </p>

          <figure className="mt-4" aria-labelledby="weight-trend-caption">
            <svg
              viewBox={WEIGHT_CHART_VIEWBOX}
              className="h-auto w-full overflow-visible"
              role="img"
              aria-label="Biểu đồ đường thể hiện cân nặng theo từng tuần"
            >
              {chart.yTicks.map((tick) => (
                <g key={`${tick.weight}-${tick.y}`} className="text-slate-800">
                  <line
                    x1="52"
                    x2="588"
                    y1={tick.y}
                    y2={tick.y}
                    stroke="currentColor"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text x="44" y={tick.y + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
                    {tick.weight}
                  </text>
                </g>
              ))}
              <path
                d={chart.path}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="text-orange-400"
              />
              {chart.points.map((point, index) => {
                const showLabel =
                  index === 0 ||
                  index === chart.points.length - 1 ||
                  index % labelEvery === 0;
                return (
                  <g key={point.weekStartDateKey}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="5"
                      fill="currentColor"
                      className="text-orange-300"
                    >
                      <title>{`${formatDate(point.weekStartDateKey)}: ${point.weightKg} kg`}</title>
                    </circle>
                    {showLabel && (
                      <text
                        x={point.x}
                        y="207"
                        textAnchor="middle"
                        className="fill-slate-500 text-[11px]"
                      >
                        {point.dateLabel}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <figcaption id="weight-trend-caption" className="mt-2 text-xs leading-5 text-slate-500">
              Mỗi điểm là một báo cáo tuần. Đường nối giúp nhìn hướng thay đổi, không thể hiện mục tiêu y khoa.
            </figcaption>
          </figure>

          <details className="mt-4 border-y border-slate-800 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
              Xem số liệu từng tuần
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-sm">
                <caption className="sr-only">Các điểm cân nặng theo tuần</caption>
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-3 py-3 font-medium">Tuần bắt đầu</th>
                    <th className="px-3 py-3 font-medium">Cân nặng</th>
                  </tr>
                </thead>
                <tbody>
                  {chart.points.map((point) => (
                    <tr key={point.weekStartDateKey} className="border-b border-slate-900">
                      <td className="px-3 py-3 text-slate-300">{formatDate(point.weekStartDateKey)}</td>
                      <td className="px-3 py-3 font-medium text-white">{point.weightKg} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
};

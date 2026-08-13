import { Ruler, Scale } from "lucide-react";

import {
  BODY_METRIC_CHART_VIEWBOX,
  buildBodyMetricChartModel,
} from "./progressCharts";
import { bodyProgressHistoryRows } from "./progressPresentation";

const formatDate = (dateKey) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${dateKey}T12:00:00+07:00`));

const formatValue = (value) =>
  Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const Delta = ({ value, unit }) => (
  <p className="mt-2 text-sm text-slate-400">
    Thay đổi trong khoảng: {" "}
    {value === null || value === undefined ? (
      <span className="font-medium text-slate-300">Cần ít nhất 2 lần đo</span>
    ) : (
      <strong className="font-semibold text-white">
        {value > 0 ? "+" : ""}
        {formatValue(value)} {unit}
      </strong>
    )}
  </p>
);

const MetricChart = ({ metric, label, colorClass }) => {
  const chart = buildBodyMetricChartModel(metric?.series || []);
  const labelEvery = Math.max(1, Math.ceil(chart.points.length / 4));
  return (
    <figure className="mt-5" aria-label={`Lịch sử ${label.toLowerCase()}`}>
      {chart.points.length === 0 ? (
        <div className="flex min-h-36 items-center justify-center border-y border-dashed border-slate-800 px-4 text-center text-sm text-slate-500">
          Chưa có lịch sử {label.toLowerCase()}
        </div>
      ) : (
        <svg
          viewBox={BODY_METRIC_CHART_VIEWBOX}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`Biểu đồ đường ${label.toLowerCase()} theo báo cáo tuần`}
        >
          {chart.yTicks.map((tick) => (
            <g key={`${tick.weight}-${tick.y}`}>
              <line
                x1="52"
                x2="588"
                y1={tick.y}
                y2={tick.y}
                stroke="currentColor"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                className="text-slate-800"
              />
              <text
                x="44"
                y={tick.y + 4}
                textAnchor="end"
                className="fill-slate-500 text-[11px]"
              >
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
            className={colorClass}
          />
          {chart.points.map((point, index) => {
            const showLabel =
              index === 0 ||
              index === chart.points.length - 1 ||
              index % labelEvery === 0;
            return (
              <g key={point.dateKey}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  fill="currentColor"
                  className={colorClass}
                >
                  <title>{`${formatDate(point.dateKey)}: ${formatValue(point.value)} ${metric.unit}`}</title>
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
      )}
      <figcaption className="mt-2 text-xs leading-5 text-slate-500">
        Mỗi điểm dùng ngày bắt đầu tuần của báo cáo, không phải thời điểm đo
        chính xác.
      </figcaption>
    </figure>
  );
};

const BodyMetric = ({ metric, label, emptyLabel, icon: Icon, colorClass }) => (
  <div className="min-w-0 px-5 py-6 sm:px-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Icon size={18} className={colorClass} aria-hidden="true" />
          <h3>{label}</h3>
        </div>
        {metric?.current ? (
          <p className="mt-3 text-3xl font-bold tabular-nums text-white">
            {formatValue(metric.current.value)}{" "}
            <span className="text-base font-semibold text-slate-400">
              {metric.unit}
            </span>
          </p>
        ) : (
          <p className="mt-3 text-sm font-medium text-slate-400">{emptyLabel}</p>
        )}
      </div>
      {metric?.current && (
        <time
          dateTime={metric.current.dateKey}
          className="shrink-0 text-xs text-slate-500"
        >
          {formatDate(metric.current.dateKey)}
        </time>
      )}
    </div>
    {metric?.current && <Delta value={metric.delta} unit={metric.unit} />}
    <MetricChart metric={metric} label={label} colorClass={colorClass} />
  </div>
);

export const BodyProgressReport = ({ bodyProgress = {} }) => {
  const history = bodyProgressHistoryRows(bodyProgress);
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm"
      aria-labelledby="body-progress-title"
    >
      <header className="border-b border-slate-800 px-5 py-5 sm:px-6">
        <h2 id="body-progress-title" className="text-lg font-bold text-white">
          Tiến trình cơ thể
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
          Cân nặng và vòng eo từ báo cáo tuần đã gửi hoặc được duyệt. Đây là
          dữ liệu theo dõi, không phải kết luận y khoa.
        </p>
        <p className="mt-2 text-xs font-medium text-slate-500">
          Nguồn: Báo cáo tuần đã gửi hoặc được duyệt
        </p>
      </header>

      <div className="divide-y divide-slate-800 md:grid md:grid-cols-2 md:divide-x md:divide-y-0">
        <BodyMetric
          metric={bodyProgress.weightKg}
          label="Cân nặng"
          emptyLabel="Chưa có số đo cân nặng"
          icon={Scale}
          colorClass="text-orange-400"
        />
        <BodyMetric
          metric={bodyProgress.waistCm}
          label="Vòng eo"
          emptyLabel="Chưa có số đo vòng eo"
          icon={Ruler}
          colorClass="text-cyan-400"
        />
      </div>

      <details className="border-t border-slate-800 px-5 py-4 sm:px-6">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
          Xem lịch sử số đo ({history.length})
        </summary>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Chưa có số đo trong khoảng thời gian này.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <caption className="sr-only">
                Lịch sử cân nặng và vòng eo theo báo cáo tuần
              </caption>
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-3 py-3 font-medium">Tuần bắt đầu</th>
                  <th className="px-3 py-3 font-medium">Cân nặng</th>
                  <th className="px-3 py-3 font-medium">Vòng eo</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.dateKey} className="border-b border-slate-900">
                    <td className="px-3 py-3 text-slate-300">
                      <time dateTime={row.dateKey}>{formatDate(row.dateKey)}</time>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-white">
                      {row.weightKg === null
                        ? "—"
                        : `${formatValue(row.weightKg)} kg`}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-white">
                      {row.waistCm === null
                        ? "—"
                        : `${formatValue(row.waistCm)} cm`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  );
};

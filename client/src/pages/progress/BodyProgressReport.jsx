import { Dumbbell, Percent, Ruler, Scale } from "lucide-react";
import { useRef, useState } from "react";

import { BodyMetricChart } from "./BodyMetricChart";
import { bodyProgressHistoryRows } from "./progressPresentation";
import { ProgressSectionHeader } from "./ProgressSectionHeader";

const formatDate = (dateKey) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${dateKey}T12:00:00+07:00`));

const formatNumber = (value) =>
  Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const METRICS = [
  { key: "weightKg", label: "Cân nặng", icon: Scale, unit: "kg" },
  { key: "waistCm", label: "Vòng eo", icon: Ruler, unit: "cm" },
  { key: "bodyFatPercent", label: "Tỷ lệ mỡ cơ thể", icon: Percent, unit: "%" },
  {
    key: "skeletalMusclePercent",
    label: "Tỷ lệ cơ xương",
    icon: Dumbbell,
    unit: "%",
  },
];

const valueLabel = (value, unit) =>
  unit === "%" ? `${formatNumber(value)}%` : `${formatNumber(value)} ${unit}`;

const deltaLabel = (delta, unit) => {
  if (delta === null || delta === undefined) return "Cần ít nhất 2 lần đo";
  const deltaUnit = unit === "%" ? "điểm %" : unit;
  const prefix = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${prefix}${formatNumber(Math.abs(delta))} ${deltaUnit}`;
};

const initialMetricKey = (bodyProgress) =>
  METRICS.find(({ key }) => bodyProgress?.[key]?.current)?.key || "weightKg";

const MetricSelector = ({ activeKey, bodyProgress, onSelect }) => {
  const buttonRefs = useRef([]);
  const moveSelection = (event, currentIndex) => {
    const keyTargets = {
      ArrowRight: (currentIndex + 1) % METRICS.length,
      ArrowLeft: (currentIndex - 1 + METRICS.length) % METRICS.length,
      Home: 0,
      End: METRICS.length - 1,
    };
    const nextIndex = keyTargets[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    onSelect(METRICS[nextIndex].key);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className="grid border-b border-slate-800 sm:grid-cols-2 lg:grid-cols-4"
      role="tablist"
      aria-label="Chỉ số cơ thể"
    >
      {METRICS.map(({ key, label, icon: Icon, unit }, index) => {
        const metric = bodyProgress[key];
        const active = key === activeKey;
        return (
          <button
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            key={key}
            id={`body-metric-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="body-metric-panel"
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(key)}
            onKeyDown={(event) => moveSelection(event, index)}
            className={
              "min-h-28 border-b-2 px-5 py-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400 sm:px-6 lg:border-r lg:last:border-r-0 " +
              (active
                ? "border-b-orange-400 bg-orange-500/5 text-white"
                : "border-b-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white")
            }
          >
            <span className="flex items-center gap-2 text-xs font-semibold">
              <Icon
                size={17}
                className={active ? "text-orange-300" : "text-slate-500"}
                aria-hidden="true"
              />
              {label}
            </span>
            <span className="mt-2 block text-xl font-bold tabular-nums text-white">
              {metric?.current
                ? valueLabel(metric.current.value, metric.unit || unit)
                : "Chưa có dữ liệu"}
            </span>
            {!metric?.current && (
              <span className="sr-only">
                Chưa có số đo {label.toLowerCase()}
              </span>
            )}
            <span className="mt-1 block text-xs text-slate-400">
              {metric?.current
                ? metric.delta === null || metric.delta === undefined
                  ? "Cần ít nhất 2 lần đo"
                  : `Thay đổi ${deltaLabel(metric.delta, metric.unit || unit)}`
                : "Chưa có báo cáo phù hợp"}
            </span>
            <span className="sr-only">Lựa chọn {index + 1} trong 4</span>
          </button>
        );
      })}
    </div>
  );
};

const HistoryTable = ({ history }) => (
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
        <table className="w-full min-w-[680px] text-left text-sm">
          <caption className="sr-only">
            Lịch sử số đo cơ thể theo báo cáo tuần
          </caption>
          <thead className="border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-3 py-3 font-medium">Kỳ bắt đầu</th>
              {METRICS.map(({ key, label }) => (
                <th key={key} className="px-3 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.dateKey} className="border-b border-slate-900">
                <td className="px-3 py-3 text-slate-300">
                  <time dateTime={row.dateKey}>{formatDate(row.dateKey)}</time>
                </td>
                {METRICS.map(({ key, unit }) => (
                  <td
                    key={key}
                    className="px-3 py-3 tabular-nums text-white"
                  >
                    {row[key] === null ? "—" : valueLabel(row[key], unit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </details>
);

export const BodyProgressReport = ({
  bodyProgress = {},
  headingRef,
  onBack,
  range,
  rangeControls,
}) => {
  const [activeKey, setActiveKey] = useState(() =>
    initialMetricKey(bodyProgress),
  );
  const activeConfig =
    METRICS.find(({ key }) => key === activeKey) || METRICS[0];
  const activeMetric = bodyProgress[activeConfig.key] || {
    unit: activeConfig.unit,
    current: null,
    delta: null,
    series: [],
  };
  const firstPoint = activeMetric.series?.[0];
  const history = bodyProgressHistoryRows(bodyProgress);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm"
      aria-labelledby="body-progress-title"
      data-progress-section-card="body"
    >
      <ProgressSectionHeader
        title="Tiến trình cơ thể"
        titleId="body-progress-title"
        description="Theo dõi xu hướng từ các báo cáo tuần đã gửi. Chọn một chỉ số để xem rõ thay đổi theo thời gian. Đây là dữ liệu theo dõi, không phải kết luận y khoa."
        source="Nguồn: Báo cáo tuần đã gửi hoặc được duyệt"
        headingRef={headingRef}
        onBack={onBack}
        rangeControls={rangeControls}
      />

      <MetricSelector
        activeKey={activeConfig.key}
        bodyProgress={bodyProgress}
        onSelect={setActiveKey}
      />

      <div
        id="body-metric-panel"
        role="tabpanel"
        aria-labelledby={`body-metric-tab-${activeConfig.key}`}
        className="px-5 py-5 sm:px-6"
      >
        <div>
          <h3 className="text-base font-bold text-white">
            Biểu đồ {activeConfig.label.toLowerCase()} ({activeMetric.unit})
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {activeMetric.current && firstPoint
              ? `Từ ${valueLabel(firstPoint.value, activeMetric.unit)} đến ${valueLabel(
                  activeMetric.current.value,
                  activeMetric.unit,
                )} · ${
                  activeMetric.delta === null || activeMetric.delta === undefined
                    ? "Cần ít nhất 2 lần đo"
                    : `Thay đổi ${deltaLabel(
                        activeMetric.delta,
                        activeMetric.unit,
                      )}`
                }`
              : "Không có điểm đo trong khoảng đang chọn"}
          </p>
        </div>

        <BodyMetricChart
          label={activeConfig.label}
          metric={activeMetric}
          range={range}
        />
        {activeMetric.current && (
          <aside className="mt-5 border-t border-slate-800 pt-4 text-sm leading-6 text-slate-400">
            <h4 className="font-semibold text-slate-200">Giải thích biểu đồ</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Biểu đồ chỉ hiển thị những kỳ đã có số đo.</li>
              <li>
                Đường nét đứt thể hiện lần đo đầu tiên trong khoảng đang xem.
              </li>
              <li>Ngày trên biểu đồ là ngày bắt đầu kỳ báo cáo.</li>
            </ul>
          </aside>
        )}
      </div>

      <HistoryTable history={history} />
    </section>
  );
};

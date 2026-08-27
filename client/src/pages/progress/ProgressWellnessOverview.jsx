import {
  Activity,
  BatteryMedium,
  Brain,
  Footprints,
  HeartPulse,
  Moon,
  Utensils,
  Waves,
} from "lucide-react";
import { useRef, useState } from "react";

import {
  WELLNESS_SEMANTIC_OPTIONS,
  wellnessSemanticLabel,
} from "../../utils/wellnessSemantics";
import { ProgressSectionHeader } from "./ProgressSectionHeader";
import { WellnessMetricChart } from "./WellnessMetricChart";

const METRICS = [
  { key: "sleepHours", label: "Giấc ngủ", unit: "giờ", icon: Moon },
  { key: "waterMl", label: "Nước uống", unit: "ml", icon: Waves },
  { key: "steps", label: "Số bước", unit: "bước", icon: Footprints },
  {
    key: "energy",
    label: "Năng lượng",
    icon: BatteryMedium,
    kind: "qualitative",
    domain: [3, 9],
    semanticOptions: WELLNESS_SEMANTIC_OPTIONS.energy,
  },
  {
    key: "hunger",
    label: "Cảm giác đói",
    icon: Utensils,
    kind: "qualitative",
    domain: [3, 9],
    semanticOptions: WELLNESS_SEMANTIC_OPTIONS.hunger,
  },
  {
    key: "stress",
    label: "Căng thẳng",
    icon: Brain,
    kind: "qualitative",
    domain: [3, 9],
    semanticOptions: WELLNESS_SEMANTIC_OPTIONS.stress,
  },
  {
    key: "soreness",
    label: "Đau mỏi",
    icon: Activity,
    kind: "qualitative",
    domain: [3, 9],
    semanticOptions: WELLNESS_SEMANTIC_OPTIONS.soreness,
  },
  {
    key: "pain",
    label: "Mức đau",
    icon: HeartPulse,
    kind: "qualitative",
    domain: [0, 9],
    semanticOptions: WELLNESS_SEMANTIC_OPTIONS.pain,
  },
];

const METRIC_GROUPS = [
  { label: "Số liệu", metrics: METRICS.slice(0, 3) },
  { label: "Cảm nhận", metrics: METRICS.slice(3) },
];

const formatNumber = (config, value) =>
  Number(value).toLocaleString("vi-VN", {
    maximumFractionDigits: config.key === "sleepHours" ? 1 : 0,
  });

const valueLabel = (config, value) =>
  config.kind === "qualitative"
    ? wellnessSemanticLabel(config.key, value)
    : `${formatNumber(config, value)} ${config.unit}`;

const compactDateLabel = (dateKey) => {
  const [, month, day] = String(dateKey || "").split("-");
  return month && day ? `${Number(day)}/${Number(month)}` : "";
};

const latestObservation = (wellness, key) =>
  [...(wellness?.daily || [])]
    .filter(
      (day) =>
        /^\d{4}-\d{2}-\d{2}$/.test(String(day?.dateKey || "")) &&
        typeof day?.[key] === "number" &&
        Number.isFinite(day[key]),
    )
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .at(-1) || null;

const metricSnapshot = (wellness, config) => {
  const metric = wellness?.[config.key];
  if (config.kind === "qualitative") {
    const dailyLatest = latestObservation(wellness, config.key);
    const hasSummaryLatest =
      typeof metric?.latest === "number" && Number.isFinite(metric.latest);
    return {
      hasValue: hasSummaryLatest || Boolean(dailyLatest),
      value: hasSummaryLatest
        ? metric.latest
        : (dailyLatest?.[config.key] ?? null),
      dateKey: hasSummaryLatest
        ? metric.latestDateKey
        : (dailyLatest?.dateKey || null),
      count: metric?.count || 0,
    };
  }
  const hasAverage =
    metric?.average !== null && metric?.average !== undefined;
  return {
    hasValue: hasAverage,
    value: hasAverage ? metric.average : null,
    dateKey: null,
    count: metric?.count || 0,
  };
};

const initialMetricKey = (wellness) =>
  METRICS.find((config) => metricSnapshot(wellness, config).hasValue)?.key ||
  "sleepHours";

const WellnessMetricSelector = ({ activeKey, onSelect, wellness }) => {
  const buttonRefs = useRef([]);
  const moveSelection = (event, currentIndex) => {
    const keyTargets = {
      ArrowRight: (currentIndex + 1) % METRICS.length,
      ArrowLeft: (currentIndex - 1 + METRICS.length) % METRICS.length,
      ArrowDown: (currentIndex + 1) % METRICS.length,
      ArrowUp: (currentIndex - 1 + METRICS.length) % METRICS.length,
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
    <div>
      <div
        className="border-b border-slate-800 p-4 lg:hidden"
        data-wellness-selector="mobile"
      >
        <label
          htmlFor="wellness-metric-select"
          className="mb-2 block text-sm font-semibold text-slate-200"
        >
          Chỉ số sức khỏe
        </label>
        <select
          id="wellness-metric-select"
          value={activeKey}
          onChange={(event) => onSelect(event.target.value)}
          aria-controls="wellness-metric-panel"
          className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30"
        >
          {METRIC_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.metrics.map((config) => (
                <option key={config.key} value={config.key}>
                  {config.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div
        className="hidden h-full border-r border-slate-800 py-4 lg:block"
        role="tablist"
        aria-label="Chỉ số sức khỏe"
        aria-orientation="vertical"
        data-wellness-selector="desktop"
      >
        {METRIC_GROUPS.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0" role="presentation">
            <p className="px-5 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
            </p>
            <div className="space-y-1 px-3" role="presentation">
              {group.metrics.map((config) => {
                const index = METRICS.findIndex(
                  (metric) => metric.key === config.key,
                );
                const active = config.key === activeKey;
                const Icon = config.icon;
                return (
                  <button
                    ref={(node) => {
                      buttonRefs.current[index] = node;
                    }}
                    key={config.key}
                    id={`wellness-metric-tab-${config.key}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="wellness-metric-panel"
                    tabIndex={active ? 0 : -1}
                    onClick={() => onSelect(config.key)}
                    onKeyDown={(event) => moveSelection(event, index)}
                    className={
                      "flex min-h-14 w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 " +
                      (active
                        ? "border-orange-400/50 bg-orange-500/10 text-white"
                        : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900 hover:text-white")
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                      <Icon
                        size={17}
                        className={
                          active ? "text-orange-300" : "text-slate-500"
                        }
                        aria-hidden="true"
                      />
                      <span className="truncate">{config.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ProgressWellnessOverview = ({
  headingRef,
  onBack,
  range = {},
  rangeControls,
  wellness = {},
}) => {
  const [activeKey, setActiveKey] = useState(() => initialMetricKey(wellness));
  const activeConfig =
    METRICS.find(({ key }) => key === activeKey) || METRICS[0];
  const activeSnapshot = metricSnapshot(wellness, activeConfig);
  const activeChartTitle = `Biểu đồ ${activeConfig.label.toLowerCase()}${
    activeConfig.kind === "qualitative" ? "" : ` (${activeConfig.unit})`
  }`;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm"
      aria-labelledby="wellness-progress-title"
      data-progress-section-card="wellness"
    >
      <ProgressSectionHeader
        title="Sức khỏe trung bình"
        titleId="wellness-progress-title"
        description="Theo dõi xu hướng từ những nhật ký sức khỏe đã gửi."
        headingRef={headingRef}
        onBack={onBack}
        rangeControls={rangeControls}
      />

      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <WellnessMetricSelector
          activeKey={activeConfig.key}
          onSelect={setActiveKey}
          wellness={wellness}
        />

        <div
          id="wellness-metric-panel"
          role="tabpanel"
          aria-labelledby="wellness-metric-panel-title"
          className="min-w-0 px-5 py-5 sm:px-6"
        >
          <h3
            id="wellness-metric-panel-title"
            className="text-base font-bold text-white"
          >
            {activeChartTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {activeSnapshot.hasValue
              ? activeConfig.kind === "qualitative"
                ? `Gần nhất: ${valueLabel(activeConfig, activeSnapshot.value)} vào ngày ${compactDateLabel(activeSnapshot.dateKey)}.`
                : `Trung bình ${valueLabel(activeConfig, activeSnapshot.value)} từ ${activeSnapshot.count} ngày ghi nhận.`
              : "Chưa có giá trị trong khoảng đang chọn."}
          </p>
          <WellnessMetricChart
            config={activeConfig}
            range={range}
            wellness={wellness}
          />
          {activeSnapshot.hasValue && (
            <aside className="mt-5 border-t border-slate-800 pt-4 text-sm leading-6 text-slate-400">
              <h4 className="font-semibold text-slate-200">
                Giải thích biểu đồ
              </h4>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  Biểu đồ chỉ hiển thị những ngày đã gửi dữ liệu.
                </li>
                {activeConfig.kind !== "qualitative" && (
                  <li>
                    Đường nét đứt thể hiện mức trung bình của những ngày có dữ
                    liệu.
                  </li>
                )}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
};

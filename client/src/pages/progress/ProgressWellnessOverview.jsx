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

import { ProgressSectionHeader } from "./ProgressSectionHeader";
import { WellnessMetricChart } from "./WellnessMetricChart";

const METRICS = [
  { key: "sleepHours", label: "Giấc ngủ", unit: "giờ", icon: Moon },
  { key: "waterMl", label: "Nước uống", unit: "ml", icon: Waves },
  { key: "steps", label: "Số bước", unit: "bước", icon: Footprints },
  {
    key: "energy",
    label: "Năng lượng",
    unit: "/10",
    icon: BatteryMedium,
    domain: [0, 10],
  },
  {
    key: "hunger",
    label: "Cảm giác đói",
    unit: "/10",
    icon: Utensils,
    domain: [0, 10],
  },
  {
    key: "stress",
    label: "Căng thẳng",
    unit: "/10",
    icon: Brain,
    domain: [0, 10],
  },
  {
    key: "soreness",
    label: "Đau mỏi",
    unit: "/10",
    icon: Activity,
    domain: [0, 10],
  },
  {
    key: "pain",
    label: "Mức đau",
    unit: "/10",
    icon: HeartPulse,
    domain: [0, 10],
  },
];

const formatNumber = (value) =>
  Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 });

const valueLabel = (value, unit) =>
  unit === "/10"
    ? `${formatNumber(value)}/10`
    : `${formatNumber(value)} ${unit}`;

const initialMetricKey = (wellness) =>
  METRICS.find(
    ({ key }) =>
      wellness?.[key]?.average !== null &&
      wellness?.[key]?.average !== undefined,
  )?.key || "sleepHours";

const WellnessMetricSelector = ({ activeKey, onSelect, wellness }) => {
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
      className="grid grid-cols-2 border-b border-slate-800 sm:grid-cols-4 xl:grid-cols-8"
      role="tablist"
      aria-label="Chỉ số sức khỏe"
    >
      {METRICS.map((config, index) => {
        const metric = wellness?.[config.key];
        const hasValue =
          metric?.average !== null && metric?.average !== undefined;
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
              "min-h-24 border-b-2 px-3 py-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400 " +
              (active
                ? "border-b-orange-400 bg-orange-500/5 text-white"
                : "border-b-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white")
            }
          >
            <span className="flex items-center gap-2 text-xs font-semibold">
              <Icon
                size={16}
                className={active ? "text-orange-300" : "text-slate-500"}
                aria-hidden="true"
              />
              {config.label}
            </span>
            <strong className="mt-2 block text-base font-bold tabular-nums text-white">
              {hasValue
                ? valueLabel(metric.average, config.unit)
                : "Chưa có dữ liệu"}
            </strong>
            <span className="mt-1 block text-xs text-slate-500">
              {hasValue
                ? `${metric.count || 0} ngày ghi nhận`
                : "Chưa ghi nhận"}
            </span>
          </button>
        );
      })}
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
  const activeMetric = wellness?.[activeConfig.key];
  const hasAverage =
    activeMetric?.average !== null && activeMetric?.average !== undefined;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm"
      aria-labelledby="wellness-progress-title"
      data-progress-section-card="wellness"
    >
      <ProgressSectionHeader
        title="Sức khỏe trung bình"
        titleId="wellness-progress-title"
        description="Theo dõi xu hướng từ những nhật ký đã gửi; ngày không ghi dữ liệu không bị tính thành 0."
        headingRef={headingRef}
        onBack={onBack}
        rangeControls={rangeControls}
      />

      <WellnessMetricSelector
        activeKey={activeConfig.key}
        onSelect={setActiveKey}
        wellness={wellness}
      />

      <div
        id="wellness-metric-panel"
        role="tabpanel"
        aria-labelledby={`wellness-metric-tab-${activeConfig.key}`}
        className="px-5 py-5 sm:px-6"
      >
        <h3 className="text-base font-bold text-white">
          Xu hướng {activeConfig.label.toLowerCase()}
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          {hasAverage
            ? `Trung bình ${valueLabel(activeMetric.average, activeConfig.unit)} từ ${activeMetric.count || 0} ngày ghi nhận.`
            : "Chưa có giá trị trong khoảng đang chọn."}
        </p>
        {activeConfig.domain && (
          <p className="mt-2 text-xs text-slate-500">
            Điểm cao hơn không phải lúc nào cũng tốt hơn.
          </p>
        )}
        <WellnessMetricChart
          config={activeConfig}
          range={range}
          wellness={wellness}
        />
      </div>
    </section>
  );
};

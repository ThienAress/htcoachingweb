import { useEffect, useId, useRef, useState } from "react";

import {
  wellnessSemanticLabel,
  wellnessSemanticValue,
} from "../../utils/wellnessSemantics";
import { buildWellnessMetricChartModel } from "./wellnessCharts";

const formatDate = (dateKey) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${dateKey}T12:00:00+07:00`));

const formatNumber = (config, value) =>
  Number(value).toLocaleString("vi-VN", {
    maximumFractionDigits: config.key === "sleepHours" ? 1 : 0,
  });

const valueLabel = (config, value) =>
  config.kind === "qualitative"
    ? wellnessSemanticLabel(config.key, value)
    : `${formatNumber(config, value)} ${config.unit}`;

const useChartWidth = () => {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const updateWidth = () => {
      const nextWidth = Math.round(element.getBoundingClientRect().width);
      if (nextWidth > 0) setWidth(nextWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { containerRef, width };
};

export const WellnessMetricChart = ({ config, range, wellness }) => {
  const { containerRef, width } = useChartWidth();
  const [activeDateKey, setActiveDateKey] = useState(null);
  const titleId = useId();
  const descriptionId = useId();
  const chart = buildWellnessMetricChartModel(
    (wellness?.daily || []).map((day) => ({
      dateKey: day.dateKey,
      value:
        config.kind === "qualitative"
          ? wellnessSemanticValue(config.key, day?.[config.key])
          : day?.[config.key],
    })),
    {
      startDateKey: range?.startDateKey,
      endDateKey: range?.endDateKey,
      width,
      domain: config.domain,
      includeAverage: config.kind !== "qualitative",
      tickValues: config.semanticOptions?.map(({ value }) => value),
      paddingLeft:
        config.kind === "qualitative" ? (width < 520 ? 122 : 136) : null,
    },
  );
  const activePoint = chart.measuredPoints.find(
    (point) => point.dateKey === activeDateKey,
  );

  if (chart.measuredPoints.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center border-y border-dashed border-slate-800 px-5 text-center text-sm text-slate-400">
        Chưa có dữ liệu {config.label.toLowerCase()} trong khoảng đang chọn.
      </div>
    );
  }

  const { dimensions } = chart;
  const axisLabel =
    config.kind === "qualitative"
      ? config.label
      : `${config.label} (${config.unit})`;

  return (
    <figure ref={containerRef} className="mt-5 min-w-0">
      <div className="relative">
        <svg
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="block min-h-[300px] w-full"
          role="group"
          aria-labelledby={`${titleId} ${descriptionId}`}
          data-wellness-metric-chart="true"
        >
          <title id={titleId}>{`Biểu đồ ${axisLabel.toLowerCase()}`}</title>
          <desc id={descriptionId}>
            {config.kind === "qualitative"
              ? "Mỗi điểm là trạng thái được chọn trong một nhật ký đã gửi."
              : "Mỗi điểm là một nhật ký đã gửi và đường nét đứt là mức trung bình."}
          </desc>
          <rect
            x={dimensions.padding.left}
            y={dimensions.padding.top}
            width={dimensions.plotWidth}
            height={dimensions.plotHeight}
            fill="none"
            className="stroke-slate-700"
            vectorEffect="non-scaling-stroke"
          />
          {chart.yTicks.map((tick) => (
            <g key={`${tick.value}-${tick.y}`}>
              <line
                x1={dimensions.padding.left}
                x2={dimensions.width - dimensions.padding.right}
                y1={tick.y}
                y2={tick.y}
                className="stroke-slate-800"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={dimensions.padding.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-slate-400 text-xs"
              >
                {config.kind === "qualitative"
                  ? wellnessSemanticLabel(config.key, tick.value)
                  : formatNumber(config, tick.value)}
              </text>
            </g>
          ))}
          {chart.average && (
            <>
              <line
                x1={dimensions.padding.left}
                x2={dimensions.width - dimensions.padding.right}
                y1={chart.average.y}
                y2={chart.average.y}
                className="stroke-cyan-400"
                strokeDasharray="5 5"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={dimensions.width - dimensions.padding.right - 5}
                y={Math.max(dimensions.padding.top + 14, chart.average.y - 7)}
                textAnchor="end"
                className="fill-cyan-300 text-xs"
              >
                Trung bình {valueLabel(config, chart.average.value)}
              </text>
            </>
          )}
          <path
            d={chart.path}
            fill="none"
            className="stroke-orange-400"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {chart.measuredPoints.map((point) => {
            const active = point.dateKey === activeDateKey;
            return (
              <g key={point.dateKey}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={active ? 8 : 5}
                  className={
                    active
                      ? "fill-orange-500 stroke-none drop-shadow-[0_0_8px_rgba(249,115,22,0.85)]"
                      : "fill-slate-950 stroke-orange-400"
                  }
                  strokeWidth={active ? 0 : 3}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="16"
                  fill="transparent"
                  role="button"
                  tabIndex="0"
                  aria-label={`${formatDate(point.dateKey)}: ${valueLabel(config, point.value)}`}
                  onPointerEnter={() => setActiveDateKey(point.dateKey)}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== "touch") setActiveDateKey(null);
                  }}
                  onFocus={() => setActiveDateKey(point.dateKey)}
                  onBlur={() => setActiveDateKey(null)}
                  onPointerDown={() => setActiveDateKey(point.dateKey)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActiveDateKey(point.dateKey);
                    }
                  }}
                  className="cursor-pointer focus:outline-none focus-visible:stroke-orange-300"
                />
              </g>
            );
          })}
          {chart.xTicks.map((tick) => (
            <text
              key={tick.dateKey}
              x={tick.x}
              y={dimensions.height - 28}
              textAnchor="middle"
              className="fill-slate-400 text-xs"
            >
              {tick.dateLabel}
            </text>
          ))}
        </svg>

        {activePoint && (
          <div
            role="tooltip"
            className="pointer-events-none absolute right-3 top-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs leading-5 text-slate-300 shadow-lg"
          >
            <time dateTime={activePoint.dateKey}>
              {formatDate(activePoint.dateKey)}
            </time>
            <strong className="block text-sm font-semibold text-white">
              {valueLabel(config, activePoint.value)}
            </strong>
          </div>
        )}
      </div>
    </figure>
  );
};

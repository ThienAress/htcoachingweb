import { useEffect, useId, useRef, useState } from "react";

import { buildBodyMetricChartModel } from "./progressCharts";

const formatDate = (dateKey) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${dateKey}T12:00:00+07:00`));

const formatNumber = (value) =>
  Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const valueLabel = (value, unit) =>
  unit === "%" ? `${formatNumber(value)}%` : `${formatNumber(value)} ${unit}`;

const signedDelta = (value, unit) => {
  const deltaUnit = unit === "%" ? "điểm %" : unit;
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(
    Math.abs(value),
  )} ${deltaUnit}`;
};

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

export const BodyMetricChart = ({ label, metric, range }) => {
  const { containerRef, width } = useChartWidth();
  const [activeDateKey, setActiveDateKey] = useState(null);
  const titleId = useId();
  const descriptionId = useId();
  const chart = buildBodyMetricChartModel(metric?.series || [], {
    startDateKey: range?.startDateKey,
    endDateKey: range?.endDateKey,
    width,
  });
  const activePoint = chart.measuredPoints.find(
    (point) => point.dateKey === activeDateKey,
  );
  const firstPoint = chart.measuredPoints[0];

  if (chart.measuredPoints.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center border-y border-dashed border-slate-800 px-5 text-center text-sm text-slate-400">
        Chưa có dữ liệu {label.toLowerCase()} trong khoảng đang chọn.
      </div>
    );
  }

  const { dimensions } = chart;
  const selectNearestPoint = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width),
    );
    const chartX = dimensions.padding.left + ratio * dimensions.plotWidth;
    const nearest = chart.measuredPoints.reduce((closest, point) =>
      Math.abs(point.x - chartX) < Math.abs(closest.x - chartX)
        ? point
        : closest,
    );
    setActiveDateKey(nearest.dateKey);
  };

  return (
    <figure ref={containerRef} className="mt-5 min-w-0">
      <div className="relative">
        <svg
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="block min-h-[300px] w-full"
          role="group"
          aria-labelledby={`${titleId} ${descriptionId}`}
          data-body-metric-chart="true"
        >
          <title id={titleId}>{`Biểu đồ xu hướng ${label.toLowerCase()}`}</title>
          <desc id={descriptionId}>
            Mỗi điểm là một báo cáo tuần đã gửi. Đường bị ngắt khi kỳ báo cáo
            không có số đo.
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
                {formatNumber(tick.value)}
              </text>
            </g>
          ))}
          <line
            x1={dimensions.padding.left}
            x2={dimensions.width - dimensions.padding.right}
            y1={chart.baseline.y}
            y2={chart.baseline.y}
            className="stroke-slate-500"
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={dimensions.width - dimensions.padding.right - 5}
            y={Math.max(dimensions.padding.top + 14, chart.baseline.y - 7)}
            textAnchor="end"
            className="fill-slate-400 text-xs"
          >
            Lần đầu {valueLabel(chart.baseline.value, metric.unit)}
          </text>
          <path
            d={chart.path}
            fill="none"
            className="stroke-orange-400"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {chart.measuredPoints.map((point) => (
            <g key={point.dateKey}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                className="fill-slate-950 stroke-orange-400"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="16"
                fill="transparent"
                role="button"
                tabIndex="0"
                aria-label={`${formatDate(point.dateKey)}: ${valueLabel(
                  point.value,
                  metric.unit,
                )}`}
                onFocus={() => setActiveDateKey(point.dateKey)}
                onBlur={() => setActiveDateKey(null)}
                onPointerDown={() => setActiveDateKey(point.dateKey)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveDateKey(point.dateKey);
                  }
                }}
                className="cursor-pointer focus:outline-none focus-visible:stroke-cyan-300"
              />
            </g>
          ))}
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
          <text
            x={dimensions.padding.left + dimensions.plotWidth / 2}
            y={dimensions.height - 6}
            textAnchor="middle"
            className="fill-slate-400 text-xs"
          >
            Kỳ báo cáo
          </text>
          <text
            transform={`translate(16 ${
              dimensions.padding.top + dimensions.plotHeight / 2
            }) rotate(-90)`}
            textAnchor="middle"
            className="fill-slate-400 text-xs"
          >
            {label} ({metric.unit})
          </text>
          <rect
            x={dimensions.padding.left}
            y={dimensions.padding.top}
            width={dimensions.plotWidth}
            height={dimensions.plotHeight}
            fill="transparent"
            onPointerMove={selectNearestPoint}
            onPointerDown={selectNearestPoint}
            onPointerLeave={(event) => {
              if (event.pointerType !== "touch") setActiveDateKey(null);
            }}
            aria-hidden="true"
          />
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
              {valueLabel(activePoint.value, metric.unit)}
            </strong>
            <span className="block text-slate-400">
              So với lần đầu: {signedDelta(
                activePoint.value - firstPoint.value,
                metric.unit,
              )}
            </span>
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-xs leading-5 text-slate-500">
        <span>
          Mỗi điểm dùng ngày bắt đầu kỳ báo cáo, không phải thời điểm đo chính
          xác.
        </span>
        <span>Khoảng trống là kỳ chưa có số đo.</span>
      </figcaption>
    </figure>
  );
};

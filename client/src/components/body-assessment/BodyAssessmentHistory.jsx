import { useEffect, useId, useRef, useState } from "react";
import { BODY_REGIONS, matchingReference, measurementHistory, measurementLabel } from "./bodyAssessment";

const fullDateLabel = (date) => new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
}).format(new Date(`${date}T12:00:00+07:00`));
const dayMonthLabel = (date) => new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
}).format(new Date(`${date}T12:00:00+07:00`));
const isMeasurement = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const pointId = (point, index) => `${point.dateKey}-${index}`;

const chartDomain = (values) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const padding = span === 0 ? Math.max(Math.abs(max) * 0.1, 1) : span * 0.1;
  const rough = (max - min + 2 * padding) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / magnitude;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
  return { min: Math.max(0, Math.floor((min - padding) / step) * step), max: Math.ceil((max + padding) / step) * step, step };
};

const axisTicks = ({ min, max, step }) => Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => min + step * index);

export const BodyAssessmentHistory = ({ items, region, field, unit, referenceSnapshot }) => {
  const titleId = useId();
  const chartRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(600);
  const [selectedYear, setSelectedYear] = useState("");
  const [hoverPointId, setHoverPointId] = useState("");
  useEffect(() => {
    const element = chartRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const resize = () => setChartWidth(Math.max(220, Math.min(600, element.clientWidth)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const ordered = items.filter((item) => item.published?.measuredDateKey)
    .toSorted((a, b) => a.published.measuredDateKey.localeCompare(b.published.measuredDateKey));
  const history = measurementHistory(ordered, region, field).map((point, index) => ({
    ...point,
    value: unit === "%" && !matchingReference(referenceSnapshot, ordered[index].published) ? null : point.value,
  }));
  const years = [...new Set(history.map((point) => point.dateKey.slice(0, 4)))].sort();
  const latestYear = years.at(-1) || "";
  const activeYear = years.includes(selectedYear) ? selectedYear : latestYear;
  const points = history.filter((point) => point.dateKey.startsWith(activeYear));
  const measured = points.filter((point) => isMeasurement(point.value));
  const regionLabel = BODY_REGIONS.find(([key]) => key === region)?.[1] || "Vùng đã chọn";
  const measureLabel = field.startsWith("lean") ? "khối cơ nạc" : "khối mỡ";
  const hovered = measured.find((point) => hoverPointId === pointId(point, points.indexOf(point)));
  const plot = { left: 58, right: chartWidth - 12, top: 26, bottom: 184 };
  const domain = measured.length ? chartDomain(measured.map(({ value }) => value)) : null;
  const ticks = domain ? axisTicks(domain) : [];
  const start = points.length ? Date.parse(points[0].dateKey) : 0;
  const end = points.length ? Date.parse(points.at(-1).dateKey) : 0;
  const x = (point) => end === start ? (plot.left + plot.right) / 2
    : plot.left + ((Date.parse(point.dateKey) - start) / (end - start)) * (plot.right - plot.left);
  const y = (point) => plot.bottom - ((point.value - domain.min) / (domain.max - domain.min)) * (plot.bottom - plot.top);
  const path = points.map((point, index) => {
    if (!isMeasurement(point.value)) return "";
    const command = index > 0 && isMeasurement(points[index - 1].value) ? "L" : "M";
    return `${command}${x(point)} ${y(point)}`;
  }).join(" ");

  return (
    <section aria-labelledby={titleId} className="mt-6 border-t border-slate-800 pt-5">
      <div className="flex max-w-[600px] flex-wrap items-center justify-between gap-3">
        <h3 id={titleId} className="text-base font-semibold text-slate-100">{regionLabel} — {measureLabel}</h3>
        {years.length > 0 && <select aria-label="Năm đo" value={activeYear} onChange={(event) => { setSelectedYear(event.target.value); setHoverPointId(""); }} className="min-h-11 shrink-0 rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30">
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>}
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-400">Ngày trên biểu đồ là ngày đo thực tế. Thiếu số đo tạo khoảng ngắt, không được xem là 0.</p>
      {unit === "%" && <p className="mt-1 text-xs leading-5 text-slate-400">Chỉ nối những kết quả cùng thiết bị và mức tham chiếu với lần đo đang xem.</p>}
      <div ref={chartRef} className="max-w-[600px]">
        {measured.length === 0 ? (
          <p className="py-6 text-sm text-slate-400">Chưa có số đo phù hợp cho vùng này trong năm {activeYear || "đã chọn"}.</p>
        ) : (
          <figure className="relative mt-4 min-w-0">
            <svg viewBox={`0 0 ${chartWidth} 232`} role="group" aria-label={`Lịch sử ${regionLabel.toLowerCase()} trong năm ${activeYear}, ${measured.length} điểm đo`} className="w-full">
              <text x={plot.left - 8} y="14" textAnchor="end" className="fill-slate-400 text-xs">{unit}</text>
              <rect x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} fill="none" className="stroke-slate-700" vectorEffect="non-scaling-stroke" />
              {ticks.map((tick) => {
                const tickY = plot.bottom - ((tick - domain.min) / (domain.max - domain.min)) * (plot.bottom - plot.top);
                return <g key={tick}>
                  <line x1={plot.left} x2={plot.right} y1={tickY} y2={tickY} className="stroke-slate-800" />
                  <text x={plot.left - 8} y={tickY + 4} textAnchor="end" className="fill-slate-400 text-xs">{measurementLabel(tick, "")}</text>
                </g>;
              })}
              <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className="stroke-slate-700" />
              <line data-axis="y" x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} className="stroke-slate-400" />
              <path d={path} fill="none" className="stroke-orange-400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {points.map((point, index) => isMeasurement(point.value) && <g key={pointId(point, index)} role="button" tabIndex="0" aria-label={`${fullDateLabel(point.dateKey)}: ${measurementLabel(point.value, unit)}`} onPointerEnter={() => setHoverPointId(pointId(point, index))} onPointerLeave={(event) => { if (event.pointerType !== "touch") setHoverPointId(""); }} onFocus={() => setHoverPointId(pointId(point, index))} onBlur={() => setHoverPointId("")} onClick={() => setHoverPointId(pointId(point, index))} onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setHoverPointId(pointId(point, index));
                }
              }} className="group cursor-pointer focus:outline-none">
                <circle cx={x(point)} cy={y(point)} r="22" fill="transparent" className="group-focus-visible:stroke-orange-300" />
                <circle cx={x(point)} cy={y(point)} r={hovered === point ? "8" : "5"} className={hovered === point ? "fill-orange-500 stroke-none" : "fill-slate-950 stroke-orange-400"} strokeWidth="3" vectorEffect="non-scaling-stroke" />
              </g>)}
              <text x={plot.left} y="208" className="fill-slate-400 text-xs">{dayMonthLabel(points[0].dateKey)}</text>
              {points.length > 1 && <text x={plot.right} y="208" textAnchor="end" className="fill-slate-400 text-xs">{dayMonthLabel(points.at(-1).dateKey)}</text>}
            </svg>
            {hovered && <div role="tooltip" className="pointer-events-none absolute right-3 top-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs leading-5 text-slate-300 shadow-lg"><time dateTime={hovered.dateKey}>{fullDateLabel(hovered.dateKey)}</time><strong className="block text-sm font-semibold text-white">{measurementLabel(hovered.value, unit)}</strong></div>}
            {measured.length === 1 && <figcaption className="mt-2 text-sm text-slate-400">Mới có một điểm đo phù hợp, chưa có xu hướng.</figcaption>}
          </figure>
        )}
      </div>
    </section>
  );
};

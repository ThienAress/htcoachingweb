import {
  ChevronLeft,
  ChevronRight,
  Footprints,
  HeartPulse,
  Moon,
  Waves,
} from "lucide-react";
import { useMemo, useState } from "react";

import { addDaysToDateKey, getVietnamDateKey } from "../../utils/vietnamDate";
import { wellnessScoreRows } from "./progressCharts";

const FOUNDATIONS = [
  { key: "sleepHours", label: "Giấc ngủ", unit: "giờ", icon: Moon },
  { key: "waterMl", label: "Nước uống", unit: "ml", icon: Waves },
  { key: "steps", label: "Số bước", unit: "bước", icon: Footprints },
];
const SCORE_KEYS = ["energy", "hunger", "stress", "soreness", "pain"];

const formatValue = (value) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);

const formatDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return "Ngày đã chọn";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
};

const dayMetrics = (day) =>
  Object.fromEntries(
    [...FOUNDATIONS.map(({ key }) => key), ...SCORE_KEYS].map((key) => {
      const value = day?.[key];
      const available = typeof value === "number" && Number.isFinite(value);
      return [key, { average: available ? value : null, count: available ? 1 : 0 }];
    }),
  );

export const ProgressWellnessOverview = ({
  wellness = {},
  range = {},
  dateKey = getVietnamDateKey(),
}) => {
  const startDateKey = range.startDateKey || dateKey;
  const endDateKey = range.endDateKey || dateKey;
  const initialDateKey =
    dateKey < startDateKey
      ? startDateKey
      : dateKey > endDateKey
        ? endDateKey
        : dateKey;
  const [mode, setMode] = useState("day");
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);

  const selectedDay = useMemo(
    () => wellness.daily?.find((item) => item.dateKey === selectedDateKey),
    [selectedDateKey, wellness.daily],
  );
  const displayedWellness = mode === "overview" ? wellness : dayMetrics(selectedDay);
  const scoreRows = wellnessScoreRows(displayedWellness);
  const hasScoreData = scoreRows.some((row) => row.average !== null);
  const canGoPrevious = selectedDateKey > startDateKey;
  const canGoNext = selectedDateKey < endDateKey;

  const moveDate = (amount) => {
    setMode("day");
    setSelectedDateKey((current) => addDaysToDateKey(current, amount));
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <HeartPulse className="mt-0.5 text-orange-400" size={22} aria-hidden="true" />
          <div>
            <h2 className="font-bold text-white">
              {mode === "overview"
                ? "Sức khỏe trung bình"
                : `Sức khỏe ngày ${formatDateKey(selectedDateKey)}`}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {mode === "overview"
                ? "Tổng hợp những ngày có nhật ký đã gửi; ô trống không bị tính thành 0."
                : selectedDay
                  ? "Chỉ số thực tế của đúng ngày này, không cộng với ngày khác."
                  : "Ngày này chưa có nhật ký wellness đã gửi."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Chế độ xem sức khỏe">
          <button
            type="button"
            onClick={() => setMode("overview")}
            aria-pressed={mode === "overview"}
            className={
              "min-h-11 rounded-lg border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 " +
              (mode === "overview"
                ? "border-orange-400 bg-orange-500/10 text-orange-200"
                : "border-slate-700 text-slate-400 hover:bg-slate-900")
            }
          >
            Tổng quan
          </button>
          <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => moveDate(-1)}
              disabled={!canGoPrevious}
              aria-label="Xem sức khỏe ngày trước"
              className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setMode("day")}
              aria-pressed={mode === "day"}
              className={
                "min-h-9 min-w-28 rounded-md px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 " +
                (mode === "day"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800")
              }
            >
              {selectedDateKey === getVietnamDateKey()
                ? "Hôm nay"
                : formatDateKey(selectedDateKey)}
            </button>
            <button
              type="button"
              onClick={() => moveDate(1)}
              disabled={!canGoNext}
              aria-label="Xem sức khỏe ngày sau"
              className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid divide-y divide-slate-800 border-y border-slate-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {FOUNDATIONS.map(({ key, label, unit, icon: Icon }) => {
          const metric = displayedWellness?.[key] || { average: null, count: 0 };
          return (
            <div key={key} className="py-4 sm:px-4 sm:first:pl-0 sm:last:pr-0">
              <dt className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Icon size={15} aria-hidden="true" /> {label}
              </dt>
              <dd className="mt-2 text-xl font-bold text-white">
                {metric.average === null
                  ? "Chưa có dữ liệu"
                  : `${formatValue(metric.average)} ${unit}`}
              </dd>
              {mode === "overview" && (
                <dd className="mt-1 text-xs text-slate-500">
                  {metric.count || 0} ngày ghi nhận
                </dd>
              )}
            </div>
          );
        })}
      </dl>

      <figure className="mt-5" aria-labelledby="wellness-score-chart-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 id="wellness-score-chart-title" className="text-sm font-semibold text-slate-200">
            Chỉ số sức khỏe theo thang 0–10
          </h3>
          <p className="text-xs text-slate-500">Điểm cao hơn không phải lúc nào cũng tốt hơn.</p>
        </div>
        <div className="mt-4 space-y-4">
          {scoreRows.map((row) => {
            const hasData = row.average !== null;
            return (
              <div key={row.key} className="grid gap-2 sm:grid-cols-[130px_1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-medium text-slate-200">{row.label}</p>
                  <p className="text-xs text-slate-500">
                    {hasData
                      ? mode === "overview"
                        ? `${row.count} ngày ghi nhận`
                        : "Giá trị ngày này"
                      : "Chưa ghi nhận"}
                  </p>
                </div>
                {hasData ? (
                  <progress
                    value={row.average}
                    max="10"
                    className={`h-2 w-full ${row.color}`}
                    aria-label={`${row.label}: ${formatValue(row.average)} trên 10`}
                  />
                ) : (
                  <div className="h-2 w-full rounded-full bg-slate-800" aria-hidden="true" />
                )}
                <p className={hasData ? "text-sm font-bold text-white" : "text-sm text-slate-500"}>
                  {hasData ? `${formatValue(row.average)}/10` : "Chưa có dữ liệu"}
                </p>
              </div>
            );
          })}
        </div>
        <figcaption className="mt-4 text-xs leading-5 text-slate-500">
          {hasScoreData
            ? mode === "overview"
              ? "Thanh biểu diễn trung bình của các nhật ký đã gửi trong khoảng đang chọn."
              : "Mỗi thanh chỉ biểu diễn dữ liệu của ngày đang chọn."
            : "Chưa có chỉ số thang điểm cho chế độ xem này."}
        </figcaption>
      </figure>
    </section>
  );
};

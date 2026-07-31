import { Footprints, HeartPulse, Moon, Waves } from "lucide-react";

import { wellnessScoreRows } from "./progressCharts";

const FOUNDATIONS = [
  { key: "sleepHours", label: "Giấc ngủ", unit: "giờ", icon: Moon },
  { key: "waterMl", label: "Nước uống", unit: "ml", icon: Waves },
  { key: "steps", label: "Số bước", unit: "bước", icon: Footprints },
];

const formatAverage = (value) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);

export const ProgressWellnessOverview = ({ wellness = {} }) => {
  const scoreRows = wellnessScoreRows(wellness);
  const hasScoreData = scoreRows.some((row) => row.average !== null);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <HeartPulse className="text-orange-400" size={22} aria-hidden="true" />
        <div>
          <h2 className="font-bold text-white">Sức khỏe trung bình</h2>
          <p className="mt-1 text-sm text-slate-400">
            Chỉ tính những ngày bạn có ghi nhận; ô trống không bị tính thành 0.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid divide-y divide-slate-800 border-y border-slate-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {FOUNDATIONS.map(({ key, label, unit, icon: Icon }) => {
          const metric = wellness?.[key] || { average: null, count: 0 };
          return (
            <div key={key} className="py-4 sm:px-4 sm:first:pl-0 sm:last:pr-0">
              <dt className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Icon size={15} aria-hidden="true" /> {label}
              </dt>
              <dd className="mt-2 text-xl font-bold text-white">
                {metric.average === null
                  ? "Chưa có dữ liệu"
                  : formatAverage(metric.average) + " " + unit}
              </dd>
              <dd className="mt-1 text-xs text-slate-500">
                {metric.count || 0} ngày ghi nhận
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Giấc ngủ, nước uống và số bước có đơn vị riêng nên không gộp chung vào
        biểu đồ thang điểm.
      </p>

      <figure className="mt-5" aria-labelledby="wellness-score-chart-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3
            id="wellness-score-chart-title"
            className="text-sm font-semibold text-slate-200"
          >
            Biểu đồ sức khỏe theo thang 0–10
          </h3>
          <p className="text-xs text-slate-500">
            Điểm cao hơn không phải lúc nào cũng tốt hơn.
          </p>
        </div>
        <div className="mt-4 space-y-4">
          {scoreRows.map((row) => {
            const hasData = row.average !== null;
            return (
              <div
                key={row.key}
                className="grid gap-2 sm:grid-cols-[130px_1fr_auto] sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-slate-200">{row.label}</p>
                  <p className="text-xs text-slate-500">
                    {hasData ? row.count + " ngày ghi nhận" : "Chưa ghi nhận"}
                  </p>
                </div>
                {hasData ? (
                  <progress
                    value={row.average}
                    max="10"
                    className={"h-2 w-full " + row.color}
                    aria-label={
                      row.label +
                      ": " +
                      formatAverage(row.average) +
                      " trên 10"
                    }
                  />
                ) : (
                  <div
                    className="h-2 w-full rounded-full bg-slate-800"
                    aria-hidden="true"
                  />
                )}
                <p
                  className={
                    hasData
                      ? "text-sm font-bold text-white"
                      : "text-sm text-slate-500"
                  }
                >
                  {hasData ? (
                    <>
                      {formatAverage(row.average)}
                      <span className="text-xs font-normal text-slate-500">
                        /10
                      </span>
                    </>
                  ) : (
                    "Chưa có dữ liệu"
                  )}
                </p>
              </div>
            );
          })}
        </div>
        <figcaption className="mt-4 text-xs leading-5 text-slate-500">
          {hasScoreData
            ? "Chiều dài mỗi thanh thể hiện mức trung bình từ các nhật ký đã gửi."
            : "Chưa có nhật ký đã gửi trong khoảng này; khung biểu đồ được giữ lại để bạn biết dữ liệu sẽ xuất hiện ở đâu."}
        </figcaption>
      </figure>
    </section>
  );
};
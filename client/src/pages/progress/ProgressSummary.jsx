import { Activity, Scale } from "lucide-react";
import {
  progressMetricRows,
  summarizeProgressAvailability,
} from "./progressPresentation";

const WELLNESS = {
  sleepHours: ["Giấc ngủ", "giờ"],
  waterMl: ["Nước", "ml"],
  steps: ["Số bước", "bước"],
  energy: ["Năng lượng", "/10"],
  hunger: ["Đói", "/10"],
  stress: ["Căng thẳng", "/10"],
  soreness: ["Đau mỏi", "/10"],
  pain: ["Mức đau", "/10"],
};

const MetricGrid = ({ compliance }) => {
  const rows = progressMetricRows(compliance);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <Activity className="text-orange-400" size={22} aria-hidden="true" />
        <div>
          <h2 className="font-bold text-white">Mức độ thực hiện</h2>
          <p className="mt-1 text-sm text-slate-400">
            Chỉ tính những lịch, kế hoạch và habit thực sự áp dụng.
          </p>
        </div>
      </div>
      <div className="mt-5 divide-y divide-slate-800 border-y border-slate-800">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-2 py-4 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_auto] sm:items-center sm:gap-4"
          >
            <h3 className="text-sm font-semibold text-slate-200">
              {row.label}
            </h3>
            {row.percent === null ? (
              <p className="text-xs text-slate-500">
                Chưa có assignment trong khoảng này.
              </p>
            ) : (
              <progress
                value={row.percent}
                max="100"
                className="h-2 w-full accent-orange-500"
                aria-label={row.label + ": " + row.displayPercent}
              />
            )}
            <p className="text-sm font-semibold text-orange-300">
              {row.displayPercent}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {row.numerator}/{row.denominator}
              </span>
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">
            Bảng số liệu thay thế cho biểu đồ mức độ thực hiện
          </caption>
          <thead className="border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-3 py-3 font-medium">Chỉ số</th>
              <th className="px-3 py-3 font-medium">Hoàn thành</th>
              <th className="px-3 py-3 font-medium">Áp dụng</th>
              <th className="px-3 py-3 font-medium">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-slate-900">
                <th className="px-3 py-3 font-medium text-slate-200">
                  {row.label}
                </th>
                <td className="px-3 py-3 text-slate-300">{row.numerator}</td>
                <td className="px-3 py-3 text-slate-300">{row.denominator}</td>
                <td className="px-3 py-3 text-slate-300">
                  {row.displayPercent}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const WellnessTable = ({ wellness }) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
    <h2 className="font-bold text-white">Trung bình wellness</h2>
    <p className="mt-1 text-sm text-slate-400">
      Giá trị trống được bỏ qua, không quy đổi thành 0.
    </p>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <caption className="sr-only">Trung bình wellness theo nhật ký ngày</caption>
        <thead className="border-b border-slate-800 text-slate-400">
          <tr>
            <th className="px-3 py-3 font-medium">Chỉ số</th>
            <th className="px-3 py-3 font-medium">Trung bình</th>
            <th className="px-3 py-3 font-medium">Số ngày ghi</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(WELLNESS).map(([key, [label, unit]]) => {
            const metric = wellness?.[key] || { average: null, count: 0 };
            return (
              <tr key={key} className="border-b border-slate-900">
                <th className="px-3 py-3 font-medium text-slate-200">{label}</th>
                <td className="px-3 py-3 text-slate-300">
                  {metric.average === null
                    ? "Chưa có dữ liệu"
                    : metric.average + " " + unit}
                </td>
                <td className="px-3 py-3 text-slate-300">{metric.count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
);

const WeightTrend = ({ trend }) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
    <div className="flex items-center gap-3">
      <Scale className="text-orange-400" size={22} aria-hidden="true" />
      <div>
        <h2 className="font-bold text-white">Xu hướng cân nặng tuần</h2>
        <p className="mt-1 text-sm text-slate-400">
          Dựa trên Weekly Check-in đã gửi; không phải kết luận y khoa.
        </p>
      </div>
    </div>
    {trend.points.length === 0 ? (
      <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
        Chưa có cân nặng từ Weekly Check-in trong khoảng này.
      </p>
    ) : (
      <>
        <p className="mt-5 text-sm text-slate-300">
          Thay đổi trong khoảng:{" "}
          <strong className="text-white">
            {trend.changeKg === null
              ? "Cần ít nhất 2 tuần"
              : (trend.changeKg > 0 ? "+" : "") + trend.changeKg + " kg"}
          </strong>
        </p>
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
              {trend.points.map((point) => (
                <tr
                  key={point.weekStartDateKey}
                  className="border-b border-slate-900"
                >
                  <td className="px-3 py-3 text-slate-300">
                    {point.weekStartDateKey}
                  </td>
                  <td className="px-3 py-3 font-medium text-white">
                    {point.weightKg} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}
  </section>
);

export const ProgressSummary = ({ progress }) => (
  <div className="space-y-4">
    {!summarizeProgressAvailability(progress) && (
      <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-5 text-sm text-slate-400">
        Chưa có dữ liệu trong khoảng này. Các chỉ số sẽ xuất hiện khi bạn có
        lịch hoặc ghi nhật ký.
      </p>
    )}
    <MetricGrid compliance={progress.compliance} />
    <div className="grid gap-4 lg:grid-cols-2">
      <WellnessTable wellness={progress.wellness} />
      <WeightTrend trend={progress.weightTrend} />
    </div>
  </div>
);

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { aiUsageReportQueryOptions } from "../../../queries/serviceAccessPolicy.queries";

const OPERATION_LABELS = {
  chat: "Câu hỏi thường",
  chat_image: "Câu hỏi kèm ảnh",
  chat_smart_search: "Bật Tìm kiếm thông minh",
  meal_scan: "Meal Scan",
};
const DAY_OPTIONS = [7, 30, 90];

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const COUNT = new Intl.NumberFormat("vi-VN");

const formatUsd = (value) => (Number.isFinite(value) ? USD.format(value) : "—");

export default function AiUsageCostTable() {
  const [days, setDays] = useState(7);
  const report = useQuery(aiUsageReportQueryOptions(days));

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Khoảng thời gian">
        {DAY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDays(option)}
            aria-pressed={days === option}
            className={`min-h-9 rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
              days === option
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {option} ngày
          </button>
        ))}
      </div>

      {report.isPending && <p className="text-sm text-zinc-600">Đang tải số liệu chi phí...</p>}

      {report.isError && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-rose-700" role="alert">
          Không thể tải báo cáo chi phí AI.
          <button
            type="button"
            onClick={() => report.refetch()}
            className="min-h-9 rounded-full border border-rose-300 px-3 font-semibold hover:bg-rose-50"
          >
            Thử lại
          </button>
        </div>
      )}

      {report.data && report.data.overall.count === 0 && (
        <p className="text-sm text-zinc-600">Chưa có lượt AI nào trong {days} ngày qua.</p>
      )}

      {report.data && report.data.overall.count > 0 && (
        <>
          <p className="text-sm text-zinc-700">
            {COUNT.format(report.data.overall.count)} lượt · tổng ước tính{" "}
            <strong>{formatUsd(report.data.overall.totalCostUsd)}</strong> · trung bình{" "}
            {formatUsd(report.data.overall.avgCostUsd)}/lượt
            {report.data.truncated && " · chỉ tính 50.000 lượt gần nhất"}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-zinc-100 text-zinc-700">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Thao tác</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Số lượt</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Trung bình</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">p95</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Tổng</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Lần gọi Brave</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 tabular-nums">
                {report.data.byOperation.map((row) => (
                  <tr key={row.operation}>
                    <th scope="row" className="px-4 py-3 font-medium text-zinc-900">
                      {OPERATION_LABELS[row.operation] || row.operation}
                    </th>
                    <td className="px-4 py-3 text-right">{COUNT.format(row.count)}</td>
                    <td className="px-4 py-3 text-right">{formatUsd(row.avgCostUsd)}</td>
                    <td className="px-4 py-3 text-right">{formatUsd(row.p95CostUsd)}</td>
                    <td className="px-4 py-3 text-right">{formatUsd(row.totalCostUsd)}</td>
                    <td className="px-4 py-3 text-right">
                      {COUNT.format(row.braveContextCalls + row.braveImageCalls)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs leading-5 text-zinc-500">
        Chi phí là ước tính theo đơn giá cấu hình trên server, không thay hóa đơn của DeepSeek, Gemini hay Brave.
      </p>
    </div>
  );
}

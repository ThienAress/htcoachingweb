import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileDown, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";

import { communityFeatureReportQueryOptions } from "../../../queries/serviceAccessPolicy.queries";
import { downloadCommunityFeatureReportPdf } from "../../../services/serviceAccessPolicy.service";
import {
  formatCommunityFeatureDate,
  getCommunityFeatureHistoryDateRange,
} from "./serviceAccessPolicyPresentation";

const downloadBlob = (response, filename) => {
  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

const SummaryItem = ({ label, value }) => (
  <div className="px-4 py-3 sm:px-5">
    <dt className="text-xs font-medium text-zinc-500">{label}</dt>
    <dd className="mt-1 text-lg font-bold text-zinc-950">{value}</dd>
  </div>
);

export default function CommunityFeatureReportToolbar({
  catalog,
  selectedGroup,
  selectedAudience,
}) {
  const initialRange = getCommunityFeatureHistoryDateRange(catalog?.items);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [status, setStatus] = useState("all");
  const invalidRange = Boolean(from && to && from > to);
  const filters = {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    group: selectedGroup || "all",
    audience: selectedAudience || "all",
    status,
  };
  const reportQuery = useQuery(
    communityFeatureReportQueryOptions(filters, !invalidRange),
  );
  const downloadMutation = useMutation({
    mutationFn: () => downloadCommunityFeatureReportPdf(filters),
    onSuccess: (response) => {
      const range = from && to ? `${from}-den-${to}` : "toan-bo-lich-su";
      downloadBlob(response, `bao-cao-cai-tien-${range}.pdf`);
      toast.success("Đã tạo báo cáo cải tiến PDF");
    },
    onError: (error) =>
      toast.error(
        error.response?.data?.message || "Không thể tải báo cáo PDF",
      ),
  });
  const summary = reportQuery.data?.summary;
  const statuses = Array.isArray(catalog?.reportOptions?.statuses)
    ? catalog.reportOptions.statuses
    : [];
  const timeline = Array.isArray(reportQuery.data?.timeline)
    ? reportQuery.data.timeline
    : [];
  const visibleTimeline = timeline.slice(-7).reverse();

  return (
    <section
      className="border-b border-zinc-200 bg-white"
      aria-labelledby="community-feature-report-title"
    >
      <div className="flex flex-col gap-4 px-5 py-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <h3
            id="community-feature-report-title"
            className="text-base font-bold text-zinc-950"
          >
            Báo cáo lịch sử cải tiến
          </h3>
          <p className="mt-1 text-sm leading-5 text-zinc-600">
            Thống kê và tải PDF từ cùng lịch sử canonical. Báo cáo dùng bộ lọc
            “Nhóm” và “Đối tượng” ở phía trên.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[700px]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
              Từ ngày
            </span>
            <input
              name="community-feature-report-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors hover:border-zinc-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
              Đến ngày
            </span>
            <input
              name="community-feature-report-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors hover:border-zinc-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
              Trạng thái
            </span>
            <select
              name="community-feature-report-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors hover:border-zinc-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/20"
            >
              <option value="all">Tất cả trạng thái</option>
              {statuses.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {invalidRange && (
        <p className="mx-5 mb-4 text-sm font-medium text-rose-700" role="alert">
          “Từ ngày” phải sớm hơn hoặc bằng “Đến ngày”.
        </p>
      )}

      <div className="border-t border-zinc-200 bg-zinc-50">
        {invalidRange ? (
          <p className="px-5 py-5 text-sm text-zinc-600">
            Chọn lại khoảng ngày để xem thống kê.
          </p>
        ) : reportQuery.isPending ? (
          <p className="px-5 py-5 text-sm text-zinc-600" role="status">
            Đang thống kê lịch sử cải tiến...
          </p>
        ) : reportQuery.isError ? (
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-sm font-medium text-rose-800">
              Không thể tải thống kê. Vui lòng thử lại.
            </p>
            <button
              type="button"
              onClick={() => reportQuery.refetch()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Thử lại
            </button>
          </div>
        ) : summary ? (
          <dl className="grid divide-y divide-zinc-200 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
            <SummaryItem label="Tính năng cập nhật" value={summary.featureCount} />
            <SummaryItem label="Hạng mục trong kỳ" value={summary.improvementCount} />
            <SummaryItem
              label="Đã xác minh production"
              value={summary.productionVerifiedCount}
            />
            <SummaryItem label="F0 còn mở" value={summary.openF0Count} />
            <SummaryItem
              label="Cập nhật gần nhất"
              value={formatCommunityFeatureDate(summary.latestDate)}
            />
          </dl>
        ) : null}
      </div>

      {!invalidRange && reportQuery.isSuccess && (
        <div className="border-t border-zinc-200 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h4 className="text-sm font-bold text-zinc-900">
              Cập nhật theo ngày
            </h4>
            {timeline.length > visibleTimeline.length && (
              <p className="text-xs text-zinc-500">
                Hiển thị 7 ngày gần nhất; PDF chứa toàn bộ kỳ báo cáo.
              </p>
            )}
          </div>
          {visibleTimeline.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Không có hạng mục cải tiến trong bộ lọc hiện tại.
            </p>
          ) : (
            <ol className="mt-3 divide-y divide-zinc-200">
              {visibleTimeline.map((day) => (
                <li
                  key={day.date}
                  className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[110px_minmax(0,1fr)]"
                >
                  <time
                    dateTime={day.date}
                    className="text-sm font-bold text-emerald-800"
                  >
                    {formatCommunityFeatureDate(day.date)}
                  </time>
                  <ul className="space-y-3">
                    {day.features.map((feature) => (
                      <li key={feature.featureKey}>
                        <p className="text-sm font-semibold text-zinc-900">
                          {feature.featureLabel}
                          <span className="ml-2 font-normal text-zinc-500">
                            {feature.improvementCount} hạng mục
                          </span>
                        </p>
                        <ul className="mt-1 space-y-1 text-xs leading-5 text-zinc-600">
                          {feature.improvements.map((improvement) => (
                            <li key={improvement.eventKey}>
                              {improvement.opportunity}
                              <span className="ml-1 font-semibold text-zinc-800">
                                · {improvement.status.label}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-zinc-500">
          PDF gồm 6 cột lịch sử và chỉ chứa các hạng mục phù hợp bộ lọc hiện tại.
        </p>
        <button
          type="button"
          onClick={() => downloadMutation.mutate()}
          disabled={
            invalidRange ||
            reportQuery.isPending ||
            reportQuery.isError ||
            downloadMutation.isPending
          }
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
        >
          <FileDown className="size-4" aria-hidden="true" />
          {downloadMutation.isPending
            ? "Đang tạo PDF..."
            : "Tải báo cáo cải tiến PDF"}
        </button>
      </div>

      {downloadMutation.isError && (
        <p className="px-5 pb-4 text-sm font-medium text-rose-700" role="alert">
          Không thể tải PDF lúc này. Vui lòng thử lại.
        </p>
      )}
    </section>
  );
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpenText,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getTrainerClientOverview } from "../../services/trainerOverview.service";
import { purgeTrainerPrivateQueries } from "../../utils/trainerPrivateCache";
import { ProgressSummary } from "../progress/ProgressSummary";
import {
  normalizeProgressDaysForSection,
  progressRangeLabel,
  progressRangeOptions,
} from "../progress/progressPresentation";
import { CoachingCommentThread } from "../today-dashboard/CoachingCommentThread";
import { wellnessSemanticLabel } from "../today-dashboard/wellness";
import { TrainerAttentionPanel } from "./TrainerAttentionPanel";
import { TrainerWeeklyReview } from "./TrainerWeeklyReview";
import { todayStatusLabel } from "./trainerOverviewPresentation";

const formatJournalDate = (dateKey) => {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return "ngày đã chọn";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
};

const formatNumber = (value) =>
  Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 });

export const TrainerJournalSummary = ({ dateKey, journal, sectionRef }) => {
  const isSubmitted = journal?.status === "submitted";
  const wellness = journal?.wellness || {};
  const metrics = [
    {
      key: "sleepHours",
      label: "Giấc ngủ",
      value:
        Number.isFinite(wellness.sleepHours) && wellness.sleepHours >= 0
          ? `${formatNumber(wellness.sleepHours)} giờ`
          : "Chưa ghi",
    },
    {
      key: "waterMl",
      label: "Nước uống",
      value:
        Number.isFinite(wellness.waterMl) && wellness.waterMl >= 0
          ? `${formatNumber(wellness.waterMl)} ml`
          : "Chưa ghi",
    },
    {
      key: "steps",
      label: "Số bước",
      value:
        Number.isFinite(wellness.steps) && wellness.steps >= 0
          ? formatNumber(wellness.steps)
          : "Chưa ghi",
    },
    ...[
      ["energy", "Năng lượng"],
      ["hunger", "Cảm giác đói"],
      ["stress", "Căng thẳng"],
      ["soreness", "Đau mỏi"],
      ["pain", "Mức đau"],
    ].map(([key, label]) => ({
      key,
      label,
      value: Number.isFinite(wellness[key])
        ? wellnessSemanticLabel(key, wellness[key])
        : "Chưa ghi",
    })),
  ];

  return (
    <section
      id="journal"
      ref={sectionRef}
      tabIndex={-1}
      className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-950 p-5 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:p-6"
      aria-labelledby="trainer-journal-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
            <BookOpenText size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="trainer-journal-title" className="font-bold text-white">
              Nhật ký ngày {formatJournalDate(dateKey)}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Thông tin khách hàng đã chia sẻ với HLV.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
          {isSubmitted ? "Đã gửi" : "Chưa gửi"}
        </span>
      </div>

      {!isSubmitted ? (
        <p className="mt-5 border-t border-slate-800 pt-4 text-sm text-slate-400">
          Chưa có nhật ký đã gửi cho ngày này.
        </p>
      ) : (
        <>
          <dl className="mt-5 grid border-y border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.key}
                className="border-b border-slate-800 py-3 sm:px-3 sm:first:pl-0"
              >
                <dt className="text-xs font-semibold text-slate-500">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-200">
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-slate-500">
              Ghi chú chia sẻ
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              {journal.notes?.shared || "Khách hàng chưa chia sẻ ghi chú."}
            </p>
          </div>
        </>
      )}
    </section>
  );
};

export const TrainerWeeklyReviewAnchor = ({ sectionRef, children }) => (
  <div
    id="weekly-report"
    ref={sectionRef}
    tabIndex={-1}
    className="scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
  >
    {children}
  </div>
);

export const TrainerClientOverview = ({ clientId, dateKey }) => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [days, setDays] = useState(30);
  const [activeProgressSection, setActiveProgressSection] = useState(null);
  const purgedForbiddenKeyRef = useRef(null);
  const journalAnchorRef = useRef(null);
  const weeklyAnchorRef = useRef(null);
  const queryKey = ["trainer-client-overview", clientId, dateKey, days];
  const progressRanges = progressRangeOptions(activeProgressSection);
  const handleProgressSectionChange = (section) => {
    setDays((current) => normalizeProgressDaysForSection(section, current));
    setActiveProgressSection(section);
  };
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await getTrainerClientOverview(clientId, {
          dateKey,
          days,
        })
      ).data.data,
    enabled: Boolean(clientId && dateKey),
    staleTime: 20_000,
    gcTime: 0,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });
  const accessRevoked = query.error?.response?.status === 403;
  useEffect(() => {
    if (!accessRevoked) {
      if (query.isSuccess) purgedForbiddenKeyRef.current = null;
      return;
    }
    const forbiddenKey = [clientId, dateKey, days].join(":");
    if (purgedForbiddenKeyRef.current === forbiddenKey) return;
    purgedForbiddenKeyRef.current = forbiddenKey;
    queryClient.removeQueries({
      queryKey: ["trainer-client-overview"],
      type: "inactive",
    });
    void purgeTrainerPrivateQueries(queryClient, { type: "inactive" });
  }, [accessRevoked, clientId, dateKey, days, query.isSuccess, queryClient]);

  useEffect(() => {
    if (!query.isSuccess) return undefined;
    const targetRef =
      location.hash === "#journal"
        ? journalAnchorRef
        : location.hash === "#weekly-report"
          ? weeklyAnchorRef
          : null;
    if (!targetRef?.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      targetRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, query.isSuccess, clientId, dateKey]);

  const setWeekly = (weeklyCheckin) => {
    queryClient.setQueryData(queryKey, (current) =>
      current ? { ...current, weeklyCheckin } : current,
    );
    void queryClient.invalidateQueries({ queryKey: ["progress"] });
  };

  const today = query.data?.today;
  const journal = today?.sections?.journal?.day;
  const coaching = today?.sections?.coaching?.day;

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20">
            <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">Hôm nay và tiến trình</h2>
            <p className="text-xs text-gray-400 mt-0.5">Theo dõi kết quả luyện tập</p>
          </div>
        </div>
      </div>

      <div>
        {query.isLoading ? (
          <div className="space-y-3" role="status">
            <span className="sr-only">Đang tải tổng quan khách hàng...</span>
            <div className="h-24 animate-pulse rounded-xl bg-gray-800/60" />
            <div className="h-24 animate-pulse rounded-xl bg-gray-800/40" />
            <div className="h-40 animate-pulse rounded-xl bg-gray-800/60" />
          </div>
        ) : accessRevoked || query.isError ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4">
            <p className="text-sm text-red-300">
              {query.error?.response?.data?.message ||
                "Không thể tải tổng quan khách hàng."}
            </p>
            <button
              type="button"
              onClick={() => {
                void query.refetch();
              }}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-sm font-semibold text-red-200 hover:bg-red-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <RefreshCw size={14} aria-hidden="true" /> Thử lại
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Today status card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="h-5 w-5 shrink-0 text-orange-300" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Trạng thái hôm nay</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {todayStatusLabel(today.summary.dayStatus)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <strong className="text-3xl font-bold tabular-nums text-orange-300">
                    {today.summary.completionPercent}
                    <span className="text-base font-bold text-orange-400/60">%</span>
                  </strong>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-orange-400 transition-[width] duration-200"
                  style={{ width: `${today.summary.completionPercent}%` }}
                  role="progressbar"
                  aria-valuenow={today.summary.completionPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={"Tiến độ hôm nay: " + today.summary.completionPercent + "%"}
                />
              </div>
            </div>

            <TrainerAttentionPanel items={query.data.attention.items} />
            <TrainerJournalSummary
              dateKey={dateKey}
              journal={journal}
              sectionRef={journalAnchorRef}
            />
            <ProgressSummary
              progress={query.data.progress}
              activeSection={activeProgressSection}
              onSectionChange={handleProgressSectionChange}
              landingActions={
                <button
                  type="button"
                  onClick={() => void query.refetch()}
                  disabled={query.isFetching}
                  className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-wait disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={query.isFetching ? "animate-spin" : ""}
                    aria-hidden="true"
                  />
                  {query.isFetching ? "Đang cập nhật..." : "Cập nhật dữ liệu"}
                </button>
              }
              rangeControls={
                <div
                  className="flex w-fit items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1"
                  role="group"
                  aria-label="Khoảng tiến trình khách hàng"
                >
                  {progressRanges.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDays(value)}
                      aria-pressed={days === value}
                      className={
                        "min-h-11 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 " +
                        (days === value
                          ? "border border-slate-600 bg-slate-700 text-white"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white")
                      }
                    >
                      {progressRangeLabel(value)}
                    </button>
                  ))}
                </div>
              }
            />
            <TrainerWeeklyReviewAnchor sectionRef={weeklyAnchorRef}>
              <TrainerWeeklyReview
                key={
                  (query.data.weeklyCheckin?._id || "missing") +
                  ":" +
                  (query.data.weeklyCheckin?.revision || 0)
                }
                clientId={clientId}
                checkin={query.data.weeklyCheckin}
                onChanged={setWeekly}
              />
            </TrainerWeeklyReviewAnchor>
            {coaching?._id && (
              <CoachingCommentThread
                targetType="coaching_day"
                targetId={coaching._id}
                title="Trao đổi về ngày huấn luyện"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
};

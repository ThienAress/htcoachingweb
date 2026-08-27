import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  HeartPulse,
  RefreshCw,
  Salad,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import {
  customerReportFromHash,
  getTrainerClientOverviewSurface,
} from "./trainerCustomerReports";
import { TrainerWeeklyReview } from "./TrainerWeeklyReview";

const formatNumber = (value) =>
  Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 });

export const TrainerJournalSummary = ({ journal, sectionRef }) => {
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
            <HeartPulse size={19} aria-hidden="true" />
          </span>
          <div>
            <h2
              id="trainer-journal-title"
              className="text-lg font-bold text-white"
            >
              Sức khỏe
            </h2>
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
                className="border-b border-slate-800 px-3 py-3"
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
              {journal.notes?.shared || "Khách hàng không ghi chú."}
            </p>
          </div>
        </>
      )}
    </section>
  );
};

const nutritionLabels = {
  calories: ["Kcal", "kcal"],
  protein: ["Protein", "g"],
  carb: ["Carb", "g"],
  fat: ["Fat", "g"],
};

export const TrainerNutritionReport = ({
  nutrition,
  sectionRef,
}) => {
  const isSubmitted = Boolean(nutrition?.submittedAt);
  const eatenEntries = (nutrition?.entries || []).filter(
    (entry) => entry.status === "eaten",
  );
  return (
    <section
      id="nutrition-report"
      ref={sectionRef}
      tabIndex={-1}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      aria-labelledby="trainer-nutrition-report-title"
    >
      <header className="flex items-center gap-3 border-b border-slate-800 px-5 py-4 sm:px-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-400/10 text-orange-300">
          <Salad size={19} aria-hidden="true" />
        </span>
        <div>
          <h2
            id="trainer-nutrition-report-title"
            className="text-lg font-bold text-white"
          >
            Dinh dưỡng
          </h2>
          <p
            className={`mt-1 text-xs font-semibold ${
              isSubmitted ? "text-emerald-300" : "text-slate-500"
            }`}
          >
            {isSubmitted ? "Đã gửi" : "Chưa gửi"}
          </p>
        </div>
      </header>

      {!isSubmitted ? (
        <p className="px-5 py-5 text-sm text-slate-400 sm:px-6">
          Khách hàng chưa gửi báo cáo dinh dưỡng cho ngày này.
        </p>
      ) : (
        <div className="grid gap-3 p-5 lg:grid-cols-2 sm:p-6">
          {eatenEntries.map((entry) => (
          <article
            key={entry.entryId}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
          >
            <h3 className="border-b border-slate-700 pb-2 font-bold text-slate-100">
              {entry.mealName || entry.labelSnapshot || "Bữa ăn"}
            </h3>
            {entry.mode === "follow_plan" && entry.actualFoods?.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {entry.actualFoods.map((food) => (
                  <li
                    key={food.foodId}
                    className="text-sm leading-6 text-slate-300"
                  >
                    <span className="font-semibold text-slate-100">
                      {formatNumber(food.actualAmountGrams)}g {food.labelSnapshot}
                    </span>{" "}
                    <span className="text-slate-400">
                      ({formatNumber(food.nutrition?.protein)}P/
                      {formatNumber(food.nutrition?.carb)}C/
                      {formatNumber(food.nutrition?.fat)}F) -{" "}
                      {Math.round(Number(food.nutrition?.calories || 0)).toLocaleString(
                        "vi-VN",
                      )}{" "}
                      kcal
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {entry.description || entry.labelSnapshot}
              </p>
            )}
          </article>
          ))}
        </div>
      )}

      {isSubmitted && (
        <dl className="grid border-t border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(nutritionLabels).map(([key, [label, unit]]) => (
          <div key={key} className="border-b border-slate-800 px-5 py-4 lg:border-b-0">
            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm font-black tabular-nums text-orange-200">
              {key === "calories"
                ? Math.round(Number(nutrition.dailyTotals?.[key] || 0)).toLocaleString(
                    "vi-VN",
                  )
                : formatNumber(nutrition.dailyTotals?.[key] || 0)}{" "}
              {unit}
            </dd>
          </div>
        ))}
        </dl>
      )}
    </section>
  );
};

const CUSTOMER_REPORT_SECTIONS = [
  {
    key: "health",
    label: "Sức khỏe",
    description: "Giấc ngủ, nước uống, số bước và cảm nhận trong ngày.",
    Icon: HeartPulse,
    iconClass: "bg-cyan-400/10 text-cyan-300",
  },
  {
    key: "nutrition",
    label: "Dinh dưỡng",
    description: "Những bữa đã ăn và tổng dinh dưỡng khách hàng đã gửi.",
    Icon: Salad,
    iconClass: "bg-orange-400/10 text-orange-300",
  },
];

const CustomerReportHeader = ({ clientName, active, onBack, headingRef }) => (
  <header
    className={`flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between ${
      active ? "border-b border-slate-800 pb-5" : ""
    }`}
  >
    <div>
      <h2
        ref={headingRef}
        tabIndex={active ? -1 : undefined}
        id="customer-reports-title"
        className="flex items-center gap-3 text-2xl font-bold text-white sm:text-3xl"
      >
        <BookOpenText
          className="h-6 w-6 shrink-0 text-cyan-300"
          aria-hidden="true"
        />
        Báo cáo khách hàng
      </h2>
      {clientName && (
        <p className="mt-2 text-sm font-semibold text-slate-400">
          {clientName}
        </p>
      )}
    </div>
    {active && (
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        <ArrowLeft size={17} aria-hidden="true" /> Quay lại
      </button>
    )}
  </header>
);

export const TrainerCustomerReports = ({
  activeReport,
  clientName,
  headingRef,
  journal,
  journalRef,
  nutrition,
  nutritionRef,
  onReportChange = () => {},
}) => {
  const activeSection = CUSTOMER_REPORT_SECTIONS.find(
    ({ key }) => key === activeReport,
  );
  const statusBySection = {
    health: journal?.status === "submitted" ? "Đã gửi" : "Chưa gửi",
    nutrition: nutrition?.submittedAt ? "Đã gửi" : "Chưa gửi",
  };

  if (activeSection) {
    return (
      <div className="space-y-5">
        <CustomerReportHeader
          active
          clientName={clientName}
          headingRef={headingRef}
          onBack={() => onReportChange(null)}
        />
        {activeSection.key === "health" ? (
          <TrainerJournalSummary journal={journal} sectionRef={journalRef} />
        ) : (
          <TrainerNutritionReport
            nutrition={nutrition}
            sectionRef={nutritionRef}
          />
        )}
      </div>
    );
  }

  return (
    <section
      data-customer-report-navigation="true"
      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950"
      aria-labelledby="customer-reports-title"
    >
      <div className="p-5 sm:p-6">
        <CustomerReportHeader clientName={clientName} />
      </div>
      <div className="divide-y divide-slate-800 border-t border-slate-800">
        {CUSTOMER_REPORT_SECTIONS.map((section) => {
          const Icon = section.Icon;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onReportChange(section.key)}
              className="group grid min-h-24 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 sm:px-6"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${section.iconClass}`}
              >
                <Icon size={21} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-100">
                    {section.label}
                  </span>
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-400">
                    {statusBySection[section.key]}
                  </span>
                </span>
                <span className="mt-1 block text-sm leading-5 text-slate-400">
                  {section.description}
                </span>
              </span>
              <ArrowRight
                size={19}
                className="text-slate-500 transition-colors group-hover:text-cyan-300"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
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

export const TrainerClientOverview = ({
  clientId,
  clientName,
  dateKey,
  surface = "overview",
}) => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [activeProgressSection, setActiveProgressSection] = useState(null);
  const activeCustomerReport = customerReportFromHash(location.hash);
  const purgedForbiddenKeyRef = useRef(null);
  const journalAnchorRef = useRef(null);
  const nutritionAnchorRef = useRef(null);
  const customerReportHeadingRef = useRef(null);
  const weeklyAnchorRef = useRef(null);
  const queryKey = ["trainer-client-overview", clientId, dateKey, days];
  const progressRanges = progressRangeOptions(activeProgressSection);
  const handleProgressSectionChange = (section) => {
    setDays((current) => normalizeProgressDaysForSection(section, current));
    setActiveProgressSection(section);
  };
  const handleCustomerReportChange = (section) => {
    const hash =
      section === "health"
        ? "#journal"
        : section === "nutrition"
          ? "#nutrition-report"
          : "";
    void navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash,
      },
      { replace: true },
    );
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
        : location.hash === "#nutrition-report"
          ? nutritionAnchorRef
        : location.hash === "#weekly-report"
          ? weeklyAnchorRef
          : null;
    if (!targetRef?.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      targetRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeCustomerReport,
    location.hash,
    query.isSuccess,
    clientId,
    dateKey,
  ]);

  const today = query.data?.today;
  const journal = today?.sections?.journal?.day;
  const coaching = today?.sections?.coaching?.day;
  const nutrition = journal?.nutrition;
  const surfaceConfig = getTrainerClientOverviewSurface(surface);

  return (
    <section className="space-y-4">
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
            {surfaceConfig.showCustomerReports && (
              <TrainerCustomerReports
                activeReport={activeCustomerReport}
                clientName={clientName}
                headingRef={customerReportHeadingRef}
                journal={journal}
                journalRef={journalAnchorRef}
                nutrition={nutrition}
                nutritionRef={nutritionAnchorRef}
                onReportChange={handleCustomerReportChange}
              />
            )}
            {surfaceConfig.showAttention && (
              <TrainerAttentionPanel items={query.data.attention.items} />
            )}
            {surfaceConfig.showOverview && (
              <>
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
                checkin={query.data.weeklyCheckin}
                  />
                </TrainerWeeklyReviewAnchor>
                {coaching?._id && (
                  <CoachingCommentThread
                    targetType="coaching_day"
                    targetId={coaching._id}
                    title="Trao đổi về ngày huấn luyện"
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

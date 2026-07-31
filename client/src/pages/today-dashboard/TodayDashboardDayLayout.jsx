import { ArrowLeft, ArrowRight, CalendarDays, Clock, Loader2, RefreshCw, Rocket, Users } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import SEO from "../../components/SEO";
import { useTodayDashboardDay } from "../../hooks/useTodayDashboardDay";
import {
  dashboardPathFor,
  dashboardSectionFromPath,
} from "../../utils/customerDashboardNavigation";
import { addDaysToDateKey, getVietnamDateKey } from "../../utils/vietnamDate";
import { getSectionProgressPresentation } from "./todayDashboardProgress";

const SECTION_META = {
  today: {
    title: "Tổng quan hôm nay",
    description: "Việc quan trọng và trạng thái trong ngày của bạn.",
  },
  training: {
    title: "Lịch & bài tập",
    description: "Lịch tập, huấn luyện, giáo án và điểm danh trong ngày.",
  },
  nutrition: {
    title: "Dinh dưỡng hôm nay",
    description: "Theo dõi thực đơn và ghi nhanh những gì bạn đã ăn.",
  },
  journal: {
    title: "Nhật ký hôm nay",
    description: "Sức khỏe, thói quen, báo cáo tuần và trao đổi với huấn luyện viên.",
  },
};

const formatDate = (dateKey) =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(dateKey + "T12:00:00+07:00"));

const LoadingState = () => (
  <div className="space-y-4" role="status" aria-live="polite">
    <span className="sr-only">Đang tải kế hoạch trong ngày...</span>
    <div className="h-48 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
      <div className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
      <div className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
      <div className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
    </div>
  </div>
);

const ONBOARDING_CONFIG = {
  never_coached: {
    icon: Rocket,
    glowColor: "#f97316",
    glowClass: "bg-orange-500/10 border-orange-500/20",
    iconBg: "bg-orange-500/15",
    iconColor: "text-orange-400",
    badgeBg: "bg-orange-500/10 border-orange-500/30",
    badgeText: "text-orange-300",
    badge: "Chưa đăng ký",
    title: "Bắt đầu hành trình huấn luyện",
    description:
      "Bạn chưa có gói huấn luyện. Khi gói được kích hoạt, kế hoạch tập luyện và dinh dưỡng mỗi ngày sẽ xuất hiện tại đây.",
    steps: [
      { label: "Chọn gói huấn luyện phù hợp", done: false },
      { label: "Được phân công HLV cá nhân", done: false },
      { label: "Bảng theo dõi mở — bắt đầu hành trình", done: false },
    ],
    cta: "Xem gói huấn luyện",
    ctaTo: "/#pricing",
  },
  pending: {
    icon: Clock,
    glowColor: "#22d3ee",
    glowClass: "bg-cyan-500/10 border-cyan-500/20",
    iconBg: "bg-cyan-500/15",
    iconColor: "text-cyan-400",
    badgeBg: "bg-cyan-500/10 border-cyan-500/30",
    badgeText: "text-cyan-300",
    badge: "Đang xử lý",
    title: "Gói huấn luyện đang chờ xác nhận",
    description:
      "HTCOACHING đang kiểm tra và xác nhận gói tập của bạn. Bảng theo dõi sẽ tự động mở ngay khi gói được duyệt.",
    steps: [
      { label: "Đăng ký gói huấn luyện", done: true },
      { label: "HTCOACHING xác nhận gói", done: false, active: true },
      { label: "Phân công HLV và mở bảng theo dõi", done: false },
    ],
    cta: "Liên hệ hỗ trợ",
    ctaTo: "/#pricing",
  },
  assignment_required: {
    icon: Users,
    glowColor: "#a78bfa",
    glowClass: "bg-violet-500/10 border-violet-500/20",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-400",
    badgeBg: "bg-violet-500/10 border-violet-500/30",
    badgeText: "text-violet-300",
    badge: "Sắp hoàn tất",
    title: "Đang phân công huấn luyện viên",
    description:
      "Gói của bạn đã được duyệt! Đội ngũ HTCOACHING đang phân công HLV phù hợp nhất cho bạn. Vui lòng chờ trong giây lát.",
    steps: [
      { label: "Đăng ký gói huấn luyện", done: true },
      { label: "Gói được xác nhận", done: true },
      { label: "Phân công HLV cá nhân", done: false, active: true },
    ],
    cta: "Liên hệ hỗ trợ",
    ctaTo: "/#pricing",
  },
};

const OnboardingState = ({ status }) => {
  const cfg = ONBOARDING_CONFIG[status] || {
    icon: CalendarDays,
    glowColor: "#f97316",
    glowClass: "bg-orange-500/10 border-orange-500/20",
    iconBg: "bg-orange-500/15",
    iconColor: "text-orange-400",
    badgeBg: "bg-orange-500/10 border-orange-500/30",
    badgeText: "text-orange-300",
    badge: "Chưa sẵn sàng",
    title: "Bảng theo dõi chưa sẵn sàng",
    description: "Vui lòng thử lại sau hoặc liên hệ HTCOACHING để được hỗ trợ.",
    steps: [],
    cta: "Xem gói huấn luyện",
    ctaTo: "/#pricing",
  };
  const Icon = cfg.icon;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border p-6 sm:p-8 ${cfg.glowClass}`}
      aria-live="polite"
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full opacity-25"
        style={{ background: `radial-gradient(circle, ${cfg.glowColor} 0%, transparent 70%)` }}
        aria-hidden="true"
      />

      <div className="relative">
        {/* Badge + Icon row */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${cfg.iconBg} ${cfg.iconColor}`}
          >
            <Icon aria-hidden="true" className="h-6 w-6" />
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}
          >
            {cfg.badge}
          </span>
          {(status === "pending" || status === "assignment_required") && (
            <Loader2
              className={`h-4 w-4 animate-spin ${cfg.iconColor}`}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Title & Description */}
        <h2 className="mt-5 text-2xl font-bold text-white sm:text-3xl">
          {cfg.title}
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
          {cfg.description}
        </p>

        {/* Step Timeline */}
        {cfg.steps && cfg.steps.length > 0 && (
          <ol className="mt-6 space-y-3" aria-label="Tiến trình đăng ký">
            {cfg.steps.map((step, i) => (
              <li key={i} className="flex items-center gap-3">
                {/* Step dot */}
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    step.done
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                      : step.active
                        ? `border-current bg-current/10 ${cfg.iconColor}`
                        : "border-slate-700 bg-slate-800 text-slate-500"
                  }`}
                >
                  {step.done ? (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </span>
                {/* Step label */}
                <span
                  className={`text-sm font-medium ${
                    step.done
                      ? "text-emerald-400"
                      : step.active
                        ? "text-white"
                        : "text-slate-500"
                  }`}
                >
                  {step.label}
                  {step.active && (
                    <span className={`ml-2 text-xs font-semibold ${cfg.badgeText}`}>
                      ← đang thực hiện
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* CTA */}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to={cfg.ctaTo}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          >
            {cfg.cta}
          </Link>
          {status !== "never_coached" && (
            <a
              href="https://www.facebook.com/htcoaching"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              Nhắn tin Facebook
            </a>
          )}
        </div>
      </div>
    </section>
  );
};

const TodayDashboardDayLayout = () => {
  const { dateKey } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const todayKey = getVietnamDateKey();
  const section = dashboardSectionFromPath(location.pathname);
  const meta = SECTION_META[section] || SECTION_META.today;
  const { handleJournalChanged, query, validDate } =
    useTodayDashboardDay(dateKey);
  const sectionProgress = getSectionProgressPresentation(
    query.data?.summary,
    section,
  );

  const goToDate = (nextDateKey) =>
    navigate(dashboardPathFor(section, nextDateKey));
  const errorMessage = validDate
    ? query.error?.response?.data?.message ||
      query.error?.message ||
      "Không thể tải kế hoạch trong ngày."
    : "Ngày trên đường dẫn không hợp lệ.";

  return (
    <>
      <SEO title={meta.title} noindex />

      {/* ── Page Header ── */}
      <header className="mb-6 sm:mb-8">
        {/* Top row: title + date nav */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {/* Eyebrow label */}
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Bảng theo dõi học viên
            </p>
            <h1 className="text-2xl font-black text-white sm:text-3xl">{meta.title}</h1>
            {validDate && (
              <p className="mt-1 text-sm font-medium capitalize text-orange-400">
                {formatDate(dateKey)}
              </p>
            )}
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
              {meta.description}
            </p>
          </div>

          {/* Date Navigation — compact pill */}
          <div className="flex shrink-0 self-start items-center gap-1 rounded-2xl border border-slate-800 bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => goToDate(addDaysToDateKey(dateKey, -1))}
              disabled={!validDate}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
              aria-label="Ngày trước"
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[80px] text-center text-xs font-semibold text-slate-300">
              {dateKey === todayKey ? (
                <span className="text-orange-400">Hôm nay</span>
              ) : (
                <button
                  type="button"
                  onClick={() => goToDate(todayKey)}
                  className="text-slate-400 underline-offset-2 hover:text-orange-400 hover:underline focus-visible:outline-none"
                >
                  Về hôm nay
                </button>
              )}
            </span>
            <button
              type="button"
              onClick={() => goToDate(addDaysToDateKey(dateKey, 1))}
              disabled={!validDate}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
              aria-label="Ngày tiếp theo"
            >
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Progress bar — only for module pages */}
        {sectionProgress && query.data?.capabilities.canViewSources && (
          <div className="mt-5 max-w-md">
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hoàn thành trong ngày
              </span>
              <span
                className={`text-right text-sm font-bold ${
                  sectionProgress.hasTasks ? "text-white" : "text-slate-400"
                }`}
                aria-live="polite"
              >
                {sectionProgress.valueLabel}
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              {sectionProgress.hasTasks && (
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-700"
                  style={{ width: sectionProgress.percent + "%" }}
                  role="progressbar"
                  aria-valuenow={sectionProgress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Tiến độ ${meta.title.toLowerCase()}`}
                />
              )}
            </div>
          </div>
        )}
        {/* Divider */}
        <div className="mt-5 h-px bg-slate-800 sm:mt-6" />
      </header>

      {query.isLoading ? (
        <LoadingState />
      ) : !validDate || query.isError ? (
        <section className="rounded-2xl border border-red-900/60 bg-slate-900 p-6">
          <h2 className="font-bold text-white">Không thể mở ngày này</h2>
          <p className="mt-2 text-sm text-slate-400">{errorMessage}</p>
          <button
            type="button"
            onClick={() =>
              validDate ? query.refetch() : goToDate(todayKey)
            }
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            {validDate ? "Thử lại" : "Mở hôm nay"}
          </button>
        </section>
      ) : !query.data.capabilities.canViewSources ? (
        <OnboardingState status={query.data.eligibility.status} />
      ) : (
        <>
          {query.data.eligibility.status === "inactive" && (
            <p className="mb-4 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
              Gói huấn luyện hiện không hoạt động. Bạn vẫn có thể xem dữ liệu lịch sử của chính mình.
            </p>
          )}
          {query.data.partialErrors.length > 0 && (
            <p
              className="mb-4 rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100"
              role="status"
            >
              Một phần dữ liệu đang tạm gián đoạn; các mục còn lại vẫn dùng bình thường.
            </p>
          )}
          <Outlet
            context={{
              data: query.data,
              dateKey,
              handleJournalChanged,
              refetch: query.refetch,
            }}
          />
        </>
      )}
    </>
  );
};

export default TodayDashboardDayLayout;

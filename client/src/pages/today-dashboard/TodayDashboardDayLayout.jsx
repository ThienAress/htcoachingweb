import { ArrowLeft, ArrowRight, CalendarDays, RefreshCw } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import SEO from "../../components/SEO";
import { useTodayDashboardDay } from "../../hooks/useTodayDashboardDay";
import {
  dashboardPathFor,
  dashboardSectionFromPath,
} from "../../utils/customerDashboardNavigation";
import { addDaysToDateKey, getVietnamDateKey } from "../../utils/vietnamDate";

const SECTION_META = {
  today: {
    title: "Tổng quan hôm nay",
    description: "Việc quan trọng và trạng thái trong ngày của bạn.",
  },
  training: {
    title: "Lịch & bài tập",
    description: "Lịch tập, coaching, giáo án và điểm danh trong ngày.",
  },
  nutrition: {
    title: "Dinh dưỡng hôm nay",
    description: "Theo dõi thực đơn và ghi nhanh những gì bạn đã ăn.",
  },
  journal: {
    title: "Nhật ký hôm nay",
    description: "Wellness, habit, ghi chú và trao đổi với huấn luyện viên.",
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
    <div className="h-40 animate-pulse rounded-2xl border border-slate-800 bg-slate-950" />
    <div className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-950" />
  </div>
);

const OnboardingState = ({ status }) => {
  const copy = {
    never_coached: [
      "Bắt đầu hành trình coaching",
      "Bạn chưa có gói coaching. Khi gói được kích hoạt, kế hoạch mỗi ngày sẽ xuất hiện tại đây.",
    ],
    pending: [
      "Gói của bạn đang chờ duyệt",
      "HTCOACHING đang xác nhận gói tập. Dashboard sẽ mở sau khi gói được duyệt.",
    ],
    assignment_required: [
      "Đang phân công huấn luyện viên",
      "Gói đã sẵn sàng nhưng chưa có HLV phụ trách. Đội ngũ sẽ hoàn tất phân công sớm nhất.",
    ],
  }[status] || [
    "Dashboard chưa sẵn sàng",
    "Vui lòng thử lại sau hoặc liên hệ HTCOACHING để được hỗ trợ.",
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8">
      <CalendarDays aria-hidden="true" className="h-7 w-7 text-orange-400" />
      <h2 className="mt-4 text-xl font-bold text-white">{copy[0]}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{copy[1]}</p>
      <Link
        to="/#pricing"
        className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
      >
        Xem gói coaching
      </Link>
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
      <header className="mb-5 border-b border-slate-800 pb-5 sm:mb-6 sm:pb-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{meta.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{meta.description}</p>
            {validDate && (
              <p className="mt-2 text-sm font-semibold capitalize text-orange-300">
                {formatDate(dateKey)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goToDate(addDaysToDateKey(dateKey, -1))}
              disabled={!validDate}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
              aria-label="Ngày trước"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            {dateKey !== todayKey && (
              <button
                type="button"
                onClick={() => goToDate(todayKey)}
                className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                Về hôm nay
              </button>
            )}
            <button
              type="button"
              onClick={() => goToDate(addDaysToDateKey(dateKey, 1))}
              disabled={!validDate}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
              aria-label="Ngày tiếp theo"
            >
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>

        {section !== "today" && query.data?.capabilities.canViewSources && (
          <div className="mt-5 max-w-xl">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-400">Hoàn thành trong ngày</span>
              <strong className="text-white">{query.data.summary.completionPercent}%</strong>
            </div>
            <progress
              value={query.data.summary.completionPercent}
              max="100"
              className="h-2 w-full accent-orange-500"
              aria-label="Tiến độ hoàn thành trong ngày"
            />
          </div>
        )}
      </header>

      {query.isLoading ? (
        <LoadingState />
      ) : !validDate || query.isError ? (
        <section className="rounded-2xl border border-red-900/60 bg-slate-950 p-6">
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
              Gói coaching hiện không hoạt động. Bạn vẫn có thể xem dữ liệu lịch sử của chính mình.
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

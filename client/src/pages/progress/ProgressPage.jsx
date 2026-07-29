import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarDays, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../../components/SEO";
import { useAuth } from "../../context/AuthContext";
import Footer from "../../sections/Footer/Footer";
import Header from "../../sections/Header/Header";
import { getMyProgress } from "../../services/progress.service";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getVietnamDateKey,
} from "../../utils/vietnamDate";
import { ProgressSummary } from "./ProgressSummary";
import { WeeklyCheckinCard } from "./WeeklyCheckinCard";
import { CoachingActivityPanel } from "./CoachingActivityPanel";
import { dashboardPathFor } from "../../utils/customerDashboardNavigation";

const RANGES = [7, 30, 90];
const currentWeekStart = () => {
  const today = getVietnamDateKey();
  return addDaysToDateKey(today, -getAppDayOfWeek(today));
};

const LoadingState = () => (
  <div className="space-y-4" role="status" aria-live="polite">
    <span className="sr-only">Đang tải Progress Hub...</span>
    <div className="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-950" />
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-950" />
      <div className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-950" />
    </div>
  </div>
);

const ProgressPage = ({ embedded = false }) => {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const query = useQuery({
    queryKey: ["progress", user?._id, days],
    queryFn: async () => (await getMyProgress(days)).data.data,
    enabled: Boolean(user?._id),
    staleTime: 30_000,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });

  const PageContainer = embedded ? "div" : "main";

  return (
    <>
      <SEO title="Tiến trình coaching" noindex />
      {!embedded && <Header />}
      <PageContainer
        className={
          embedded
            ? "text-slate-100"
            : "min-h-screen bg-slate-900 px-4 pb-16 pt-28 text-slate-100 sm:px-6"
        }
      >
        <div className="mx-auto max-w-6xl space-y-5">
          <header className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-orange-400">
                  <BarChart3 size={18} aria-hidden="true" /> Progress Hub
                </p>
                <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                  Tiến trình coaching của bạn
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Tổng hợp từ lịch tập, giáo án, meal plan, habit, wellness và
                  Weekly Check-in. Dữ liệu trống luôn được giữ là chưa có dữ
                  liệu, không tính thành 0%.
                </p>
              </div>
              {!embedded && (
                <Link
                  to={dashboardPathFor("today", getVietnamDateKey())}
                  className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                >
                  <CalendarDays size={17} aria-hidden="true" /> Mở Today Dashboard
                </Link>
              )}
            </div>
            <div
              className="mt-6 flex flex-wrap gap-2"
              role="group"
              aria-label="Khoảng thời gian"
            >
              {RANGES.map((value) => {
                const selected = days === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDays(value)}
                    aria-pressed={selected}
                    className={
                      "min-h-11 rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 " +
                      (selected
                        ? "border-orange-400 bg-orange-500/10 text-orange-200"
                        : "border-slate-700 text-slate-400 hover:bg-slate-800")
                    }
                  >
                    {value} ngày
                  </button>
                );
              })}
            </div>
          </header>

          {query.isLoading ? (
            <LoadingState />
          ) : query.isError ? (
            <section className="rounded-2xl border border-red-900/60 bg-slate-950 p-6">
              <h2 className="font-bold text-white">Không thể tải tiến trình</h2>
              <p className="mt-2 text-sm text-slate-400">
                {query.error?.response?.data?.message ||
                  "Dữ liệu đang tạm gián đoạn."}
              </p>
              <button
                type="button"
                onClick={() => query.refetch()}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                <RefreshCw size={16} aria-hidden="true" /> Thử lại
              </button>
            </section>
          ) : (
            <>
              <ProgressSummary progress={query.data} />
              <p className="text-right text-xs text-slate-500">
                Công thức {query.data.formulaVersion} · múi giờ Việt Nam
              </p>
            </>
          )}

          <WeeklyCheckinCard
            weekStartDateKey={currentWeekStart()}
            userId={user?._id}
          />
          <CoachingActivityPanel days={days} userId={user?._id} />
        </div>
      </PageContainer>
      {!embedded && <Footer />}
    </>
  );
};

export default ProgressPage;

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../../components/SEO";
import { useAuth } from "../../context/AuthContext";
import Footer from "../../sections/Footer/Footer";
import Header from "../../sections/Header/Header";
import { getMyProgress } from "../../services/progress.service";
import { getVietnamDateKey } from "../../utils/vietnamDate";
import { ProgressSummary } from "./ProgressSummary";
import {
  normalizeProgressDaysForSection,
  progressRangeLabel,
  progressRangeOptions,
} from "./progressPresentation";
import { dashboardPathFor } from "../../utils/customerDashboardNavigation";

const LoadingState = () => (
  <div className="space-y-4" role="status" aria-live="polite">
    <span className="sr-only">Đang tải tổng quan...</span>
    <div className="h-[32rem] animate-pulse rounded-2xl border border-slate-800 bg-slate-950" />
  </div>
);

const RefreshButton = ({ query }) => (
  <button
    type="button"
    onClick={() => void query.refetch()}
    disabled={query.isFetching}
    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-wait disabled:opacity-50"
  >
    <RefreshCw
      size={16}
      className={query.isFetching ? "animate-spin" : ""}
      aria-hidden="true"
    />
    {query.isFetching ? "Đang cập nhật..." : "Cập nhật dữ liệu"}
  </button>
);

const ProgressPage = ({ embedded = false }) => {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [activeSection, setActiveSection] = useState(null);
  const query = useQuery({
    queryKey: ["progress", user?._id, days],
    queryFn: async () => (await getMyProgress(days)).data.data,
    enabled: Boolean(user?._id),
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });
  const ranges = progressRangeOptions(activeSection);
  const handleSectionChange = (section) => {
    setDays((current) => normalizeProgressDaysForSection(section, current));
    setActiveSection(section);
  };

  const PageContainer = embedded ? "div" : "main";

  return (
    <>
      <SEO title="Tiến trình cơ thể và tập luyện" noindex />
      {!embedded && <Header />}
      <PageContainer
        className={
          embedded
            ? "text-slate-100"
            : "min-h-screen bg-slate-900 px-4 pb-16 pt-28 text-slate-100 sm:px-6"
        }
      >
        <div className="mx-auto max-w-6xl space-y-5">
          {query.isLoading ? (
            <LoadingState />
          ) : query.isError ? (
            <section className="rounded-2xl border border-red-900/60 bg-slate-950 p-6">
              <h2 className="font-bold text-white">Không thể tải tổng quan</h2>
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
              <ProgressSummary
                progress={query.data}
                selectedDateKey={getVietnamDateKey()}
                activeSection={activeSection}
                onSectionChange={handleSectionChange}
                landingHeadingLevel={embedded ? "h2" : "h1"}
                landingActions={
                  <div className="flex flex-wrap gap-3 lg:max-w-xs lg:justify-end">
                    {!embedded && (
                      <Link
                        to={dashboardPathFor("today", getVietnamDateKey())}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                      >
                        <CalendarDays size={17} aria-hidden="true" /> Tổng quan hôm nay
                      </Link>
                    )}
                    <RefreshButton query={query} />
                  </div>
                }
                rangeControls={
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Khoảng thời gian"
                  >
                    {ranges.map((value) => {
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
                          {progressRangeLabel(value)}
                        </button>
                      );
                    })}
                  </div>
                }
              />
            </>
          )}
        </div>
      </PageContainer>
      {!embedded && <Footer />}
    </>
  );
};

export default ProgressPage;

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  RefreshCw,
  UserRound,
  BarChart3,
  BellRing,
  ListChecks,
} from "lucide-react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useEffect } from "react";
import { getTrainerClients } from "../../services/coaching.service";
import { TODAY_PLATFORM_ENABLED } from "../../config/featureFlags";
import {
  getVietnamDateKey,
  isValidDateKey,
} from "../../utils/vietnamDate";
import { TrainerClientOverview } from "./TrainerClientOverview";
import { TrainerHealthGoalsSection } from "./TrainerHealthGoalsSection";
import {
  getTrainerClientId,
  normalizeTrainerClientTabForHash,
  TRAINER_CLIENT_TABS,
  TRAINER_SUPPORT_SECTION_ORDER,
} from "./trainerClientWorkspace.helpers";

const queryClients = async () =>
  (await getTrainerClients()).data.data || [];

const formatPackageLabel = (label) =>
  String(label || "").replace(/\s*\(/, " (");

const TAB_ICONS = {
  overview: BarChart3,
  tasks: ListChecks,
};

export const TrainerSupportReminder = () => (
  <aside
    role="note"
    aria-label="Nhắc kiểm tra báo cáo"
    className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-amber-100"
  >
    <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
    <p className="text-sm font-semibold leading-6">
      Báo cáo từ khách hàng rất quan trọng. Bạn nhớ kiểm tra mỗi ngày để kịp thời lưu ý và hỗ trợ khách hàng nhé.
    </p>
  </aside>
);

export const TrainerClientWorkspace = () => {
  const { clientId = "" } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isHealthTracking = location.pathname.startsWith(
    "/trainer/health/clients/",
  );
  const backPath = isHealthTracking ? "/trainer/health" : "/trainer";
  const backLabel = isHealthTracking ? "Theo dõi sức khỏe" : "Khách của tôi";
  const activeTab = normalizeTrainerClientTabForHash(
    searchParams.get("tab"),
    location.hash,
  );
  const requestedDate = searchParams.get("date");
  const dateKey = isValidDateKey(requestedDate)
    ? requestedDate
    : getVietnamDateKey();

  useEffect(() => {
    if (
      activeTab !== "tasks" ||
      searchParams.get("tab") === "tasks" ||
      (location.hash !== "#journal" && location.hash !== "#nutrition-report")
    ) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("tab", "tasks");
    setSearchParams(next, { replace: true });
  }, [activeTab, location.hash, searchParams, setSearchParams]);

  const clientsQuery = useQuery({
    queryKey: ["trainer-clients"],
    queryFn: queryClients,
    staleTime: 30_000,
    gcTime: 0,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });
  const client = (clientsQuery.data || []).find(
    (item) => getTrainerClientId(item) === clientId,
  );

  const updateWorkspace = ({ tab = activeTab, date = dateKey }) => {
    const next = new URLSearchParams();
    if (tab !== "overview") next.set("tab", tab);
    if (isValidDateKey(date)) next.set("date", date);
    setSearchParams(next, { replace: true });
  };

  if (clientsQuery.isLoading) {
    return (
      <div className="min-h-[calc(100vh-3rem)] bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <div className="mx-auto max-w-[1440px] p-4 pt-8 md:p-8">
          <div className="space-y-4" role="status">
            <span className="sr-only">Đang tải hồ sơ học viên...</span>
            <div className="h-40 animate-pulse rounded-2xl bg-gray-800/60" />
            <div className="h-12 animate-pulse rounded-2xl bg-gray-800/40" />
            <div className="h-80 animate-pulse rounded-2xl bg-gray-800/60" />
          </div>
        </div>
      </div>
    );
  }

  if (clientsQuery.isError) {
    return (
      <div className="min-h-[calc(100vh-3rem)] bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <div className="mx-auto max-w-[1440px] p-4 pt-8 md:p-8">
          <section className="product-surface rounded-2xl border border-red-900/40 bg-gray-900/80 p-6 text-red-200">
            <h1 className="text-xl font-bold">Không thể tải hồ sơ học viên</h1>
            <p className="mt-2 text-sm text-red-300/80">
              {clientsQuery.error?.response?.data?.message ||
                "Vui lòng kiểm tra kết nối và thử lại."}
            </p>
            <button
              type="button"
              onClick={() => clientsQuery.refetch()}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Thử lại
            </button>
          </section>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-[calc(100vh-3rem)] bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <div className="mx-auto max-w-[1440px] p-4 pt-8 md:p-8">
          <section className="product-surface rounded-2xl border border-gray-700/40 bg-gray-900/80 p-6 text-gray-200">
            <h1 className="text-xl font-bold">Không tìm thấy học viên đang hoạt động</h1>
            <p className="mt-2 max-w-prose text-sm leading-6 text-gray-400">
              Học viên không thuộc phạm vi phụ trách hoặc gói huấn luyện đã kết thúc.
            </p>
            <Link
              to={backPath}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Quay lại danh sách
            </Link>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white min-h-[calc(100vh-3rem)]">
      <div className="mx-auto max-w-[1440px] space-y-5 p-4 md:p-8 pt-8">
      {/* ── Header Card ── */}
      <section className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-800/50 backdrop-blur-sm shadow-sm">
        <div className="p-5 sm:p-6">
          <Link
            to={backPath}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-300 transition-colors hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>

          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            {/* Client info */}
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
                <UserRound className="h-6 w-6 text-cyan-300" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-50">
                  {client.name}
                </h1>
                <p className="mt-0.5 truncate text-sm text-slate-300">
                  {client.email}
                </p>
                {client.package && (
                  <span className="mt-2 inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                    {formatPackageLabel(client.package)}
                  </span>
                )}
              </div>
            </div>

            {/* Date + CTA */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-200">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  Ngày theo dõi
                </span>
                <input
                  type="date"
                  value={dateKey}
                  onChange={(event) => updateWorkspace({ date: event.target.value })}
                  className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-50 outline-none transition hover:border-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                />
              </label>
              <Link
                to={
                  "/trainer/workout-plans?create=true&client=" +
                  encodeURIComponent(clientId) +
                  "&date=" +
                  encodeURIComponent(dateKey)
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                Tạo giáo án
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs ── */}
      {TODAY_PLATFORM_ENABLED && (
        <nav
          className="flex gap-2 overflow-x-auto border-b border-gray-700 px-1"
          aria-label="Nội dung hồ sơ học viên"
        >
        {TRAINER_CLIENT_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => updateWorkspace({ tab: tab.id })}
              className={
                "flex min-h-12 shrink-0 items-center justify-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:flex-1 " +
                (isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200")
              }
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
        </nav>
      )}

      {/* ── Tab content ── */}
      {!TODAY_PLATFORM_ENABLED && (
        <section className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 text-gray-300">
          <h2 className="text-lg font-bold text-white">Hồ sơ theo dõi đang được chuẩn bị</h2>
          <p className="mt-2 max-w-prose text-sm leading-6 text-gray-400">
            Danh sách khách hàng và chức năng tạo giáo án vẫn hoạt động. Dữ liệu sức khỏe chuyên sâu sẽ được mở sau khi hoàn tất kiểm tra hệ thống.
          </p>
        </section>
      )}
      {TODAY_PLATFORM_ENABLED && activeTab === "overview" && (
        <TrainerClientOverview
          clientId={clientId}
          clientName={client.name}
          dateKey={dateKey}
          surface="overview"
        />
      )}
      {TODAY_PLATFORM_ENABLED && activeTab === "tasks" && (
        <div className="space-y-4">
          <TrainerSupportReminder />
          {TRAINER_SUPPORT_SECTION_ORDER.map((section) =>
            section === "health_goals" ? (
              <TrainerHealthGoalsSection
                key={"health-goals:" + clientId}
                clientId={clientId}
                dateKey={dateKey}
              />
            ) : (
              <TrainerClientOverview
                key={section}
                clientId={clientId}
                clientName={client.name}
                dateKey={dateKey}
                surface="reports"
              />
            ),
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default TrainerClientWorkspace;

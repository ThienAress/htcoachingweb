import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getTrainerClients } from "../../services/coaching.service";
import {
  getVietnamDateKey,
  isValidDateKey,
} from "../../utils/vietnamDate";
import { TrainerClientOverview } from "./TrainerClientOverview";
import { TrainerHabitManager } from "./TrainerHabitManager";
import { TrainerWellnessTargetCard } from "./TrainerWellnessTargetCard";
import {
  getTrainerClientId,
  normalizeTrainerClientTab,
  TRAINER_CLIENT_TABS,
} from "./trainerClientWorkspace.helpers";

const queryClients = async () =>
  (await getTrainerClients()).data.data || [];

export const TrainerClientWorkspace = () => {
  const { clientId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTrainerClientTab(searchParams.get("tab"));
  const requestedDate = searchParams.get("date");
  const dateKey = isValidDateKey(requestedDate)
    ? requestedDate
    : getVietnamDateKey();

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
      <div className="space-y-4" role="status">
        <span className="sr-only">Đang tải hồ sơ học viên...</span>
        <div className="h-32 animate-pulse rounded-2xl bg-slate-800" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-800" />
      </div>
    );
  }

  if (clientsQuery.isError) {
    return (
      <section className="rounded-2xl border border-red-900/60 bg-slate-950 p-6 text-red-200">
        <h1 className="text-xl font-bold">Không thể tải hồ sơ học viên</h1>
        <p className="mt-2 text-sm text-red-300">
          {clientsQuery.error?.response?.data?.message ||
            "Vui lòng kiểm tra kết nối và thử lại."}
        </p>
        <button
          type="button"
          onClick={() => clientsQuery.refetch()}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold hover:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Thử lại
        </button>
      </section>
    );
  }

  if (!client) {
    return (
      <section className="rounded-2xl border border-slate-700 bg-slate-950 p-6 text-slate-200">
        <h1 className="text-xl font-bold">Không tìm thấy học viên đang hoạt động</h1>
        <p className="mt-2 max-w-prose text-sm leading-6 text-slate-400">
          Học viên không thuộc phạm vi phụ trách hoặc gói huấn luyện đã kết thúc.
        </p>
        <Link
          to="/trainer"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold text-cyan-300 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Quay lại danh sách
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-slate-950 p-5 text-slate-100 sm:p-6">
        <Link
          to="/trainer"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-300 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Khách của tôi
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <UserRound className="mt-1 h-6 w-6 shrink-0 text-cyan-400" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-bold text-white">{client.name}</h1>
              <p className="mt-1 text-sm text-slate-400">{client.email}</p>
              {client.package && (
                <span className="mt-2 inline-flex rounded-full bg-cyan-950 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {client.package}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-sm font-medium text-slate-300">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Ngày theo dõi
              </span>
              <input
                type="date"
                value={dateKey}
                onChange={(event) => updateWorkspace({ date: event.target.value })}
                className="mt-1.5 min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
              />
            </label>
            <Link
              to={
                "/workout-plans?create=true&client=" +
                encodeURIComponent(clientId) +
                "&date=" +
                encodeURIComponent(dateKey)
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 font-bold text-slate-950 hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Tạo giáo án
            </Link>
          </div>
        </div>
      </section>

      <nav
        className="flex gap-2 overflow-x-auto border-b border-slate-700"
        aria-label="Nội dung hồ sơ học viên"
      >
        {TRAINER_CLIENT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={activeTab === tab.id}
            onClick={() => updateWorkspace({ tab: tab.id })}
            className={
              "min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 " +
              (activeTab === tab.id
                ? "border-cyan-400 text-cyan-700"
                : "border-transparent text-slate-600 hover:text-slate-900")
            }
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <TrainerClientOverview clientId={clientId} dateKey={dateKey} />
      )}
      {activeTab === "wellness" && (
        <TrainerWellnessTargetCard
          key={"wellness-target:" + clientId}
          clientId={clientId}
        />
      )}
      {activeTab === "habits" && (
        <TrainerHabitManager clientId={clientId} dateKey={dateKey} />
      )}


    </div>
  );
};

export default TrainerClientWorkspace;

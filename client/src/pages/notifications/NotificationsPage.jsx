import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SEO from "../../components/SEO";
import { NotificationPreferences } from "../../components/NotificationPreferences";
import { useAuth } from "../../context/AuthContext";
import Footer from "../../sections/Footer/Footer";
import Header from "../../sections/Header/Header";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/notification.service";
import { notificationDestination } from "../../utils/notificationDestination";

const formatTime = (value) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

const NotificationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const queryKey = ["notifications", user?._id, status, page];
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (await listNotifications({ status, page, limit: 20 })).data.data,
    enabled: Boolean(user?._id),
    staleTime: 20_000,
    placeholderData: (previous) => previous,
  });
  const refreshInbox = () =>
    queryClient.invalidateQueries({
      queryKey: ["notifications", user?._id],
    });
  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: refreshInbox,
  });
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: refreshInbox,
  });
  const openItem = async (item) => {
    try {
      if (!item.readAt) await readMutation.mutateAsync(item._id);
    } finally {
      navigate(notificationDestination(item));
    }
  };
  const totalPages = Math.max(
    1,
    Math.ceil((query.data?.pagination.total || 0) / 20),
  );

  return (
    <>
      <SEO title="Thông báo coaching" noindex />
      <Header />
      <main className="min-h-screen bg-slate-900 px-4 pb-16 pt-28 text-slate-100 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="rounded-2xl border border-slate-800 bg-slate-950">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 p-5 sm:p-6">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-orange-400">
                  <Bell size={18} aria-hidden="true" /> In-app
                </p>
                <h1 className="mt-2 text-2xl font-bold text-white">
                  Thông báo coaching
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  Chỉ hiển thị tiêu đề chung, không chứa nội dung sức khỏe hay bình luận riêng tư.
                </p>
              </div>
              <button
                type="button"
                onClick={() => readAllMutation.mutate()}
                disabled={!query.data?.unreadCount || readAllMutation.isPending}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm font-semibold text-orange-300 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
              >
                <CheckCheck size={17} aria-hidden="true" /> Đọc tất cả
              </button>
            </header>
            <div className="flex gap-2 border-b border-slate-800 px-5 py-3">
              {[["all", "Tất cả"], ["unread", "Chưa đọc"]].map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={status === value}
                    onClick={() => {
                      setStatus(value);
                      setPage(1);
                    }}
                    className={
                      "min-h-11 rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 " +
                      (status === value
                        ? "bg-orange-500 text-slate-950"
                        : "text-slate-400 hover:bg-slate-900")
                    }
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
            {query.isLoading ? (
              <p className="p-6 text-sm text-slate-400" role="status">
                Đang tải thông báo...
              </p>
            ) : query.isError ? (
              <button
                type="button"
                onClick={() => query.refetch()}
                className="m-6 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <RefreshCw size={16} aria-hidden="true" /> Tải lại thông báo
              </button>
            ) : query.data.items.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">
                Không có thông báo trong mục này.
              </p>
            ) : (
              <ol className="divide-y divide-slate-800">
                {query.data.items.map((item) => (
                  <li key={item._id}>
                    <button
                      type="button"
                      onClick={() => void openItem(item)}
                      className="flex min-h-20 w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400"
                    >
                      <span
                        className={
                          "mt-2 h-2.5 w-2.5 shrink-0 rounded-full " +
                          (item.readAt ? "bg-slate-700" : "bg-orange-400")
                        }
                        aria-label={item.readAt ? "Đã đọc" : "Chưa đọc"}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-200">
                          {item.title}
                        </span>
                        <time
                          dateTime={item.createdAt}
                          className="mt-1 block text-xs text-slate-500"
                        >
                          {formatTime(item.createdAt)}
                        </time>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <footer className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page === 1}
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
              >
                <ChevronLeft size={17} /> Trước
              </button>
              <span className="text-xs text-slate-500">
                Trang {page}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
                disabled={page >= totalPages}
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
              >
                Sau <ChevronRight size={17} />
              </button>
            </footer>
          </section>
          <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <h2 className="font-bold text-white">Tùy chọn thông báo</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Có thể tắt toàn bộ hoặc từng nhóm. Thay đổi chỉ áp dụng cho thông báo mới.
            </p>
            <NotificationPreferences userId={user?._id} />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default NotificationsPage;

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { notificationDestination } from "../utils/notificationDestination";
import { notificationMissingFieldsLabel } from "../utils/notificationMissingFields";
import { NotificationPreferences } from "./NotificationPreferences";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notification.service";

const formatTime = (value) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

export const NotificationCenter = ({ userId, solid = false }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const queryKey = ["notifications", userId];
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await listNotifications({
          status: "all",
          page: 1,
          limit: 10,
        })
      ).data.data,
    enabled: Boolean(userId),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeWithKeyboard = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeWithKeyboard);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [open]);

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const openNotification = async (notification) => {
    try {
      if (!notification.readAt) {
        await readMutation.mutateAsync(notification._id);
      }
    } finally {
      setOpen(false);
      navigate(notificationDestination(notification));
    }
  };
  const unread = query.data?.unreadCount || 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={
          unread > 0
            ? "Thông báo, " + unread + " chưa đọc"
            : "Thông báo"
        }
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className={
          "relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 " +
          (solid
            ? "border-white/20 text-white hover:bg-white/15"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100")
        }
      >
        <Bell size={19} aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] font-bold leading-5 text-white"
          >
            {Math.min(unread, 99)}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Thông báo và tùy chọn"
          className="absolute right-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-left shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <h2 className="font-bold text-white">Thông báo</h2>
              <p className="text-xs text-slate-500">{unread} chưa đọc</p>
            </div>
            <button
              type="button"
              onClick={() => readAllMutation.mutate()}
              disabled={unread === 0 || readAllMutation.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-orange-300 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
            >
              <CheckCheck size={16} aria-hidden="true" /> Đọc tất cả
            </button>
          </div>
          {query.isLoading ? (
            <p className="p-4 text-sm text-slate-400" role="status">
              Đang tải thông báo...
            </p>
          ) : query.isError ? (
            <button
              type="button"
              onClick={() => query.refetch()}
              className="m-4 min-h-11 rounded-lg px-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              Tải lại thông báo
            </button>
          ) : query.data?.items.length ? (
            <ul className="max-h-80 overflow-y-auto">
              {query.data.items.map((notification) => (
                <li key={notification._id}>
                  <button
                    type="button"
                    onClick={() => void openNotification(notification)}
                    className={
                      "w-full border-b border-slate-800 px-4 py-3 text-left hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400 " +
                      (notification.readAt ? "opacity-65" : "")
                    }
                  >
                    <span className="block text-sm font-semibold text-slate-200">
                      {notification.title}
                    </span>
                    {notificationMissingFieldsLabel(
                      notification.missingFields,
                    ) && (
                      <span className="mt-1 block text-xs leading-5 text-amber-200">
                        {notificationMissingFieldsLabel(
                          notification.missingFields,
                        )}
                      </span>
                    )}
                    <time
                      dateTime={notification.createdAt}
                      className="mt-1 block text-xs text-slate-500"
                    >
                      {formatTime(notification.createdAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-slate-400">
              Chưa có thông báo.
            </p>
          )}
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center justify-center border-t border-slate-800 px-4 text-sm font-semibold text-orange-300 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400"
          >
            Xem tất cả thông báo
          </Link>
          <details className="border-t border-slate-800 px-4 py-3">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
              <Settings2 size={16} aria-hidden="true" /> Tùy chọn trong ứng dụng
            </summary>
            <NotificationPreferences userId={userId} compact />
          </details>
        </div>
      )}
    </div>
  );
};

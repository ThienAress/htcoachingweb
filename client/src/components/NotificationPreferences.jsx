import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notification.service";

const OPTIONS = [
  ["inAppEnabled", "Bật thông báo trong ứng dụng"],
  ["comments", "Bình luận huấn luyện"],
  ["journal", "Nhật ký ngày"],
  ["weekly", "Báo cáo tuần"],
];

const PreferenceToggle = ({ label, checked, onChange, disabled }) => (
  <label className="flex min-h-11 items-center justify-between gap-4 text-sm text-slate-300">
    {label}
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      disabled={disabled}
      className="h-5 w-5 accent-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
    />
  </label>
);

export const NotificationPreferences = ({ userId, compact = false }) => {
  const queryClient = useQueryClient();
  const queryKey = ["notification-preferences", userId];
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey,
    queryFn: async () => (await getNotificationPreferences()).data.data,
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (response) => {
      const next = response.data.data;
      setDraft(next);
      setSaved(true);
      queryClient.setQueryData(queryKey, next);
    },
    onError: (error) => {
      setSaved(false);
      if (error.response?.status === 409) {
        setDraft(null);
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const preferences = draft || query.data;
  const save = () => {
    if (!preferences) return;
    setSaved(false);
    mutation.mutate({
      expectedRevision: preferences.revision,
      inAppEnabled: preferences.inAppEnabled,
      comments: preferences.comments,
      journal: preferences.journal,
      weekly: preferences.weekly,
    });
  };

  if (query.isLoading) {
    return <p className="py-3 text-sm text-slate-400" role="status">Đang tải tùy chọn...</p>;
  }
  if (query.isError) {
    return (
      <button
        type="button"
        onClick={() => query.refetch()}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <RefreshCw size={16} aria-hidden="true" /> Tải lại tùy chọn
      </button>
    );
  }
  if (!preferences) return null;

  return (
    <div className={compact ? "space-y-1" : "mt-4 space-y-2"}>
      {OPTIONS.map(([key, label]) => (
        <PreferenceToggle
          key={key}
          label={label}
          checked={preferences[key]}
          disabled={mutation.isPending}
          onChange={(checked) => {
            setSaved(false);
            setDraft((current) => ({
              ...(current || query.data),
              [key]: checked,
            }));
          }}
        />
      ))}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={mutation.isPending}
          className="min-h-11 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
        >
          {mutation.isPending ? "Đang lưu..." : "Lưu tùy chọn"}
        </button>
        <span className="text-xs text-slate-400" aria-live="polite">
          {saved
            ? "Đã lưu."
            : mutation.isError
              ? mutation.error.response?.data?.message || "Không thể lưu tùy chọn."
              : ""}
        </span>
      </div>
    </div>
  );
};

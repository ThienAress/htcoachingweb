import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notification.service";
import { getInitialEmailSelectionError } from "./notificationPreferences.utils";

const IN_APP_OPTIONS = [
  ["inAppEnabled", "Bật thông báo trong ứng dụng"],
  ["comments", "Bình luận huấn luyện"],
  ["journal", "Nhật ký ngày"],
  ["weekly", "Báo cáo tuần"],
];
const EMAIL_OPTIONS = [
  ["morningHealthEmail", "Nhắc cập nhật Mục tiêu sức khỏe mỗi sáng"],
  ["checkinEmail", "Thông báo check-in buổi tập"],
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

export const NotificationPreferences = ({
  userId,
  compact = false,
  channel = "in_app",
}) => {
  const queryClient = useQueryClient();
  const queryKey = ["notification-preferences", userId];
  const isEmailChannel = channel === "email";
  const options = isEmailChannel ? EMAIL_OPTIONS : IN_APP_OPTIONS;
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
      if (isEmailChannel) setIsEditing(false);
      queryClient.setQueryData(queryKey, next);
      toast.success(
        isEmailChannel
          ? "Đã lưu email thông báo"
          : "Đã lưu tùy chọn thông báo",
      );
    },
    onError: (error) => {
      setSaved(false);
      if (error.response?.status === 409) {
        setDraft(null);
        void queryClient.invalidateQueries({ queryKey });
      }
      toast.error(
        error.response?.data?.message ||
          (isEmailChannel
            ? "Không thể lưu tùy chọn email"
            : "Không thể lưu tùy chọn thông báo"),
      );
    },
  });

  const preferences = draft || query.data;
  const save = () => {
    if (!preferences) return;
    const selectionError = isEmailChannel
      ? getInitialEmailSelectionError(preferences)
      : "";
    if (selectionError) {
      toast.error(selectionError);
      return;
    }
    setSaved(false);
    const payload = {
      expectedRevision: preferences.revision,
      inAppEnabled: preferences.inAppEnabled,
      comments: preferences.comments,
      journal: preferences.journal,
      weekly: preferences.weekly,
    };
    if (isEmailChannel) {
      payload.morningHealthEmail = preferences.morningHealthEmail === true;
      payload.checkinEmail = preferences.checkinEmail === true;
    }
    mutation.mutate(payload);
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

  const emailEligible = !isEmailChannel || preferences.emailEligible === true;
  const emailLocked =
    isEmailChannel && preferences.customerEmailConfigured === true && !isEditing;
  const fieldsDisabled =
    mutation.isPending || !emailEligible || emailLocked;

  return (
    <div className={compact ? "space-y-1" : "mt-4 space-y-2"}>
      {options.map(([key, label]) => (
        <PreferenceToggle
          key={key}
          label={label}
          checked={preferences[key] === true}
          disabled={fieldsDisabled}
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
          onClick={() => {
            if (emailLocked) {
              setSaved(false);
              setIsEditing(true);
              return;
            }
            save();
          }}
          disabled={mutation.isPending || !emailEligible}
          className="min-h-11 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
        >
          {mutation.isPending
            ? "Đang lưu..."
            : isEmailChannel
              ? emailLocked
                ? "Cập nhật"
                : "Lưu"
              : "Lưu tùy chọn"}
        </button>
        {isEmailChannel && isEditing && preferences.customerEmailConfigured && (
          <button
            type="button"
            onClick={() => {
              setDraft(query.data);
              setSaved(false);
              setIsEditing(false);
            }}
            disabled={mutation.isPending}
            className="min-h-11 rounded-lg border border-slate-600 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-40"
          >
            Hủy
          </button>
        )}
        <span className="text-xs text-slate-400" aria-live="polite">
          {saved
            ? "Đã lưu."
            : mutation.isError
              ? mutation.error.response?.data?.message || "Không thể lưu tùy chọn."
              : ""}
        </span>
      </div>
      {isEmailChannel && !emailEligible && (
        <p className="text-xs leading-5 text-amber-300" role="status">
          Bạn cần có gói coaching còn hiệu lực và đã được phân công HLV để sử dụng mục này.
        </p>
      )}
    </div>
  );
};

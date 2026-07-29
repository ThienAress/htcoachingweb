import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { reviewTrainerWeeklyCheckin } from "../../services/weeklyCheckin.service";
import { CoachingCommentThread } from "../today-dashboard/CoachingCommentThread";

const requestId = () => window.crypto.randomUUID();

export const TrainerWeeklyReview = ({ clientId, checkin, onChanged }) => {
  const [message, setMessage] = useState(
    checkin?.trainerReview?.message || "",
  );
  const [rating, setRating] = useState(
    checkin?.trainerReview?.rating ?? "",
  );
  const [failedPayload, setFailedPayload] = useState(null);
  const mutation = useMutation({
    mutationFn: (payload) =>
      reviewTrainerWeeklyCheckin(
        clientId,
        checkin.weekStartDateKey,
        payload,
      ),
    onSuccess: (response) => {
      setFailedPayload(null);
      onChanged(response.data.data);
    },
    onError: (_error, payload) => setFailedPayload(payload),
  });

  if (!checkin) {
    return (
      <section className="rounded-2xl border border-gray-700/50 bg-gray-950/40 p-5">
        <h3 className="font-bold text-white">Weekly Check-in</h3>
        <p className="mt-2 text-sm text-gray-400">
          Học viên chưa gửi check-in tuần hiện tại.
        </p>
      </section>
    );
  }

  const submit = () => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;
    mutation.mutate({
      expectedRevision: checkin.revision,
      requestId: requestId(),
      review: {
        message: cleanMessage,
        rating: rating === "" ? null : Number(rating),
      },
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-700/50 bg-gray-950/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-white">Review Weekly Check-in</h3>
            <p className="mt-1 text-xs text-gray-500">
              Tuần {checkin.weekStartDateKey} · revision {checkin.revision}
            </p>
          </div>
          <span className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300">
            {checkin.status}
          </span>
        </div>
        <label htmlFor="trainer-weekly-review" className="mt-4 block text-sm text-gray-300">
          Phản hồi cho học viên
          <textarea
            id="trainer-weekly-review"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={2000}
            rows="3"
            className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
          />
        </label>
        <label htmlFor="trainer-weekly-rating" className="mt-3 block text-sm text-gray-300">
          Đánh giá tùy chọn (1–10)
          <input
            id="trainer-weekly-rating"
            type="number"
            min="1"
            max="10"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            className="mt-2 min-h-11 w-32 rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
          />
        </label>
        {mutation.isError && (
          <p className="mt-3 text-sm text-red-300" role="status">
            {mutation.error?.response?.data?.message ||
              "Không thể lưu review."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!message.trim() || mutation.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-gray-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
          >
            <Send size={16} aria-hidden="true" /> Lưu review
          </button>
          {failedPayload && (
            <button
              type="button"
              onClick={() => mutation.mutate(failedPayload)}
              disabled={mutation.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-800 px-4 text-sm font-semibold text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <RefreshCw size={16} aria-hidden="true" /> Thử lại lệnh cũ
            </button>
          )}
        </div>
      </section>
      <CoachingCommentThread
        targetType="weekly_checkin"
        targetId={checkin._id}
        title="Trao đổi về check-in tuần"
      />
    </div>
  );
};

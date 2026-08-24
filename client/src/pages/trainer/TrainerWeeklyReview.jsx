import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { reviewTrainerWeeklyCheckin } from "../../services/weeklyCheckin.service";
import { CoachingCommentThread } from "../today-dashboard/CoachingCommentThread";

const requestId = () => window.crypto.randomUUID();
const STATUS_LABELS = {
  submitted: "Đã gửi",
  reviewed: "Đã nhận xét",
};
const WEEKLY_MEASUREMENTS = [
  ["weightKg", "Cân nặng", "kg"],
  ["waistCm", "Vòng eo", "cm"],
  ["bodyFatPercent", "Tỷ lệ mỡ cơ thể", "%"],
  ["skeletalMusclePercent", "Tỷ lệ cơ xương", "%"],
];

export const TrainerWeeklyMeasurements = ({ body = {} }) => (
  <dl className="mt-4 grid gap-px overflow-hidden rounded-xl bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
    {WEEKLY_MEASUREMENTS.map(([key, label, unit]) => {
      const value = Number(body[key]);
      const available = body[key] !== null && body[key] !== undefined && Number.isFinite(value);
      return (
        <div key={key} className="bg-slate-950 px-4 py-3">
          <dt className="text-xs font-semibold text-slate-500">{label}</dt>
          <dd className="mt-1 text-sm font-bold text-slate-100">
            {available
              ? `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${unit}`
              : "Chưa ghi"}
          </dd>
        </div>
      );
    })}
  </dl>
);

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
        <h3 className="font-bold text-white">Báo cáo tuần</h3>
        <p className="mt-2 text-sm text-gray-400">
          Học viên chưa gửi báo cáo tuần hiện tại.
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
            <h3 className="font-bold text-white">Nhận xét báo cáo tuần</h3>
            <p className="mt-1 text-xs text-gray-500">
              Tuần {checkin.weekStartDateKey} · phiên bản {checkin.revision}
            </p>
          </div>
          <span className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300">
            {STATUS_LABELS[checkin.status] || "Bản nháp"}
          </span>
        </div>
        <TrainerWeeklyMeasurements body={checkin.body} />
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
              "Không thể lưu nhận xét."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!message.trim() || mutation.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-gray-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
          >
            <Send size={16} aria-hidden="true" /> Lưu nhận xét
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
        title="Trao đổi về báo cáo tuần"
      />
    </div>
  );
};

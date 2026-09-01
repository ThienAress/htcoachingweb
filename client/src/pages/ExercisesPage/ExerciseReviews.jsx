import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessageCircle, Send, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { useAuth } from "../../context/AuthContext";
import { exerciseReviewsQueryOptions } from "../../queries/exercise.queries";
import {
  deleteExerciseReview,
  saveExerciseReview,
} from "../../services/exercise.service";

const RatingStars = ({ value, onChange, readOnly = false, label }) => (
  <div className="flex items-center gap-1" aria-label={label}>
    {[1, 2, 3, 4, 5].map((star) =>
      readOnly ? (
        <Star
          key={star}
          className={`size-5 ${star <= value ? "fill-amber-300 text-amber-300" : "text-gray-600"}`}
          aria-hidden="true"
        />
      ) : (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className="rounded p-1 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`${star}/5`}
          aria-pressed={star === value}
        >
          <Star
            className={`size-6 ${star <= value ? "fill-amber-300 text-amber-300" : "text-gray-600"}`}
            aria-hidden="true"
          />
        </button>
      ),
    )}
  </div>
);

export default function ExerciseReviews({ exerciseId }) {
  const { t } = useTranslation("exercises");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryOptions = exerciseReviewsQueryOptions(exerciseId);
  const query = useQuery(queryOptions);
  const data = query.data?.data;
  const viewerReview = data?.myReview;
  const [draft, setDraft] = useState(null);
  const rating = draft?.rating ?? viewerReview?.rating ?? 0;
  const comment = draft?.comment ?? viewerReview?.comment ?? "";

  const saveMutation = useMutation({
    mutationFn: () => saveExerciseReview(exerciseId, { rating, comment }),
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
      toast.success(
        viewerReview ? "Đã cập nhật đánh giá bài tập" : "Đã gửi đánh giá bài tập",
      );
    },
    onError: (error) =>
      toast.error(
        error.response?.data?.message || t("detail.reviews.save_error"),
      ),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteExerciseReview(exerciseId),
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
      toast.success("Đã xóa đánh giá bài tập");
    },
    onError: (error) =>
      toast.error(
        error.response?.data?.message || "Không thể xóa đánh giá bài tập",
      ),
  });

  return (
    <section
      data-exercise-reviews="standalone"
      aria-labelledby="exercise-reviews-title"
      className="border-t border-gray-800 bg-gray-900 py-14"
    >
      <div className="container-custom">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-primary">
              <MessageCircle className="size-5" aria-hidden="true" />
              {t("detail.reviews.eyebrow")}
            </div>
            <h2
              id="exercise-reviews-title"
              className="text-3xl font-black uppercase text-white text-balance"
            >
              {t("detail.reviews.title")}
            </h2>
          </div>
          {data?.summary?.total > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-300">
              <Star
                className="size-5 fill-amber-300 text-amber-300"
                aria-hidden="true"
              />
              <strong className="text-lg text-white">
                {data.summary.averageRating}
              </strong>
              <span>({data.summary.total})</span>
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            {user ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (rating > 0 && !saveMutation.isPending) {
                    saveMutation.mutate();
                  }
                }}
                className="rounded-2xl border border-gray-700 bg-gray-950 p-5"
              >
                <label className="text-sm font-bold text-white">
                  {t("detail.reviews.your_rating")}
                </label>
                <div className="mt-2">
                  <RatingStars
                    value={rating}
                    onChange={(nextRating) =>
                      setDraft({ rating: nextRating, comment })
                    }
                    label={t("detail.reviews.rating_label")}
                  />
                </div>
                <label htmlFor="exercise-review-comment" className="sr-only">
                  {t("detail.reviews.comment_label")}
                </label>
                <textarea
                  id="exercise-review-comment"
                  value={comment}
                  onChange={(event) =>
                    setDraft({
                      rating,
                      comment: event.target.value.slice(0, 1000),
                    })
                  }
                  placeholder={t("detail.reviews.comment_placeholder")}
                  rows={5}
                  maxLength={1000}
                  className="mt-4 w-full resize-y rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500">
                    {comment.length}/1000
                  </span>
                  <button
                    type="submit"
                    disabled={!rating || saveMutation.isPending}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="size-4" aria-hidden="true" />
                    {viewerReview
                      ? t("detail.reviews.update")
                      : t("detail.reviews.submit")}
                  </button>
                </div>
                {saveMutation.isError && (
                  <p className="mt-3 text-sm text-red-300" role="alert">
                    {saveMutation.error?.response?.data?.message ||
                      t("detail.reviews.save_error")}
                  </p>
                )}
              </form>
            ) : (
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5 text-sm text-gray-200">
                <Link
                  to="/login"
                  className="font-bold text-orange-300 hover:underline"
                >
                  {t("detail.reviews.login_cta")}
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
            {query.isLoading ? (
              <p className="text-sm text-gray-400" role="status">
                {t("detail.reviews.loading")}
              </p>
            ) : query.isError ? (
              <p className="text-sm text-red-300" role="alert">
                {t("detail.reviews.load_error")}
              </p>
            ) : data?.items?.length ? (
              <div className="space-y-5">
                {data.items.map((review) => (
                  <article
                    key={review.id}
                    className="border-b border-gray-800 pb-5 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <strong className="text-sm text-white">
                          {review.displayName}
                        </strong>
                        <div className="mt-1">
                          <RatingStars
                            value={review.rating}
                            readOnly
                            label={`${review.rating}/5`}
                          />
                        </div>
                      </div>
                      {review.isOwner && (
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate()}
                          disabled={deleteMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          {t("detail.reviews.delete")}
                        </button>
                      )}
                    </div>
                    {review.comment && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-300">
                        {review.comment}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                {t("detail.reviews.empty")}
              </p>
            )}
            {deleteMutation.isError && (
              <p className="mt-4 text-sm text-red-300" role="alert">
                {deleteMutation.error?.response?.data?.message ||
                  t("detail.reviews.delete_error")}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

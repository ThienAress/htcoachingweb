import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessageCircle, Send, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { deleteRecipeReview, saveRecipeReview } from "../../services/recipe.service";
import { useAuth } from "../../context/AuthContext";
import { recipeReviewsQueryOptions } from "../../queries/recipe.queries";

const Stars = ({ value, onChange, readOnly = false, label }) => (
  <div className="flex items-center gap-1" aria-label={label}>
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type={readOnly ? undefined : "button"}
        disabled={readOnly}
        onClick={() => onChange?.(star)}
        className={`rounded p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${readOnly ? "cursor-default" : "hover:bg-primary/10"}`}
        aria-label={`${star}/5`}
      >
        <Star className={`h-5 w-5 ${star <= value ? "fill-amber-300 text-amber-300" : "text-zinc-600"}`} />
      </button>
    ))}
  </div>
);

const RecipeReviews = ({ recipeId }) => {
  const { t } = useTranslation("recipe");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery(recipeReviewsQueryOptions(recipeId));
  const data = query.data?.data;
  const viewerReview = data?.myReview;
  const [draft, setDraft] = useState(null);
  const rating = draft?.rating ?? viewerReview?.rating ?? 0;
  const comment = draft?.comment ?? viewerReview?.comment ?? "";

  const saveMutation = useMutation({
    mutationFn: () => saveRecipeReview(recipeId, { rating, comment }),
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: recipeReviewsQueryOptions(recipeId).queryKey });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteRecipeReview(recipeId),
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: recipeReviewsQueryOptions(recipeId).queryKey });
    },
  });

  return (
    <section aria-labelledby="recipe-reviews-title" className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="recipe-reviews-title" className="flex items-center gap-3 text-xl font-bold text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            {t("detail.reviews.title")}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">{t("detail.reviews.caption")}</p>
        </div>
        {data?.summary?.total > 0 && (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Star className="h-5 w-5 fill-amber-300 text-amber-300" aria-hidden="true" />
            <strong className="text-white">{data.summary.averageRating}</strong>
            <span>({data.summary.total})</span>
          </div>
        )}
      </div>

      {user ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (rating > 0 && !saveMutation.isPending) saveMutation.mutate();
          }}
          className="mb-8 rounded-xl border border-zinc-700/70 bg-zinc-800/40 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm font-semibold text-zinc-200">{t("detail.reviews.your_rating")}</label>
            <Stars
              value={rating}
              onChange={(nextRating) => setDraft({ rating: nextRating, comment })}
              label={t("detail.reviews.rating_label")}
            />
          </div>
          <textarea
            value={comment}
            onChange={(event) => setDraft({ rating, comment: event.target.value.slice(0, 1000) })}
            placeholder={t("detail.reviews.comment_placeholder")}
            rows={3}
            maxLength={1000}
            className="mt-4 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">{comment.length}/1000</span>
            <button
              type="submit"
              disabled={!rating || saveMutation.isPending}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {viewerReview ? t("detail.reviews.update") : t("detail.reviews.submit")}
            </button>
          </div>
          {saveMutation.isError && <p className="mt-2 text-sm text-red-300">{t("detail.reviews.save_error")}</p>}
        </form>
      ) : (
        <div className="mb-8 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-zinc-200">
          <Link to="/login" className="font-semibold text-primary hover:underline">{t("detail.reviews.login_cta")}</Link>
        </div>
      )}

      {query.isLoading ? (
        <p className="text-sm text-zinc-400">{t("detail.reviews.loading")}</p>
      ) : query.isError ? (
        <p className="text-sm text-red-300">{t("detail.reviews.load_error")}</p>
      ) : data?.items?.length ? (
        <div className="space-y-4">
          {data.items.map((review) => (
            <article key={review.id} className="border-b border-zinc-800 pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <strong className="text-sm text-white">{review.displayName}</strong>
                  <Stars value={review.rating} readOnly label={`${review.rating}/5`} />
                </div>
                {review.isOwner && (
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("detail.reviews.delete")}
                  </button>
                )}
              </div>
              {review.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{review.comment}</p>}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">{t("detail.reviews.empty")}</p>
      )}
    </section>
  );
};

export default RecipeReviews;

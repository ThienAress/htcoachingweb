import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react";
import { useState } from "react";
import {
  createCoachingComment,
  editCoachingComment,
  listCoachingComments,
  removeCoachingComment,
} from "../../services/coachingComment.service";
import { commentThreadKey } from "./coachingCommentViewModel";
import { CoachingCommentItem } from "./CoachingCommentItem";

const requestId = () => window.crypto.randomUUID();
const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.errors?.[0]?.msg ||
  "Không thể cập nhật trao đổi lúc này.";

export const CoachingCommentThread = ({
  targetType,
  targetId,
  title = "Trao đổi với HLV",
}) => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [failedCommand, setFailedCommand] = useState(null);
  const queryKey = commentThreadKey(targetType, targetId, page);
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await listCoachingComments(targetType, targetId, {
          page,
          limit: 20,
        })
      ).data.data,
    enabled: Boolean(targetType && targetId),
    staleTime: 15_000,
  });
  const mutation = useMutation({
    mutationFn: ({ kind, commentId, payload }) => {
      if (kind === "edit") return editCoachingComment(commentId, payload);
      if (kind === "remove") return removeCoachingComment(commentId, payload);
      return createCoachingComment(payload);
    },
    onSuccess: () => {
      setFailedCommand(null);
      setConfirming(null);
      setEditing(null);
      void queryClient.invalidateQueries({
        queryKey: commentThreadKey(targetType, targetId),
      });
    },
    onError: (_error, variables) => setFailedCommand(variables),
  });

  const submitDraft = () => {
    const body = draft.trim();
    if (!body) return;
    mutation.mutate({
      kind: "create",
      payload: {
        targetType,
        targetId,
        requestId: requestId(),
        body,
      },
    });
    setDraft("");
  };
  const saveEdit = () => {
    const body = editing?.body.trim();
    if (!body) return;
    mutation.mutate({
      kind: "edit",
      commentId: editing._id,
      payload: {
        expectedRevision: editing.revision,
        requestId: requestId(),
        body,
      },
    });
  };
  const remove = (comment) =>
    mutation.mutate({
      kind: "remove",
      commentId: comment._id,
      payload: {
        expectedRevision: comment.revision,
        requestId: requestId(),
      },
    });

  const comments = query.data?.items || [];
  const pagination = query.data?.pagination || {
    page,
    limit: 20,
    total: 0,
  };
  const hasNext = page * pagination.limit < pagination.total;
  const canComment = Boolean(query.data?.capabilities?.canComment);
  const threadId = "comment-thread-" + targetType + "-" + targetId;

  return (
    <section
      className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6"
      aria-labelledby={threadId}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2
            id={threadId}
            className="flex items-center gap-2 font-bold text-white"
          >
            <MessageSquare size={19} className="text-orange-400" aria-hidden="true" />
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Text-only · không gửi link hoặc nội dung HTML
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {pagination.total} bình luận
        </span>
      </div>

      {query.isLoading ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-900" role="status">
          <span className="sr-only">Đang tải trao đổi...</span>
        </div>
      ) : query.isError ? (
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <RefreshCw size={16} aria-hidden="true" /> Tải lại trao đổi
        </button>
      ) : comments.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
          Chưa có trao đổi cho nội dung này.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-800">
          {comments.map((comment) => (
            <CoachingCommentItem
              key={comment._id}
              comment={comment}
              editing={editing}
              setEditing={setEditing}
              confirming={confirming}
              setConfirming={setConfirming}
              disabled={mutation.isPending}
              onSave={saveEdit}
              onRemove={remove}
              canMutate={canComment}
            />
          ))}
        </ul>
      )}

      {(page > 1 || hasNext) && (
        <nav className="mt-3 flex justify-end gap-2" aria-label="Phân trang trao đổi">
          <button
            type="button"
            onClick={() => setPage((value) => value - 1)}
            disabled={page === 1}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-30"
            aria-label="Trang trao đổi trước"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setPage((value) => value + 1)}
            disabled={!hasNext}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-30"
            aria-label="Trang trao đổi sau"
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}

      {mutation.isError && (
        <div className="mt-3 text-sm text-red-300" role="status">
          <p>{errorMessage(mutation.error)}</p>
          {failedCommand && (
            <button
              type="button"
              onClick={() => mutation.mutate(failedCommand)}
              className="mt-2 min-h-11 rounded-lg px-2 font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              Thử lại lệnh cũ
            </button>
          )}
        </div>
      )}

      <div className="mt-5">
        {!canComment && !query.isLoading && !query.isError && (
          <p className="mb-3 text-sm text-slate-500">
            Luồng này hiện chỉ có thể xem.
          </p>
        )}
        <label htmlFor={"new-comment-" + targetType + "-" + targetId} className="sr-only">
          Nội dung bình luận mới
        </label>
        <textarea
          id={"new-comment-" + targetType + "-" + targetId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          disabled={!canComment || mutation.isPending}
          rows="3"
          placeholder="Viết trao đổi ngắn, rõ và đúng ngữ cảnh..."
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white placeholder:text-slate-600 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
        />
        <button
          type="button"
          onClick={submitDraft}
          disabled={!canComment || !draft.trim() || mutation.isPending}
          className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
        >
          <Send size={16} aria-hidden="true" /> Gửi trao đổi
        </button>
      </div>
    </section>
  );
};

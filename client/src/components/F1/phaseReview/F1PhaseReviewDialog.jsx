import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Lock, X } from "lucide-react";
import { toast } from "react-toastify";
import { useModalScrollLock } from "../../../hooks/useModalScrollLock";
import { savePhaseReview, saveStageProfile } from "../../../services/f1Customer.service";
import { PHASE_NAMES, expectedNextPhaseTitle } from "../../../constants/f1Phases";
import { phaseReviewsQueryKey, toPayload } from "../../../utils/f1PhaseReview";
import F1PhaseReviewForm from "./F1PhaseReviewForm";
import F1PhaseReviewProfileForm from "./F1PhaseReviewProfileForm";
import F1CustomerSummaryReport from "../F1CustomerSummaryReport";
import F1PhaseReviewResult from "./F1PhaseReviewResult";

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.errors?.[0]?.msg ||
  "Lưu đánh giá cuối giai đoạn thất bại";

const Preview = ({ context, reviewedStage, onStart }) => (
  <div className="space-y-5">
    <div className="flex gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <Lock size={22} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
      <p className="text-sm text-slate-600">
        Ở giai đoạn {reviewedStage} {PHASE_NAMES[context.phaseKey] || context.phaseKey} kéo dài khoảng{" "}
        {context.durationWeeks} tuần. HLV nhập số đo mới, số buổi đã tập, mức làm theo lời khuyên và test lại các bài đã
        test. Hệ thống chấm mức hoàn thành và đề xuất giai đoạn {reviewedStage + 1}.
      </p>
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      {[
        ["Tuân thủ · 40%", "Số buổi đã tập so với kế hoạch (20%) và mức làm theo lời khuyên (20%)."],
        ["Thể lực và kỹ thuật · 40%", "Test lại các bài đã test (30%) và Squat tay qua đầu (10%)."],
        ["Chỉ số cơ thể · 20%", "Thay đổi thực tế so với dự kiến. Đạt 80% mức dự kiến là đủ điểm."],
      ].map(([title, text]) => (
        <div key={title} className="rounded-xl border border-slate-200 p-4">
          <p className="font-semibold text-slate-800">{title}</p>
          <p className="mt-1 text-sm text-slate-600">{text}</p>
        </div>
      ))}
    </div>
    <p className="text-xs text-slate-500">
      ≥ 80%: chuyển giai đoạn · 60–79%: kéo dài 2–4 tuần · dưới 60%: lặp lại · đau hoặc chấn thương mới: HLV xem lại
    </p>
    <div className="flex justify-start">
      <button type="button" onClick={onStart} className="rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-2.5 font-bold text-white shadow-md">
        Nhập kết quả cuối giai đoạn {reviewedStage}
      </button>
    </div>
  </div>
);

const F1PhaseReviewDialog = ({ customer, stageOrder, data, loading, error, onClose, onProfileSaved }) => {
  const closeRef = useRef(null);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  useModalScrollLock(true);

  const reviewedStage = stageOrder - 1;
  const review = data?.reviews?.find((item) => item.stageOrder === reviewedStage) || null;
  const context = data?.contexts?.[reviewedStage] || null;
  const isLatestReview = reviewedStage === (data?.reviews?.length || 0);

  const mutation = useMutation({
    mutationFn: (values) => savePhaseReview(customer._id, reviewedStage, toPayload(values)),
    onSuccess: (res) => {
      queryClient.setQueryData(phaseReviewsQueryKey(customer._id), res);
      setEditing(false);
      // Sau khi lưu kết quả giai đoạn trước, hỏi lại mục tiêu cho giai đoạn kế tiếp.
      setProfileOpen(true);
      toast.success(res?.message || "Đã lưu đánh giá cuối giai đoạn");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const profileMutation = useMutation({
    mutationFn: (values) => saveStageProfile(customer._id, reviewedStage, values),
    onSuccess: (res) => {
      queryClient.setQueryData(phaseReviewsQueryKey(customer._id), res);
      setProfileOpen(false);
      toast.success(res?.message || "Đã dựng lộ trình giai đoạn kế tiếp");
      onProfileSaved?.(stageOrder);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const busy = mutation.isPending || profileMutation.isPending;

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy && !summaryOpen) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, busy, summaryOpen]);

  // Tên giai đoạn: đã có đề xuất thì lấy theo đề xuất, chưa có thì ghi giai đoạn dự kiến.
  const phaseTitle =
    review?.nextPhasePlan?.phaseTitle || (context ? expectedNextPhaseTitle(context.phaseKey) : "");
  let subtitle = "";
  if (editing) subtitle = `Nhập kết quả cuối giai đoạn ${reviewedStage}`;
  else if (profileOpen && review) subtitle = `Cập nhật mục tiêu cho giai đoạn ${stageOrder}`;
  else if (review) {
    subtitle = `Kết quả cuối giai đoạn ${reviewedStage} · đo ngày ${new Date(review.measuredAt).toLocaleDateString("vi-VN")}`;
  } else if (!context) subtitle = `Cần đánh giá xong giai đoạn ${reviewedStage - 1} trước`;

  let body;
  if (loading || error || !data) {
    body = (
      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
        {loading ? "Đang tải dữ liệu đánh giá..." : "Không tải được dữ liệu đánh giá. Hãy đóng và thử lại."}
      </p>
    );
  } else if (editing && context) {
    body = (
      <F1PhaseReviewForm
        stageOrder={reviewedStage}
        context={context}
        review={review}
        saving={mutation.isPending}
        onSubmit={(values) => mutation.mutate(values)}
        onCancel={() => setEditing(false)}
      />
    );
  } else if (review && profileOpen && context) {
    body = (
      <F1PhaseReviewProfileForm
        stageOrder={stageOrder}
        defaults={context.profileDefaults}
        saving={profileMutation.isPending}
        onSubmit={(values) => profileMutation.mutate(values)}
        onCancel={() => setProfileOpen(false)}
      />
    );
  } else if (review) {
    body = <F1PhaseReviewResult review={review} showNext={false} />;
  } else if (context) {
    body = <Preview context={context} reviewedStage={reviewedStage} onStart={() => setEditing(true)} />;
  } else {
    body = (
      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
        Giai đoạn {stageOrder} mở sau khi HLV đánh giá xong giai đoạn {reviewedStage - 1} và giai đoạn {reviewedStage}.
      </p>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 p-3 md:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="f1-phase-review-title"
        data-testid="f1-phase-review-dialog"
        className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">
              {customer?.fullName} · {customer?.code || "--"}
            </p>
            <h2 id="f1-phase-review-title" className="text-2xl font-extrabold text-slate-800">
              Giai đoạn {stageOrder}
              {phaseTitle ? `: ${phaseTitle}` : ""}
            </h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSummaryOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ClipboardList size={16} aria-hidden="true" />
              Báo cáo tổng quát
            </button>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Đóng"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">{body}</div>
        {review && !editing && !profileOpen && (
          <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-3">
            {isLatestReview && context && (
              <button type="button" onClick={() => setEditing(true)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50">
                Sửa kết quả
              </button>
            )}
            {isLatestReview && context && (
              <button type="button" onClick={() => setProfileOpen(true)} className="rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-2.5 font-bold text-white shadow-md">
                {review.profileConfirmed
                  ? `Sửa mục tiêu giai đoạn ${stageOrder}`
                  : `Cập nhật mục tiêu giai đoạn ${stageOrder}`}
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-800 px-5 py-2.5 font-medium text-white hover:bg-slate-700">
              Đóng
            </button>
          </footer>
        )}
      </section>
      {summaryOpen && (
        <F1CustomerSummaryReport customer={customer} onClose={() => setSummaryOpen(false)} />
      )}
    </div>
  );
};

export default F1PhaseReviewDialog;

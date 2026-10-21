import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/AuthContext";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { mySelfAssessmentQueryOptions } from "../../queries/fitnessSelfAssessment.queries";
import { selfAssessmentKeys } from "../../queries/queryKeys";
import { saveSelfAssessmentDraft, submitSelfAssessment } from "../../services/fitnessSelfAssessment.service";
import { getUserErrorMessage } from "../../utils/errorMessages";
import AssessmentHistory from "./AssessmentHistory";
import ProfileStep from "./ProfileStep";
import ResultView from "./ResultView";
import { formatDate } from "./format";
import ScreeningStep from "./ScreeningStep";
import TestsStep from "./TestsStep";
import { FITNESS_PLUS_PLANS_PATH, STEP_TITLES } from "./constants";

const Stepper = ({ current }) => (
  <ol aria-label="Các bước đánh giá" className="grid grid-cols-3 gap-2">
    {STEP_TITLES.map(({ step, title }) => (
      <li
        key={step}
        aria-current={step === current ? "step" : undefined}
        className={`rounded-xl border px-3 py-2 text-xs font-semibold sm:text-sm ${
          step === current
            ? "border-orange-400 bg-orange-400/10 text-orange-200"
            : step < current
              ? "border-emerald-500/40 text-emerald-300"
              : "border-slate-700 text-slate-500"
        }`}
      >
        <span className="mr-1">{step}.</span>
        {title}
      </li>
    ))}
  </ol>
);

const Notice = ({ icon: Icon, title, children, action }) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-400/10 text-orange-300">
      <Icon aria-hidden="true" className="h-6 w-6" />
    </span>
    <h2 className="mt-4 text-2xl font-bold text-white">{title}</h2>
    <div className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{children}</div>
    {action && <div className="mt-6">{action}</div>}
  </section>
);

const primaryButton =
  "inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-6 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-60";

const resumeStep = (draft) => Math.min((draft?.draftStep || 0) + 1, 3);

const SelfAssessmentPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const query = useQuery(mySelfAssessmentQueryOptions({ userId: user?._id }));
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState(null);
  const [viewed, setViewed] = useState(null);

  const cacheKey = selfAssessmentKeys.mine(user?._id);
  const saveMutation = useMutation({
    mutationFn: async (payload) => (await saveSelfAssessmentDraft(payload)).data.data,
    onSuccess: (draft) => queryClient.setQueryData(cacheKey, (old) => ({ ...old, draft })),
    onError: (error) => toast.error(getUserErrorMessage(error, "Không lưu được thông tin. Vui lòng thử lại.")),
  });
  const submitMutation = useMutation({
    mutationFn: async (id) => (await submitSelfAssessment(id)).data.data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: selfAssessmentKeys.all() });
      await queryClient.invalidateQueries({ queryKey: ["today-dashboard", "prompt-eligibility"] });
      setMode("result");
      setStep(null);
      setViewed(null);
      toast.success("Đã lưu kết quả đánh giá của bạn.");
    },
    onError: (error) => toast.error(getUserErrorMessage(error, "Chưa hoàn tất được đánh giá. Vui lòng thử lại.")),
  });

  const data = query.data;
  const pending = saveMutation.isPending || submitMutation.isPending;

  let content;
  if (query.isPending) {
    content = (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-400">
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Đang tải đánh giá của bạn...
      </div>
    );
  } else if (query.isError) {
    content = (
      <Notice
        icon={ClipboardCheck}
        title="Chưa tải được đánh giá"
        action={
          <button type="button" className={primaryButton} onClick={() => query.refetch()}>
            Thử lại
          </button>
        }
      >
        {getUserErrorMessage(query.error, "Không tải được đánh giá. Vui lòng thử lại.")}
      </Notice>
    );
  } else {
    const { canWrite, draft, latestCompleted, retest } = data;
    const effectiveMode =
      mode || (draft && canWrite ? "wizard" : latestCompleted ? "result" : canWrite ? "intro" : "locked");

    const goNext = (current) => setStep(current + 1);
    const finish = async () => {
      try {
        await submitMutation.mutateAsync(data.draft.id);
      } catch {
        /* thông báo lỗi đã hiện qua toast */
      }
    };
    const saveThen = async (payload, after) => {
      try {
        await saveMutation.mutateAsync(payload);
        await after();
      } catch {
        /* thông báo lỗi đã hiện qua toast */
      }
    };
    const startOver = async () => {
      if (retest?.isEarly) {
        const ok = await confirm({
          title: "Làm lại sớm hơn khuyến nghị?",
          message: `Bạn nên làm lại sau ${retest.recommendedAfterDays} ngày (từ ${formatDate(retest.nextEligibleAt)}) để thấy rõ tiến bộ. Bạn vẫn muốn làm lại bây giờ?`,
          confirmLabel: "Vẫn làm lại",
          cancelLabel: "Để sau",
        });
        if (!ok) return;
      }
      setStep(1);
      setMode("wizard");
    };

    if (effectiveMode === "wizard" && canWrite) {
      const current = step || (draft ? resumeStep(draft) : 1);
      const flags = draft?.systemFlags;
      const hold = flags?.testPermission === "hold_test";
      const profileSource = draft?.profile?.age ? draft : latestCompleted || draft;
      const screeningSource = draft || { consent: latestCompleted?.consent };

      content = (
        <div className="space-y-5">
          <Stepper current={current} />
          {latestCompleted && (
            <button
              type="button"
              onClick={() => setMode("result")}
              className="text-sm font-semibold text-orange-300 underline-offset-2 hover:underline"
            >
              Xem kết quả gần nhất
            </button>
          )}
          {current === 1 && (
            <ScreeningStep
              key="step1"
              draft={screeningSource}
              pending={pending}
              onSubmit={(payload) => saveThen(payload, () => goNext(1))}
            />
          )}
          {current === 2 && (
            <ProfileStep
              key="step2"
              source={profileSource}
              pending={pending}
              onBack={() => setStep(1)}
              onSubmit={(payload) => saveThen(payload, () => goNext(2))}
            />
          )}
          {current === 3 && hold && (
            <Notice
              icon={Lock}
              title="Chưa nên làm bài kiểm tra thể lực"
              action={
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="min-h-11 rounded-xl border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800" onClick={() => setStep(1)}>
                    Xem lại phần sàng lọc
                  </button>
                  <button type="button" className={primaryButton} onClick={finish} disabled={pending}>
                    {submitMutation.isPending ? "Đang xử lý..." : "Xem lời khuyên an toàn"}
                  </button>
                </div>
              }
            >
              Dựa trên phần sàng lọc, bạn nên tham khảo ý kiến bác sĩ hoặc chuyên gia trước khi tự kiểm tra thể lực. Bạn vẫn nhận được lời khuyên an toàn.
            </Notice>
          )}
          {current === 3 && !hold && (
            <TestsStep
              key="step3"
              draft={draft}
              modified={flags?.testPermission === "modified_test"}
              pending={pending}
              onBack={() => setStep(2)}
              onSubmit={(payload) => saveThen(payload, finish)}
            />
          )}
        </div>
      );
    } else if (effectiveMode === "result" && (viewed || latestCompleted)) {
      const shown = viewed || latestCompleted;
      content = (
        <div className="space-y-4">
          {!canWrite && (
            <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              <p>Gói HT Fitness+ của bạn không còn hiệu lực nên bạn chỉ xem lại được kết quả.</p>
              <Link to={FITNESS_PLUS_PLANS_PATH} className="font-semibold underline underline-offset-2">
                Gia hạn gói
              </Link>
            </div>
          )}
          {viewed && (
            <button type="button" onClick={() => setViewed(null)} className="text-sm font-semibold text-orange-300 underline-offset-2 hover:underline">
              Quay lại kết quả mới nhất
            </button>
          )}
          <ResultView assessment={shown} retest={retest} canWrite={canWrite && !viewed} onRedo={startOver} />
          <AssessmentHistory excludeId={shown.id} onSelect={(item) => setViewed(item)} />
        </div>
      );
    } else if (effectiveMode === "intro" && canWrite) {
      content = (
        <Notice
          icon={ClipboardCheck}
          title="Tự đánh giá thể lực của bạn"
          action={
            <button type="button" className={primaryButton} onClick={() => { setStep(1); setMode("wizard"); }}>
              Bắt đầu đánh giá
            </button>
          }
        >
          Chỉ mất khoảng 10-15 phút: sàng lọc sức khỏe, nhập số đo và tự kiểm tra thể lực bằng các bài đơn giản. Bạn nhận lại mức thể lực cùng gợi ý giai đoạn, lịch tập, dinh dưỡng và bài tập phù hợp với mình.
        </Notice>
      );
    } else {
      content = (
        <Notice
          icon={Lock}
          title="Đánh giá bản thân dành cho thành viên HT Fitness+"
          action={
            <Link to={FITNESS_PLUS_PLANS_PATH} className={primaryButton}>
              Xem gói HT Fitness+
            </Link>
          }
        >
          Gói HT Fitness+ còn hiệu lực sẽ mở tính năng tự đánh giá và gợi ý tập luyện. Các kết quả cũ (nếu có) vẫn xem lại được.
        </Notice>
      );
    }
  }

  return (
    <div className="space-y-6">
      <SEO title="Đánh giá bản thân" description="Tự đánh giá thể lực và nhận gợi ý tập luyện." noindex={true} />
      <header className="border-b border-slate-800 pb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">HT Fitness+</p>
        <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">Đánh giá bản thân</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Tự khảo sát, tự kiểm tra thể lực an toàn và nhận gợi ý tập luyện phù hợp với bạn.
        </p>
      </header>
      {content}
      {dialog}
    </div>
  );
};

export default SelfAssessmentPage;

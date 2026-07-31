import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  getMonthWeekPeriod,
  getMonthWeekPeriods,
  getPreviousMonthWeekPeriod,
  getVietnamDateKey,
} from "../../utils/vietnamDate";
import {
  correctWeeklyCheckin,
  getWeeklyCheckin,
  saveWeeklyCheckin,
  submitWeeklyCheckin,
} from "../../services/weeklyCheckin.service";
import { WeeklyCheckinFields } from "./WeeklyCheckinFields";
import { CoachingCommentThread } from "../today-dashboard/CoachingCommentThread";
import {
  checkinToWeeklyValues,
  weeklyFormDefaults,
  weeklyFormSchema,
  weeklyValuesToPatch,
} from "./weeklyCheckinForm";

const requestId = () => window.crypto.randomUUID();
const statusLabel = {
  draft: "Bản nháp",
  submitted: "Đã gửi HLV",
  reviewed: "HLV đã xem xét",
};

const formatDayMonth = (dateKey) => {
  const [, month, day] = dateKey.split("-");
  return `${Number(day)}/${Number(month)}`;
};

const periodLabel = (period) =>
  `Tuần ${period.index}: ${formatDayMonth(period.startDateKey)} - ${formatDayMonth(period.endDateKey)}`;

const periodStartFor = (dateKey) =>
  getMonthWeekPeriod(dateKey)?.startDateKey || "";

const WeeklyCheckinCardForMonth = ({ dateKey, userId }) => {
  const queryClient = useQueryClient();
  const periods = getMonthWeekPeriods(dateKey);
  const [weekStartDateKey, setWeekStartDateKey] = useState(() =>
    periodStartFor(dateKey),
  );
  const [correctionReason, setCorrectionReason] = useState("");
  const [failedCommand, setFailedCommand] = useState(null);
  const [message, setMessage] = useState("");
  const queryKey = ["weekly-checkin", userId, weekStartDateKey];
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (await getWeeklyCheckin(weekStartDateKey)).data.data,
    enabled: Boolean(userId && weekStartDateKey),
    staleTime: 30_000,
  });
  const {
    register,
    reset,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(weeklyFormSchema),
    defaultValues: weeklyFormDefaults,
  });


  useEffect(() => {
    if (!query.isLoading) reset(checkinToWeeklyValues(query.data));
  }, [query.data, query.isLoading, reset]);

  const adherence = useWatch({ control, name: "adherence" });

  const mutation = useMutation({
    mutationFn: ({ kind, payload }) => {
      if (kind === "submit") {
        return submitWeeklyCheckin(weekStartDateKey, payload);
      }
      if (kind === "correction") {
        return correctWeeklyCheckin(weekStartDateKey, payload);
      }
      return saveWeeklyCheckin(weekStartDateKey, payload);
    },
  });

  const execute = async (command) => {
    setMessage("");
    try {
      const response = await mutation.mutateAsync(command);
      const next = response.data.data;
      queryClient.setQueryData(queryKey, next);
      reset(checkinToWeeklyValues(next));
      setFailedCommand(null);
      void queryClient.invalidateQueries({ queryKey: ["progress"] });
      return next;
    } catch (error) {
      setFailedCommand(command);
      setMessage(
        error.response?.data?.message ||
          "Không thể lưu báo cáo tuần lúc này.",
      );
      return null;
    }
  };

  const saveDraft = handleSubmit(async (values) => {
    const next = await execute({
      kind: "save",
      payload: {
        expectedRevision: query.data?.revision || 0,
        requestId: requestId(),
        patch: weeklyValuesToPatch(values),
      },
    });
    if (next) setMessage("Đã lưu bản nháp.");
  });

  const submit = handleSubmit(async (values) => {
    const saved = await execute({
      kind: "save",
      payload: {
        expectedRevision: query.data?.revision || 0,
        requestId: requestId(),
        patch: weeklyValuesToPatch(values),
      },
    });
    if (!saved || saved.revision < 1) return;
    const submittedCheckin = await execute({
      kind: "submit",
      payload: {
        expectedRevision: saved.revision,
        requestId: requestId(),
      },
    });
    if (submittedCheckin) {
      setMessage("Báo cáo tuần đã được gửi cho HLV.");
    }
  });

  const correct = handleSubmit(async (values) => {
    if (correctionReason.trim().length < 3) {
      setMessage("Vui lòng nhập lý do chỉnh sửa từ 3 ký tự.");
      return;
    }
    const corrected = await execute({
      kind: "correction",
      payload: {
        expectedRevision: query.data.revision,
        requestId: requestId(),
        reason: correctionReason.trim(),
        patch: weeklyValuesToPatch(values),
      },
    });
    if (corrected) {
      setCorrectionReason("");
      setMessage("Đã lưu chỉnh sửa và gửi lại cho HLV.");
    }
  });

  const selectPeriod = (nextStartDateKey) => {
    if (nextStartDateKey === weekStartDateKey) return;
    if (isDirty) {
      setMessage(
        "Bạn đang có thay đổi chưa lưu. Hãy lưu bản nháp trước khi chuyển tuần.",
      );
      return;
    }
    setWeekStartDateKey(nextStartDateKey);
    setCorrectionReason("");
    setFailedCommand(null);
    setMessage("");
    reset(weeklyFormDefaults);
  };

  const selectedPeriod =
    periods.find((period) => period.startDateKey === weekStartDateKey) ||
    getMonthWeekPeriod(dateKey);
  const today = getVietnamDateKey();
  const currentPeriod = getMonthWeekPeriod(today);
  const previousPeriod = getPreviousMonthWeekPeriod(today);
  const canEdit = [currentPeriod?.startDateKey, previousPeriod?.startDateKey]
    .includes(weekStartDateKey);
  const disabled = query.isLoading || mutation.isPending || !canEdit;
  const submitted = ["submitted", "reviewed"].includes(query.data?.status);
  const monthLabel = dateKey
    ? `Tháng ${Number(dateKey.slice(5, 7))}/${dateKey.slice(0, 4)}`
    : "";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-400">
              Báo cáo tuần · {monthLabel}
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">
              {selectedPeriod ? periodLabel(selectedPeriod) : "Báo cáo tuần"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Mỗi tuần gửi một báo cáo. Cân nặng và vòng eo là tùy chọn.
            </p>
          </div>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">
            {statusLabel[query.data?.status] || "Chưa tạo"}
          </span>
        </div>

        <div
          className="mt-5 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label={`Các tuần trong ${monthLabel}`}
        >
          {periods.map((period) => {
            const active = period.startDateKey === weekStartDateKey;
            return (
              <button
                key={period.startDateKey}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectPeriod(period.startDateKey)}
                className={
                  active
                    ? "min-h-11 shrink-0 rounded-xl bg-orange-500 px-4 text-sm font-bold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                    : "min-h-11 shrink-0 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                }
              >
                Tuần {period.index}
                <span className="ml-2 font-normal opacity-80">
                  {formatDayMonth(period.startDateKey)}–
                  {formatDayMonth(period.endDateKey)}
                </span>
              </button>
            );
          })}
        </div>

        {!canEdit && (
          <p className="mt-4 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            Kỳ này đã khóa chỉnh sửa. Bạn vẫn có thể xem báo cáo đã lưu; chỉ kỳ
            hiện tại và kỳ liền trước được nhập hoặc cập nhật.
          </p>
        )}

        {query.isError ? (
          <div className="mt-5 rounded-xl border border-red-900/60 bg-red-950/20 p-4">
            <p className="text-sm text-red-200">Không thể tải báo cáo tuần.</p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-800 px-4 text-sm font-semibold text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <RefreshCw size={16} aria-hidden="true" /> Thử lại
            </button>
          </div>
        ) : query.isLoading ? (
          <p
            className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400"
            role="status"
            aria-live="polite"
          >
            Đang tải báo cáo tuần...
          </p>
        ) : (
          <form
            className="mt-6 space-y-5"
            onSubmit={(event) => event.preventDefault()}
          >
            <WeeklyCheckinFields
              register={register}
              errors={errors}
              disabled={disabled}
              adherence={adherence}
            />
            {submitted && canEdit && (
              <label
                htmlFor="weekly-correction-reason"
                className="block text-sm font-medium text-slate-300"
              >
                Lý do chỉnh sửa sau khi gửi
                <input
                  id="weekly-correction-reason"
                  value={correctionReason}
                  onChange={(event) => setCorrectionReason(event.target.value)}
                  maxLength={500}
                  disabled={disabled}
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
                />
              </label>
            )}
            {query.data?.trainerReview && (
              <aside className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <ShieldCheck size={17} aria-hidden="true" /> Nhận xét từ HLV
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {query.data.trainerReview.message}
                </p>
                {query.data.trainerReview.rating !== null && (
                  <p className="mt-2 text-xs text-slate-400">
                    Đánh giá: {query.data.trainerReview.rating}/10
                  </p>
                )}
              </aside>
            )}
            {message && (
              <p
                className={
                  failedCommand
                    ? "text-sm text-red-300"
                    : "text-sm text-emerald-300"
                }
                role={failedCommand ? "alert" : "status"}
              >
                {message}
              </p>
            )}
            {canEdit && (
              <div className="flex flex-wrap gap-3">
                {submitted ? (
                  <button
                    type="button"
                    onClick={correct}
                    disabled={disabled}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
                  >
                    <Send size={16} aria-hidden="true" /> Lưu chỉnh sửa
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={saveDraft}
                      disabled={disabled}
                      className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
                    >
                      Lưu bản nháp
                    </button>
                    <button
                      type="button"
                      onClick={submit}
                      disabled={disabled}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
                    >
                      <Send size={16} aria-hidden="true" /> Gửi cho HLV
                    </button>
                  </>
                )}
                {failedCommand && (
                  <button
                    type="button"
                    onClick={() => void execute(failedCommand)}
                    disabled={disabled}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-800 px-4 text-sm font-semibold text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-40"
                  >
                    <RefreshCw size={16} aria-hidden="true" /> Thử lại lệnh cũ
                  </button>
                )}
              </div>
            )}
          </form>
        )}
      </section>
      {query.data?._id && (
        <CoachingCommentThread
          targetType="weekly_checkin"
          targetId={query.data._id}
          title="Trao đổi về báo cáo tuần"
        />
      )}
    </div>
  );
};

export const WeeklyCheckinCard = ({ dateKey, userId }) => (
  <WeeklyCheckinCardForMonth
    key={dateKey}
    dateKey={dateKey}
    userId={userId}
  />
);
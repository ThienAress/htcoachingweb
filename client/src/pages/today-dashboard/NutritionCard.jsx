import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Salad, Send, Unlink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  saveDailyJournal,
  submitDailyJournalNutrition,
} from "../../services/dailyJournal.service";
import {
  getSavedMealPlan,
  listSavedMealPlans,
} from "../../services/savedMealPlan.service";
import {
  appendNutritionEntry,
  updateManualMealEntry,
  updatePlannedMealAdjustments,
  upsertPlannedMealEntry,
} from "./dailyNutrition";
import { PlannedMealExecution } from "./PlannedMealExecution";
import { QuickMealHistory } from "./QuickMealHistory";
import { QuickMealLogger } from "./QuickMealLogger";

const newRequestId = () => window.crypto.randomUUID();
const errorMessage = (error) =>
  error.response?.data?.message || "Không thể cập nhật dinh dưỡng lúc này.";
export const NutritionCard = ({
  dateKey,
  journal,
  canEdit,
  onChanged,
}) => {
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [notice, setNotice] = useState("");
  const [localError, setLocalError] = useState("");
  const [failedCommand, setFailedCommand] = useState(null);
  const assignment = journal?.nutrition?.assignment || null;
  const entries = journal?.nutrition?.entries || [];
  const nutritionSubmitted = Boolean(journal?.nutrition?.submittedAt);
  const plansQuery = useQuery({
    queryKey: ["saved-meal-plans", "active"],
    queryFn: async () => {
      const response = await listSavedMealPlans({
        status: "active",
        page: 1,
        limit: 20,
      });
      return response.data.data;
    },
    staleTime: 30_000,
  });
  const assignedPlanQuery = useQuery({
    queryKey: ["saved-meal-plan", assignment?.savedMealPlanId],
    queryFn: async () => {
      const response = await getSavedMealPlan(assignment.savedMealPlanId);
      return response.data.data;
    },
    enabled: Boolean(assignment?.savedMealPlanId),
    staleTime: 5 * 60_000,
  });

  const command = useMutation({
    mutationFn: ({ kind, payload }) =>
      kind === "nutrition-submit"
        ? submitDailyJournalNutrition(dateKey, payload)
        : saveDailyJournal(dateKey, payload),
    onSuccess: (response, variables) => {
      setFailedCommand(null);
      setLocalError("");
      setNotice(
        variables.kind === "nutrition-submit"
          ? "Đã gửi báo cáo dinh dưỡng cho HLV."
          : "Đã cập nhật dinh dưỡng trong ngày.",
      );
      setConfirmSubmit(false);
      onChanged?.(response.data.data);
      void queryClient.invalidateQueries({
        queryKey: ["daily-journal-timeline", dateKey],
      });
    },
    onError: (_error, variables) => {
      setNotice("");
      setFailedCommand(variables);
    },
  });

  const mutationDisabled =
    !canEdit || nutritionSubmitted || command.isPending;
  const persistNutrition = (nutrition) => {
    setNotice("");
    setLocalError("");
    const payload = {
      expectedRevision: journal?.revision || 0,
      requestId: newRequestId(),
      patch: { nutrition },
    };
    command.mutate({ kind: "update", payload });
  };
  const assignPlan = () => {
    if (!selectedPlanId) return;
    persistNutrition({ assignment: { savedMealPlanId: selectedPlanId } });
  };
  const setPlannedStatus = (mealKey, status) => {
    try {
      persistNutrition({
        entries: upsertPlannedMealEntry(entries, {
          mealKey,
          status,
          entryId: newRequestId(),
        }),
      });
    } catch (error) {
      setLocalError(error.message);
    }
  };
  const addQuickEntry = (entry) => {
    try {
      persistNutrition({ entries: appendNutritionEntry(entries, entry) });
    } catch (error) {
      setLocalError(error.message);
    }
  };
  const adjustPlannedMeal = (mealKey, adjustments) => {
    try {
      persistNutrition({
        entries: updatePlannedMealAdjustments(entries, {
          mealKey,
          adjustments,
          entryId: newRequestId(),
        }),
      });
    } catch (error) {
      setLocalError(error.message);
    }
  };
  const submitNutrition = () => {
    command.mutate({
      kind: "nutrition-submit",
      payload: {
        expectedRevision: journal?.revision || 0,
        requestId: newRequestId(),
      },
    });
  };
  const updateQuickEntry = (values) => {
    try {
      persistNutrition({
        entries: updateManualMealEntry(entries, values),
      });
    } catch (error) {
      setLocalError(error.message);
    }
  };

  const plans = plansQuery.data?.items || [];
  const apiError = command.error ? errorMessage(command.error) : "";
  const staleConflict = command.error?.response?.status === 409;
  return (
    <section
      className="mb-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6"
      aria-labelledby="daily-nutrition-title"
      aria-busy={command.isPending}
    >
      <div className="flex items-start gap-3">
        <Salad className="mt-0.5 text-orange-400" size={22} aria-hidden="true" />
        <div>
          <h2 id="daily-nutrition-title" className="text-lg font-bold text-white">
            Dinh dưỡng trong ngày
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Chọn một thực đơn đã lưu hoặc ghi lại bữa ăn phát sinh trong ngày.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="font-semibold text-white">Thực đơn áp dụng</h3>
        {assignment ? (
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-orange-200">
                {assignment.titleSnapshot}
              </p>
            </div>
            <button
              type="button"
              onClick={() => persistNutrition({ assignment: null })}
              disabled={mutationDisabled}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40"
            >
              <Unlink size={16} aria-hidden="true" /> Gỡ khỏi ngày
            </button>
          </div>
        ) : plansQuery.isLoading ? (
          <p className="mt-2 text-sm text-slate-400">Đang tải thực đơn đã lưu...</p>
        ) : plansQuery.isError ? (
          <button
            type="button"
            onClick={() => plansQuery.refetch()}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            <RefreshCw size={15} /> Tải lại danh sách
          </button>
        ) : plans.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            Chưa có thực đơn đã lưu. {" "}
            <Link to="/mealplan/" className="font-semibold text-orange-300 underline">
              Tạo và lưu thực đơn
            </Link>
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="saved-plan-assignment" className="sr-only">
              Chọn thực đơn đã lưu
            </label>
            <select
              id="saved-plan-assignment"
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(event.target.value)}
              disabled={mutationDisabled}
              className="min-h-11 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
            >
              <option value="">Chọn thực đơn</option>
              {plans.map((plan) => (
                <option key={plan._id} value={plan._id}>
                  {plan.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={assignPlan}
              disabled={mutationDisabled || !selectedPlanId}
              className="min-h-11 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
            >
              Gắn vào ngày
            </button>
          </div>
        )}
      </div>
      {assignment && assignedPlanQuery.isLoading && (
        <p className="mt-4 text-sm text-slate-400">Đang tải thực đơn đã áp dụng...</p>
      )}
      {assignment && assignedPlanQuery.isError && (
        <button
          type="button"
          onClick={() => assignedPlanQuery.refetch()}
          className="mt-4 min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          Không thể tải thực đơn. Thử lại
        </button>
      )}
      <PlannedMealExecution
        plan={assignedPlanQuery.data}
        entries={entries}
        disabled={mutationDisabled}
        onStatus={setPlannedStatus}
        onAdjust={adjustPlannedMeal}
      />
      <QuickMealHistory
        entries={entries}
        disabled={mutationDisabled}
        onUpdate={updateQuickEntry}
      />
      <QuickMealLogger
        entryCount={entries.length}
        disabled={mutationDisabled}
        onAdd={addQuickEntry}
      />

      <div className="mt-5 border-t border-slate-800 pt-5">
        {nutritionSubmitted ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-sm font-bold text-emerald-200">
              Báo cáo dinh dưỡng đã được gửi cho HLV
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Dữ liệu dinh dưỡng của ngày này đã khóa và không thể chỉnh sửa thêm.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmSubmit(true)}
            disabled={
              mutationDisabled || !entries.some((entry) => entry.status === "eaten")
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} aria-hidden="true" /> Gửi báo cáo dinh dưỡng cho HLV
          </button>
        )}
        {!nutritionSubmitted && !entries.some((entry) => entry.status === "eaten") && (
          <p className="mt-2 text-xs text-slate-500">
            Hãy xác nhận ít nhất một bữa đã ăn trước khi gửi.
          </p>
        )}
      </div>

      {confirmSubmit && !nutritionSubmitted && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="nutrition-submit-confirm-title"
          className="mt-4 rounded-xl border border-orange-400/30 bg-slate-900 p-4 shadow-xl"
        >
          <h3 id="nutrition-submit-confirm-title" className="font-bold text-white">
            Xác nhận gửi báo cáo dinh dưỡng
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Báo cáo chỉ được gửi một lần. Sau khi gửi, bạn sẽ không thể điều chỉnh
            bữa ăn hoặc khối lượng thực phẩm của ngày này.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmSubmit(false)}
              disabled={command.isPending}
              className="min-h-11 rounded-lg px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-40"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={submitNutrition}
              disabled={command.isPending}
              className="min-h-11 rounded-lg bg-orange-500 px-4 text-sm font-black text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
            >
              {command.isPending ? "Đang gửi..." : "Gửi cho HLV"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4" aria-live="polite">
        {notice && <p className="text-sm text-green-300">{notice}</p>}
        {(localError || apiError) && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-200">
            <p>{localError || apiError}</p>
            {failedCommand && (
              <button
                type="button"
                onClick={() =>
                  staleConflict
                    ? onChanged?.()
                    : command.mutate(failedCommand)
                }
                disabled={command.isPending}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 font-semibold hover:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40"
              >
                <RefreshCw size={15} />
                {staleConflict ? "Tải dữ liệu mới" : "Thử lại"}
              </button>
            )}
          </div>
        )}
      </div>
      {!canEdit && (
        <p className="mt-4 text-sm text-slate-500">
          Ngày này chỉ có thể xem hoặc gói huấn luyện hiện không hoạt động.
        </p>
      )}
    </section>
  );
};

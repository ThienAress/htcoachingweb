import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookmarkCheck,
  BookmarkMinus,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  archiveSavedMealPlan,
  listSavedMealPlans,
  renameSavedMealPlan,
  reviseSavedMealPlan,
} from "../../services/savedMealPlan.service";
import {
  buildSavedMealPlanPayload,
  getSavedMealPlanErrorKey,
} from "../../utils/savedMealPlan";
import SavedMealPlanEditor from "./SavedMealPlanEditor";
import SavedMealPlanTitleEditor from "./SavedMealPlanTitleEditor";

const requestId = () => window.crypto.randomUUID();
const queryKey = ["saved-meal-plans", "active"];

const SavedMealPlans = ({ meals, onGenerateAnother, target, targetLabel }) => {
  const { t, i18n } = useTranslation("mealplan");
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [localError, setLocalError] = useState("");
  const [failedCommand, setFailedCommand] = useState(null);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [editingUsesGenerated, setEditingUsesGenerated] = useState(false);
  const [renamingPlanId, setRenamingPlanId] = useState(null);
  const plansQuery = useQuery({
    queryKey,
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

  const command = useMutation({
    mutationFn: ({ kind, planId, payload }) => {
      if (kind === "revise") return reviseSavedMealPlan(planId, payload);
      if (kind === "rename") return renameSavedMealPlan(planId, payload);
      return archiveSavedMealPlan(planId, payload);
    },
    onSuccess: (_response, variables) => {
      setFailedCommand(null);
      setLocalError("");
      setNotice(t(`saved.${variables.kind}_success`));
      if (variables.kind === "revise") setEditingPlanId(null);
      if (variables.kind === "rename") setRenamingPlanId(null);
      if (variables.kind === "archive" && variables.planId === editingPlanId) {
        setEditingPlanId(null);
      }
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (_error, variables) => {
      setNotice("");
      setFailedCommand(variables);
    },
  });

  const generatedPayload = (title) =>
    buildSavedMealPlanPayload({
      requestId: requestId(),
      title,
      target: target
        ? {
            label: targetLabel || "",
            protein: target.protein,
            carb: target.carb,
            fat: target.fat,
            calories: target.calories,
          }
        : null,
      meals,
    });

  const runRevise = (plan) => {
    setNotice("");
    setLocalError("");
    try {
      command.mutate({
        kind: "revise",
        planId: plan._id,
        payload: {
          ...generatedPayload(plan.title),
          expectedVersion: plan.version,
        },
      });
    } catch {
      setLocalError(t("saved.invalid_generated"));
    }
  };

  const runRename = (plan, title) => {
    setNotice("");
    setLocalError("");
    command.mutate({
      kind: "rename",
      planId: plan._id,
      payload: {
        requestId: requestId(),
        expectedVersion: plan.version,
        title,
      },
    });
  };

  const runArchive = (plan) => {
    setNotice("");
    setLocalError("");
    command.mutate({
      kind: "archive",
      planId: plan._id,
      payload: {
        requestId: requestId(),
        expectedVersion: plan.version,
      },
    });
  };

  const plans = plansQuery.data?.items || [];
  const editingPlan = plans.find((plan) => plan._id === editingPlanId);
  const isPending = command.isPending;
  const commandError =
    localError ||
    (command.error ? t(getSavedMealPlanErrorKey(command.error)) : "");

  return (
    <section
      className="mt-6 rounded-2xl border border-gray-700 bg-gray-800/50 p-4 sm:p-5"
      aria-labelledby="saved-meal-plans-title"
      aria-busy={isPending}
    >
      <h2
        id="saved-meal-plans-title"
        className="flex items-center gap-2 text-lg font-bold text-white"
      >
        <BookmarkCheck className="h-5 w-5 text-primary" />
        {t("saved.title")}
      </h2>
      <p className="mt-1 text-sm text-gray-400">{t("saved.description")}</p>

      <div className="mt-4" aria-live="polite">
        {notice && <p className="text-sm text-green-300">{notice}</p>}
        {commandError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <p>{commandError}</p>
            {failedCommand && (
              <button
                type="button"
                onClick={() => command.mutate(failedCommand)}
                disabled={isPending}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 font-semibold hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                <RefreshCw className="h-4 w-4" /> {t("saved.retry")}
              </button>
            )}
          </div>
        )}
      </div>

      {editingPlan && (
        <SavedMealPlanEditor
          currentMeals={meals}
          isPending={isPending}
          plan={editingPlan}
          useGeneratedMeals={editingUsesGenerated}
          onClose={() => setEditingPlanId(null)}
          onGenerateAnother={async () => {
            const generated = await onGenerateAnother?.();
            if (generated) setEditingUsesGenerated(true);
          }}
          onSave={() => runRevise(editingPlan)}
        />
      )}

      {plansQuery.isLoading ? (
        <p className="mt-4 text-sm text-gray-400">{t("saved.loading")}</p>
      ) : plansQuery.isError ? (
        <div className="mt-4 text-sm text-red-300">
          <p>{t("saved.load_error")}</p>
          <button
            type="button"
            onClick={() => plansQuery.refetch()}
            className="mt-2 min-h-11 rounded-md px-3 py-2 font-semibold hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            {t("saved.retry")}
          </button>
        </div>
      ) : plans.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">{t("saved.empty")}</p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {plans.map((plan) => (
            <li
              key={plan._id}
              className="rounded-xl border border-gray-700 bg-gray-900/50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {renamingPlanId === plan._id ? (
                    <SavedMealPlanTitleEditor
                      initialValue={plan.title}
                      isPending={isPending}
                      onCancel={() => setRenamingPlanId(null)}
                      onSave={(title) => runRename(plan, title)}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-white">
                        {plan.title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setRenamingPlanId(plan._id)}
                        disabled={isPending}
                        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-700 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
                        aria-label={`Đổi tên ${plan.title}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {new Intl.DateTimeFormat(i18n.language).format(
                      new Date(plan.updatedAt),
                    )}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-semibold text-primary">
                  {Math.round(plan.totals.calories)} kcal
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlanId(plan._id);
                    setEditingUsesGenerated(false);
                  }}
                  disabled={isPending}
                  className="min-h-11 rounded-lg border border-primary/50 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("saved.edit")}
                </button>
                <button
                  type="button"
                  onClick={() => runArchive(plan)}
                  disabled={isPending}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
                >
                  <BookmarkMinus className="h-4 w-4" /> {t("saved.archive")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default SavedMealPlans;

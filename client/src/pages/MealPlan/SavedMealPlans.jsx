import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, BookmarkCheck, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  archiveSavedMealPlan,
  createSavedMealPlan,
  listSavedMealPlans,
  reviseSavedMealPlan,
} from "../../services/savedMealPlan.service";
import { buildSavedMealPlanPayload } from "../../utils/savedMealPlan";

const requestId = () => window.crypto.randomUUID();
const queryKey = ["saved-meal-plans", "active"];

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;

const SavedMealPlans = ({ meals, target, targetLabel }) => {
  const { t, i18n } = useTranslation("mealplan");
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [localError, setLocalError] = useState("");
  const [failedCommand, setFailedCommand] = useState(null);
  const plansQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await listSavedMealPlans({
        status: "active",
        page: 1,
        limit: 5,
      });
      return response.data.data;
    },
    staleTime: 30_000,
  });

  const command = useMutation({
    mutationFn: ({ kind, planId, payload }) => {
      if (kind === "revise") {
        return reviseSavedMealPlan(planId, payload);
      }
      if (kind === "archive") {
        return archiveSavedMealPlan(planId, payload);
      }
      return createSavedMealPlan(payload);
    },
    onSuccess: (_response, variables) => {
      setFailedCommand(null);
      setLocalError("");
      setNotice(t(`saved.${variables.kind}_success`));
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (_error, variables) => {
      setNotice("");
      setFailedCommand(variables);
    },
  });

  const generatedPayload = () =>
    buildSavedMealPlanPayload({
      requestId: requestId(),
      title: t("saved.generated_title", {
        target: targetLabel || t("saved.target_default"),
      }),
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

  const runCreate = () => {
    setNotice("");
    setLocalError("");
    try {
      command.mutate({ kind: "create", payload: generatedPayload() });
    } catch {
      setLocalError(t("saved.invalid_generated"));
    }
  };

  const runRevise = (plan) => {
    setNotice("");
    setLocalError("");
    try {
      command.mutate({
        kind: "revise",
        planId: plan._id,
        payload: {
          ...generatedPayload(),
          expectedVersion: plan.version,
        },
      });
    } catch {
      setLocalError(t("saved.invalid_generated"));
    }
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
  const hasGeneratedPlan = meals.length > 0;
  const isPending = command.isPending;
  const commandError =
    localError ||
    (command.error
      ? getErrorMessage(command.error, t("saved.command_error"))
      : "");

  return (
    <section
      className="mt-6 rounded-2xl border border-gray-700 bg-gray-800/50 p-4 sm:p-5"
      aria-labelledby="saved-meal-plans-title"
      aria-busy={isPending}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="saved-meal-plans-title"
            className="flex items-center gap-2 text-lg font-bold text-white"
          >
            <BookmarkCheck className="h-5 w-5 text-primary" />
            {t("saved.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {t("saved.description")}
          </p>
        </div>
        <button
          type="button"
          onClick={runCreate}
          disabled={!hasGeneratedPlan || isPending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          <Save className="h-4 w-4" />
          {isPending ? t("saved.saving") : t("saved.save_current")}
        </button>
      </div>

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
                <div>
                  <h3 className="font-semibold text-white">{plan.title}</h3>
                  <p className="mt-1 text-xs text-gray-400">
                    {t("saved.version", { version: plan.version })} ·{" "}
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
                  onClick={() => runRevise(plan)}
                  disabled={!hasGeneratedPlan || isPending}
                  className="min-h-11 rounded-lg border border-primary/50 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("saved.update_with_current")}
                </button>
                <button
                  type="button"
                  onClick={() => runArchive(plan)}
                  disabled={isPending}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-300 transition hover:bg-gray-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
                >
                  <Archive className="h-4 w-4" /> {t("saved.archive")}
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

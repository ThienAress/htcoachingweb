import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { createSavedMealPlan } from "../../services/savedMealPlan.service";
import {
  buildSavedMealPlanPayload,
  getSavedMealPlanErrorKey,
} from "../../utils/savedMealPlan";
import { getVietnamDateKey } from "../../utils/vietnamDate";
import MealPlanSaveConfirmDialog from "./MealPlanSaveConfirmDialog";

const requestId = () => window.crypto.randomUUID();
const queryKey = ["saved-meal-plans", "active"];

export default function SaveCurrentMealPlanButton({
  alreadySaved,
  generationId,
  meals,
  onSaved,
  target,
  targetLabel,
}) {
  const { t } = useTranslation("mealplan");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [failedPayload, setFailedPayload] = useState(null);
  const [localError, setLocalError] = useState("");
  const command = useMutation({
    mutationFn: createSavedMealPlan,
    onSuccess: () => {
      setFailedPayload(null);
      setLocalError("");
      onSaved(generationId);
      setDialogOpen(true);
      toast.success("Đã lưu thực đơn vào tài khoản");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error, payload) => {
      setFailedPayload(payload);
      toast.error(
        error.response?.data?.message || "Không thể lưu thực đơn lúc này",
      );
    },
  });

  const runSave = () => {
    setLocalError("");
    try {
      const payload = buildSavedMealPlanPayload({
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
      command.mutate(payload);
    } catch {
      setLocalError(t("saved.invalid_generated"));
      toast.error(t("saved.invalid_generated"));
    }
  };

  const disabled = meals.length === 0 || command.isPending || alreadySaved;
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={runSave}
        disabled={disabled}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-black transition-[filter,opacity] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {alreadySaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {command.isPending
          ? t("saved.saving")
          : alreadySaved
            ? "Đã lưu thực đơn này"
            : t("saved.save_current")}
      </button>
      {(localError || command.isError) && (
        <div className="text-right text-sm text-red-300" role="alert">
          <p>
            {localError || t(getSavedMealPlanErrorKey(command.error))}
          </p>
          {!localError && failedPayload && (
            <button
              type="button"
              onClick={() => command.mutate(failedPayload)}
              disabled={command.isPending}
              className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <RefreshCw size={15} aria-hidden="true" /> Thử lại
            </button>
          )}
        </div>
      )}
      <MealPlanSaveConfirmDialog
        isOpen={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => {
          setDialogOpen(false);
          navigate(`/dashboard/today/${getVietnamDateKey()}/nutrition`);
        }}
      />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  Utensils,
} from "lucide-react";

import { replaceAiMealItem } from "../../../services/ai.service";
import {
  getReconciledMealData,
  resolveMealReplacementAttempt,
} from "../mealReplacementRuntime";

import AssistantCard, {
  CardFooter,
  CardList,
  CardNotice,
  CardSection,
  IndexBadge,
} from "./AssistantCard";

const formatNumber = (value) =>
  Number.isFinite(Number(value))
    ? Number(value).toLocaleString("vi-VN")
    : "—";

const getMealTotals = (meal) => {
  if (meal?.totals) return meal.totals;
  return (meal?.foods || []).reduce(
    (totals, food) => ({
      calories: totals.calories + (Number(food.calories) || 0),
      protein: totals.protein + (Number(food.macros?.protein) || 0),
    }),
    { calories: 0, protein: 0 },
  );
};

export default function MealSuggestionCard({
  conversationId,
  data,
  disabled = false,
}) {
  const [mealData, setMealData] = useState(data);
  const [selection, setSelection] = useState({ mealIndex: 0, foodIndex: 0 });
  const [replacementState, setReplacementState] = useState("idle");
  const [replacementMessage, setReplacementMessage] = useState("");
  const pendingReplacementRef = useRef(null);

  useEffect(() => {
    setMealData(data);
    setReplacementState("idle");
    setReplacementMessage("");
    pendingReplacementRef.current = null;
  }, [data]);

  const canReplace = Boolean(
    conversationId &&
    mealData?.mealPlanId &&
    Number.isSafeInteger(mealData?.mealRevision) &&
    mealData?.meals?.[selection.mealIndex]?.foods?.[selection.foodIndex]?.foodId,
  );
  const selectedFood = canReplace
    ? mealData.meals[selection.mealIndex].foods[selection.foodIndex]
    : null;
  const isReplacing = replacementState === "loading";

  const handleReplacement = async () => {
    if (!canReplace || disabled || isReplacing) return;
    setReplacementState("loading");
    setReplacementMessage("");
    const intent = {
      mealPlanId: mealData.mealPlanId,
      expectedRevision: mealData.mealRevision,
      mealIndex: selection.mealIndex,
      foodIndex: selection.foodIndex,
    };
    const attempt = resolveMealReplacementAttempt({
      intent,
      pendingAttempt: pendingReplacementRef.current,
    });
    pendingReplacementRef.current = attempt;
    try {
      const response = await replaceAiMealItem(conversationId, attempt);
      const nextData = response?.data?.card?.data;
      if (!nextData?.meals?.length) throw new Error("Invalid replacement response");
      setMealData(nextData);
      pendingReplacementRef.current = null;
      setReplacementState("success");
      setReplacementMessage(
        `Đã đổi ${nextData.replacement?.before?.name || "món đã chọn"} thành ${
          nextData.replacement?.after?.name || "món tương đương"
        }.`,
      );
    } catch (error) {
      const reconciledData = getReconciledMealData(error, intent);
      if (reconciledData) {
        setMealData(reconciledData);
        pendingReplacementRef.current = null;
        setReplacementState("success");
        setReplacementMessage(
          "Thực đơn đã được đồng bộ với kết quả mới nhất. Bạn chọn lại món nếu muốn đổi tiếp nhé.",
        );
        return;
      }
      const uncertainOutcome =
        error.code !== "ERR_CANCELED" &&
        (!error.response || Number(error.response?.status) >= 500);
      if (!uncertainOutcome) pendingReplacementRef.current = null;
      setReplacementState("error");
      setReplacementMessage(
        uncertainOutcome
          ? "Chưa xác nhận được kết quả đổi món. Nhấn lại để hệ thống kiểm tra an toàn."
          : error.response?.data?.message ||
              "Chưa thể đổi món tương đương lúc này. Bạn thử lại nhé.",
      );
    }
  };

  if (!mealData?.meals?.length) return null;

  const {
    targetCalories,
    calorieScope,
    targetToleranceCalories = 100,
    macros,
    meals,
    totals,
    safety,
  } = mealData;
  const calorieTotal = totals?.calories ?? targetCalories;
  const macroSummary = totals || macros;
  const replacementNote = isReplacing
    ? "Đang đối chiếu món tương đương an toàn"
    : selectedFood
      ? `Đang chọn: ${selectedFood.name}`
      : `Sai số mục tiêu ±${formatNumber(targetToleranceCalories)} kcal`;

  return (
    <AssistantCard
      eyebrow="THỰC ĐƠN GỢI Ý"
      icon={Utensils}
      iconTone="amber"
      subtitle="Khẩu phần được tính từ dữ liệu thực phẩm trong hệ thống"
      title={calorieScope === "per_meal" ? "Một bữa" : `Một ngày · ${meals.length} bữa`}
      value={`${formatNumber(calorieTotal)} kcal`}
      valueNote={
        macroSummary
          ? `P ${formatNumber(macroSummary.protein)}g · C ${formatNumber(macroSummary.carb)}g · F ${formatNumber(macroSummary.fat)}g`
          : ""
      }
      footer={
        canReplace ? (
          <CardFooter
            action={isReplacing ? "Đang đổi món..." : "Đổi món tương đương"}
            disabled={disabled || isReplacing}
            icon={RefreshCw}
            note={replacementNote}
            onClick={handleReplacement}
          />
        ) : (
          <CardFooter
            action="Mở công cụ thực đơn"
            icon={ArrowUpRight}
            note={`Sai số mục tiêu ±${formatNumber(targetToleranceCalories)} kcal`}
            to="/mealplan/"
          />
        )
      }
    >
      {safety?.warning && (
        <CardSection>
          <CardNotice
            aria-label="Lưu ý dị ứng"
            icon={AlertTriangle}
            role="note"
            tone="amber"
          >
            {safety.warning}
          </CardNotice>
        </CardSection>
      )}

      {replacementMessage && (
        <CardSection>
          <CardNotice
            icon={replacementState === "success" ? CheckCircle2 : AlertTriangle}
            role={replacementState === "error" ? "alert" : "status"}
            tone={replacementState === "error" ? "amber" : "cyan"}
          >
            {replacementMessage}
          </CardNotice>
        </CardSection>
      )}

      <CardSection>
        <CardList>
          {meals.map((meal, index) => {
            const mealTotals = getMealTotals(meal);
            const foodSummary = (meal.foods || [])
              .map((food) =>
                `${food.name}${food.amountGrams ? ` ${formatNumber(food.amountGrams)}g` : ""}`,
              )
              .join(" · ");

            return (
              <li
                key={`${meal.label || "meal"}-${index}`}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <IndexBadge tone="amber">
                  {String(index + 1).padStart(2, "0")}
                </IndexBadge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5 text-slate-900 dark:text-zinc-100">
                    {meal.label || `Bữa ${index + 1}`}
                  </p>
                  {canReplace ? (
                    <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`Chọn món trong ${meal.label || `bữa ${index + 1}`}`} role="group">
                      {(meal.foods || []).map((food, foodIndex) => {
                        const selected =
                          selection.mealIndex === index &&
                          selection.foodIndex === foodIndex;
                        return (
                          <button
                            aria-pressed={selected}
                            className={`min-h-11 rounded-xl border px-2.5 py-2 text-left text-xs leading-4 transition-[border-color,color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none ${
                              selected
                                ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200"
                                : "border-slate-200 text-slate-600 hover:border-emerald-500 dark:border-white/10 dark:text-zinc-300 dark:hover:border-emerald-400"
                            }`}
                            disabled={disabled || isReplacing}
                            key={`${food.foodId || food.name}-${foodIndex}`}
                            onClick={() => setSelection({ mealIndex: index, foodIndex })}
                            type="button"
                          >
                            <span className="font-medium">{food.name}</span>
                            {food.amountGrams ? (
                              <span className="ml-1 text-slate-500 dark:text-zinc-400">
                                {formatNumber(food.amountGrams)}g
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-1 text-pretty text-xs leading-5 text-slate-500 dark:text-zinc-400">
                      {foodSummary}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-right text-[13px] font-medium text-cyan-700 dark:text-cyan-300">
                  {formatNumber(mealTotals.calories)} kcal
                  {Number.isFinite(Number(mealTotals.protein)) && (
                    <small className="mt-1 block text-xs font-normal text-slate-500 dark:text-zinc-400">
                      {formatNumber(mealTotals.protein)}g protein
                    </small>
                  )}
                </span>
              </li>
            );
          })}
        </CardList>
      </CardSection>
    </AssistantCard>
  );
}

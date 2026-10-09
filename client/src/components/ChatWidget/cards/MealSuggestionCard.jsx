import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  Utensils,
} from "lucide-react";

import { replaceAiMealItem } from "../../../services/ai.service";
import MealFoodList from "./MealFoodList";
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

            return (
              <li
                key={`${meal.label || "meal"}-${index}`}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <IndexBadge tone="amber">
                  {String(index + 1).padStart(2, "0")}
                </IndexBadge>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium leading-5 text-slate-900 dark:text-zinc-100">
                    {meal.label || `Bữa ${index + 1}`}
                  </h4>
                  <MealFoodList
                    meal={meal}
                    mealIndex={index}
                    selection={selection}
                    canReplace={canReplace}
                    disabled={disabled || isReplacing}
                    onSelect={setSelection}
                  />
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-cyan-700 dark:text-cyan-300">
                    <span>{formatNumber(mealTotals.calories)} kcal</span>
                    {Number.isFinite(Number(mealTotals.protein)) && (
                      <span>{formatNumber(mealTotals.protein)}g protein</span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </CardList>
      </CardSection>
    </AssistantCard>
  );
}

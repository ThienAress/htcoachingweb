import { Activity, Calculator, Flame } from "lucide-react";

import AssistantCard, {
  CardFooter,
  CardNotice,
  CardSection,
  CardSectionLabel,
} from "./AssistantCard";

const formatNumber = (value) =>
  Number.isFinite(Number(value))
    ? Number(value).toLocaleString("vi-VN")
    : "—";

const getMacroPlan = (macros) => {
  if (!macros || typeof macros !== "object") return null;
  return macros["Moderate-carb"] || Object.values(macros)[0] || null;
};

export default function TdeeResultCard({ data }) {
  if (!data) return null;

  const {
    bmr,
    tdee,
    tdeeRange,
    targetCalories,
    targetCaloriesRange,
    goal,
    activityLevel,
    activity,
    calibrationDays = 14,
    macros,
  } = data;
  const macroPlan = getMacroPlan(macros);
  const macroCalories = macroPlan
    ? {
        protein: macroPlan.protein * 4,
        carb: macroPlan.carb * 4,
        fat: macroPlan.fat * 9,
      }
    : null;
  const macroTotal = macroCalories
    ? Object.values(macroCalories).reduce((sum, value) => sum + value, 0)
    : 0;

  return (
    <AssistantCard
      eyebrow="KẾT QUẢ TDEE"
      icon={Flame}
      subtitle={[goal && `Mục tiêu ${goal.toLowerCase()}`, activityLevel]
        .filter(Boolean)
        .join(" · ")}
      title="Mức năng lượng khởi điểm"
      footer={
        <CardFooter
          action="Xem cách tính"
          icon={Calculator}
          note="Ước tính, không thay thế tư vấn y khoa"
          to="/tdee-calculator/"
        />
      }
    >
      <CardSection>
        <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-3">
          {[
            [bmr, "BMR · kcal/ngày", "text-slate-900 dark:text-zinc-50"],
            [tdee, "TDEE ước tính", "text-emerald-700 dark:text-emerald-300"],
            [
              targetCalories,
              "Mục tiêu đề xuất",
              "text-cyan-700 dark:text-cyan-300",
            ],
          ].map(([value, label, valueClass], index) => (
            <div
              key={label}
              className={`min-w-0 ${
                index > 0
                  ? "border-t border-slate-200 pt-3 dark:border-white/10 min-[430px]:border-l min-[430px]:border-t-0 min-[430px]:pl-3 min-[430px]:pt-0"
                  : ""
              }`}
            >
              <strong
                className={`block text-2xl font-medium tabular-nums leading-none ${valueClass}`}
              >
                {formatNumber(value)}
              </strong>
              <span className="mt-2 block text-xs text-slate-500 dark:text-zinc-400">
                {label}
              </span>
            </div>
          ))}
        </div>
      </CardSection>

      {tdeeRange && (
        <CardSection>
          <CardNotice icon={Activity}>
            <p>
              Khoảng TDEE hợp lý: <strong>{formatNumber(tdeeRange.min)}–{formatNumber(tdeeRange.max)} kcal/ngày</strong>.
            </p>
            {targetCaloriesRange && (
              <p>
                Khoảng theo mục tiêu: {formatNumber(targetCaloriesRange.min)}–{formatNumber(targetCaloriesRange.max)} kcal/ngày.
              </p>
            )}
            {activity?.range?.length === 2 && (
              <p>
                Hệ số đề xuất {formatNumber(activity.multiplier)} (khoảng hệ số {activity.range.map(formatNumber).join("–")}).
              </p>
            )}
            <p>
              Theo dõi cân nặng, sức tập và mức đói trong {calibrationDays} ngày trước khi điều chỉnh.
            </p>
          </CardNotice>
        </CardSection>
      )}

      {macroPlan && (
        <CardSection>
          <CardSectionLabel>
            Phân bổ macro cân bằng ở mức {formatNumber(targetCalories)} kcal
          </CardSectionLabel>
          <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-3">
            {[
              ["Protein", macroPlan.protein, macroCalories.protein, "bg-emerald-600 dark:bg-emerald-400"],
              ["Carb", macroPlan.carb, macroCalories.carb, "bg-cyan-600 dark:bg-cyan-400"],
              ["Fat", macroPlan.fat, macroCalories.fat, "bg-amber-500 dark:bg-amber-400"],
            ].map(([label, grams, calories, barClass]) => (
              <div key={label} className="min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400">
                  <span>{label}</span>
                  <strong className="font-medium text-slate-800 dark:text-zinc-100">
                    {formatNumber(grams)} g
                  </strong>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]">
                  <span
                    aria-hidden="true"
                    className={`block h-full rounded-full ${barClass}`}
                    style={{
                      width: `${
                        macroTotal > 0
                          ? Math.round((calories / macroTotal) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardSection>
      )}
    </AssistantCard>
  );
}

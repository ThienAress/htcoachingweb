import { Flame, TrendingDown, TrendingUp, Minus } from "lucide-react";

const goalIcons = { "Giảm mỡ": TrendingDown, "Duy trì": Minus, "Tăng cơ": TrendingUp };

export default function TdeeResultCard({ data }) {
  if (!data) return null;
  const { bmr, tdee, targetCalories, goal, activityLevel, macros } = data;
  const GoalIcon = goalIcons[goal] || Minus;

  return (
    <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3 w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Flame size={16} className="text-orange-400" />
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Kết quả TDEE</span>
      </div>

      {/* Main numbers */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-black/20 rounded-lg py-2 px-1">
          <p className="text-lg font-bold text-white">{bmr}</p>
          <p className="text-[10px] text-gray-400">BMR (kcal)</p>
        </div>
        <div className="bg-black/20 rounded-lg py-2 px-1">
          <p className="text-lg font-bold text-emerald-400">{tdee}</p>
          <p className="text-[10px] text-gray-400">TDEE (kcal)</p>
        </div>
        <div className="bg-black/20 rounded-lg py-2 px-1">
          <p className="text-lg font-bold text-cyan-400">{targetCalories}</p>
          <p className="text-[10px] text-gray-400">Mục tiêu</p>
        </div>
      </div>

      {/* Goal badge */}
      <div className="flex items-center gap-1.5">
        <GoalIcon size={12} className="text-emerald-400" />
        <span className="text-xs text-gray-300">
          {goal} • {activityLevel}
        </span>
      </div>

      {/* Macros table */}
      {macros && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Phân bổ Macro ({targetCalories} kcal)</p>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            {Object.entries(macros).map(([plan, values]) => (
              <div key={plan} className="bg-black/20 rounded-lg p-2">
                <p className="font-semibold text-gray-300 mb-1.5 truncate">{plan}</p>
                <div className="space-y-0.5 text-gray-400">
                  <p>P: <span className="text-blue-400">{values.protein}g</span></p>
                  <p>C: <span className="text-yellow-400">{values.carb}g</span></p>
                  <p>F: <span className="text-pink-400">{values.fat}g</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

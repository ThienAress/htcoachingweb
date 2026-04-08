import React from "react";
import { Drumstick, Droplet, Wheat } from "lucide-react";

const MacroTable = ({ macroSet, tdee, adjustedCalories, goal }) => {
  if (!macroSet) return null;

  const goalText =
    goal === "gain"
      ? "tăng cân"
      : goal === "lose"
        ? "giảm cân"
        : "duy trì cân nặng";

  return (
    <div className="mt-10">
      <div className="mb-8 p-5 bg-gradient-to-r from-primary/30 to-primary/10 border-l-4 border-primary rounded-r-xl backdrop-blur-sm">
        <p className="text-gray-200 leading-relaxed">
          🔥 Đây là lượng calories mình đã điều chỉnh từ TDEE ban đầu của bạn là{" "}
          <strong className="text-primary text-lg">{tdee}</strong> kcal thành
          lượng calories cần thiết để{" "}
          <strong className="text-yellow-300">{goalText}</strong> là{" "}
          <strong className="text-primary text-lg">{adjustedCalories}</strong>{" "}
          kcal. Theo dõi và thay đổi theo tuần cho phù hợp bạn nhé.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {Object.entries(macroSet).map(([goalName, values]) => (
          <div
            key={goalName}
            className="relative bg-gray-800/80 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-700 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 group"
          >
            <div className="bg-gradient-to-r from-primary to-primary-dark py-3 text-center">
              <h4 className="text-white font-black text-xl tracking-wider">
                {goalName}
              </h4>
            </div>

            <div className="p-6 space-y-5">
              {/* Protein */}
              <div className="flex items-center justify-between group-hover:translate-x-1 transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Drumstick className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-gray-300 font-medium">Protein</span>
                </div>
                <div className="text-right">
                  <strong className="text-3xl font-black text-white">
                    {values.protein}
                  </strong>
                  <span className="text-gray-400 ml-1">g</span>
                </div>
              </div>

              {/* Fat */}
              <div className="flex items-center justify-between group-hover:translate-x-1 transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Droplet className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-gray-300 font-medium">Fat</span>
                </div>
                <div className="text-right">
                  <strong className="text-3xl font-black text-white">
                    {values.fat}
                  </strong>
                  <span className="text-gray-400 ml-1">g</span>
                </div>
              </div>

              {/* Carbs */}
              <div className="flex items-center justify-between group-hover:translate-x-1 transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Wheat className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-gray-300 font-medium">Carbs</span>
                </div>
                <div className="text-right">
                  <strong className="text-3xl font-black text-white">
                    {values.carb}
                  </strong>
                  <span className="text-gray-400 ml-1">g</span>
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MacroTable;

import React from "react";
import { Zap, Bed, Target } from "lucide-react";

const TdeeResultBox = ({ tdee, bmr, adjustedCalories, goal }) => {
  const goalText =
    goal === "gain" ? "tăng cân" : goal === "lose" ? "giảm mỡ" : "duy trì";

  return (
    <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="group bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-center border border-gray-700 hover:border-red-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/10">
        <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition">
          <Zap className="w-8 h-8 text-red-400" />
        </div>
        <h4 className="font-bold text-gray-300 text-lg uppercase tracking-wide mb-2">
          TDEE của bạn
        </h4>
        <div className="text-4xl md:text-5xl font-black text-[#ff0000]">
          {tdee} <span className="text-base text-gray-400">kcal/ngày</span>
        </div>
      </div>

      <div className="group bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-center border border-gray-700 hover:border-red-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/10">
        <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition">
          <Bed className="w-8 h-8 text-red-400" />
        </div>
        <h4 className="font-bold text-gray-300 text-lg uppercase tracking-wide mb-2">
          BMR của bạn
        </h4>
        <div className="text-4xl md:text-5xl font-black text-[#ff0000]">
          {bmr} <span className="text-base text-gray-400">kcal/ngày</span>
        </div>
      </div>

      <div className="group bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-center border border-gray-700 hover:border-red-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/10">
        <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition">
          <Target className="w-8 h-8 text-red-400" />
        </div>
        <h4 className="font-bold text-gray-300 text-lg uppercase tracking-wide mb-2">
          Lượng calories cần thiết ({goalText})
        </h4>
        <div className="text-4xl md:text-5xl font-black text-[#ff0000]">
          {adjustedCalories}{" "}
          <span className="text-base text-gray-400">kcal/ngày</span>
        </div>
      </div>
    </div>
  );
};

export default TdeeResultBox;

import React from "react";
import { Info, Wheat, Drumstick, Fish, Scale } from "lucide-react";

const NutritionLegend = () => (
  <div className="my-6 p-4 sm:p-5 bg-gray-800/40 rounded-2xl border border-gray-700">
    <h4 className="font-bold mb-4 text-primary flex items-center gap-2 text-base sm:text-lg">
      <Scale className="w-5 h-5" /> Chú thích dinh dưỡng
    </h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
          <span className="text-xs text-gray-300">100g</span>
        </div>
        <span className="text-gray-300 text-sm">Tổng khối lượng thực phẩm</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
          <Drumstick className="w-4 h-4 text-red-400" />
        </div>
        <span className="text-gray-300 text-sm">Lượng protein (đạm)</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
          <Wheat className="w-4 h-4 text-green-400" />
        </div>
        <span className="text-gray-300 text-sm">Lượng tinh bột (carb)</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
          <Fish className="w-4 h-4 text-yellow-400" />
        </div>
        <span className="text-gray-300 text-sm">Lượng chất béo (fat)</span>
      </div>
    </div>
    <div className="mt-5 p-3 sm:p-4 bg-blue-900/30 rounded-xl border-l-4 border-blue-500 flex items-start gap-3">
      <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
      <span className="text-xs sm:text-sm text-gray-200">
        <strong className="text-blue-300">Lưu ý:</strong> Trong carb hoặc fat
        vẫn có protein nên bạn có thể giảm 1 ít protein đi để đúng macro hơn.
        Tất cả thực phẩm đều được tính ở dạng sống.
      </span>
    </div>
  </div>
);

export default NutritionLegend;

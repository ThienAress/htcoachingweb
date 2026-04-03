import React, { useMemo, useState } from "react";
import { Search, ChevronUp, ChevronDown, Flame } from "lucide-react";

const FoodNutritionTable = ({ foodDatabase = [] }) => {
  const [searchText, setSearchText] = useState("");
  const [sortOrder, setSortOrder] = useState(null);

  const getFoodDisplayName = (food) => food?.label || food?.name || "Không tên";

  const getCalories = (item) =>
    Math.round(item.protein * 4 + item.carb * 4 + item.fat * 9);

  const filteredData = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return [...foodDatabase]
      .filter((item) =>
        getFoodDisplayName(item).toLowerCase().includes(keyword),
      )
      .sort((a, b) => {
        const calA = getCalories(a);
        const calB = getCalories(b);

        if (sortOrder === "asc") return calA - calB;
        if (sortOrder === "desc") return calB - calA;
        return 0;
      });
  }, [foodDatabase, searchText, sortOrder]);

  return (
    <div className="w-full bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm thực phẩm..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? null : "asc")}
            className={`px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-all text-sm sm:text-base ${
              sortOrder === "asc"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <ChevronUp className="w-4 h-4" /> Calories ↑
          </button>

          <button
            onClick={() => setSortOrder(sortOrder === "desc" ? null : "desc")}
            className={`px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-all text-sm sm:text-base ${
              sortOrder === "desc"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <ChevronDown className="w-4 h-4" /> Calories ↓
          </button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[640px] md:min-w-full">
          <div className="grid grid-cols-7 gap-3 bg-gray-900/80 p-3 rounded-t-xl border-b border-gray-700 text-gray-300 font-semibold text-sm">
            <div className="col-span-2">Thực phẩm</div>
            <div>Khẩu phần</div>
            <div>Protein</div>
            <div>Carb</div>
            <div>Fat</div>
            <div>
              <Flame className="w-4 h-4 inline mr-1 text-orange-400" /> Calo
            </div>
          </div>

          {filteredData.map((item) => {
            const calories = getCalories(item);

            return (
              <div
                key={item._id || getFoodDisplayName(item)}
                className="grid grid-cols-7 gap-3 p-3 border-b border-gray-700 hover:bg-gray-700/30 transition text-sm"
              >
                <div className="col-span-2 font-medium text-white break-words">
                  {getFoodDisplayName(item)}
                </div>
                <div className="text-gray-300">100g</div>
                <div className="text-red-400">
                  {Number(item.protein || 0).toFixed(1)}
                </div>
                <div className="text-green-400">
                  {Number(item.carb || 0).toFixed(1)}
                </div>
                <div className="text-yellow-400">
                  {Number(item.fat || 0).toFixed(1)}
                </div>
                <div className="text-orange-400 font-semibold">{calories}</div>
              </div>
            );
          })}

          {filteredData.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              Không tìm thấy thực phẩm
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodNutritionTable;

import React, { useMemo, useState } from "react";
import { Search, ChevronUp, ChevronDown, Flame, Lock, Crown } from "lucide-react";
import { Link } from "react-router-dom";

const FREE_VISIBLE_ROWS = 10;

const FoodNutritionTable = ({ foodDatabase = [], canViewFull = true }) => {
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

  // Nếu hết lượt miễn phí → chỉ hiển thị 10 dòng đầu
  const visibleData = canViewFull ? filteredData : filteredData.slice(0, FREE_VISIBLE_ROWS);
  const hasHiddenRows = !canViewFull && filteredData.length > FREE_VISIBLE_ROWS;

  return (
    <div className="w-full bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={canViewFull ? "Tìm kiếm thực phẩm..." : "🔒 Nâng cấp gói để tìm kiếm"}
            value={canViewFull ? searchText : ""}
            onChange={(e) => canViewFull && setSearchText(e.target.value)}
            disabled={!canViewFull}
            className={`w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary ${!canViewFull ? "text-gray-500 cursor-not-allowed opacity-60" : "text-white"}`}
          />
          <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => canViewFull && setSortOrder(sortOrder === "asc" ? null : "asc")}
            disabled={!canViewFull}
            className={`px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-all text-sm sm:text-base ${
              !canViewFull
                ? "bg-gray-700/50 text-gray-500 cursor-not-allowed opacity-60"
                : sortOrder === "asc"
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <ChevronUp className="w-4 h-4" /> Calories ↑
          </button>

          <button
            onClick={() => canViewFull && setSortOrder(sortOrder === "desc" ? null : "desc")}
            disabled={!canViewFull}
            className={`px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-all text-sm sm:text-base ${
              !canViewFull
                ? "bg-gray-700/50 text-gray-500 cursor-not-allowed opacity-60"
                : sortOrder === "desc"
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <ChevronDown className="w-4 h-4" /> Calories ↓
          </button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[640px] md:min-w-full relative">
          <div className="grid grid-cols-7 gap-3 bg-gray-900/80 p-3 rounded-t-xl border-b border-gray-700 text-gray-300 font-semibold text-sm">
            <div className="col-span-2">Thực phẩm</div>
            <div>Khẩu phần</div>
            <div>Protein</div>
            <div>Carb</div>
            <div>Fat</div>
            <div>
              <Flame className="w-4 h-4 inline mr-1 text-primary" /> Calo
            </div>
          </div>

          {visibleData.map((item, index) => {
            const calories = getCalories(item);
            // Mờ dần 3 dòng cuối nếu hết lượt
            const isFading = hasHiddenRows && index >= FREE_VISIBLE_ROWS - 3;
            const fadingOpacity = isFading
              ? 1 - ((index - (FREE_VISIBLE_ROWS - 3)) / 3) * 0.6
              : 1;

            return (
              <div
                key={item._id || getFoodDisplayName(item)}
                className="grid grid-cols-7 gap-3 p-3 border-b border-gray-700 hover:bg-gray-700/30 transition text-sm"
                style={isFading ? { opacity: fadingOpacity } : undefined}
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
                <div className="text-primary font-semibold">{calories}</div>
              </div>
            );
          })}

          {/* Overlay khi hết lượt */}
          {hasHiddenRows && (
            <div className="relative">
              {/* Gradient fade */}
              <div className="absolute -top-20 left-0 right-0 h-20 bg-gradient-to-t from-gray-800/95 to-transparent pointer-events-none z-10" />

              {/* CTA nâng cấp */}
              <div className="bg-gradient-to-b from-gray-800/95 to-gray-900/98 py-12 px-6 text-center border-t border-gray-700/50">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 mb-4">
                  <Lock className="w-7 h-7 text-primary" />
                </div>

                <h3 className="text-xl font-bold text-white mb-2">
                  Còn {filteredData.length - FREE_VISIBLE_ROWS}+ thực phẩm chưa mở khóa
                </h3>

                <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                  Nâng cấp gói dịch vụ để xem toàn bộ bảng dinh dưỡng với {filteredData.length} thực phẩm
                  và sử dụng gợi ý thực đơn không giới hạn.
                </p>

                <Link
                  to="/"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transform hover:scale-[1.02]"
                >
                  <Crown className="w-5 h-5" />
                  Nâng cấp gói dịch vụ
                </Link>
              </div>
            </div>
          )}

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

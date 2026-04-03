import React, { useState, useEffect, useMemo, useCallback } from "react";
import { X, Save, Search } from "lucide-react";

const GROUP_CATEGORY_MAP = {
  carb: ["main_carb", "light_carb", "fruit"],
  protein: [
    "animal_protein",
    "dairy_protein",
    "supplement_protein",
    "plant_protein",
  ],
  fat: ["cooking_fat", "whole_food_fat"],
};

const FoodSelectorModal = ({
  isOpen,
  onClose,
  onSave,
  initialSelected,
  foodDatabase = [],
}) => {
  const [searchTerms, setSearchTerms] = useState({
    carb: "",
    protein: "",
    fat: "",
  });

  const [selected, setSelected] = useState({ carb: [], protein: [], fat: [] });

  const getFoodDisplayName = useCallback(
    (food) => food?.label || food?.name || "Không tên",
    [],
  );

  const groupedFoods = useMemo(() => {
    if (!foodDatabase || foodDatabase.length === 0) {
      return { carb: [], protein: [], fat: [] };
    }

    return {
      carb: foodDatabase.filter((f) =>
        GROUP_CATEGORY_MAP.carb.includes(f.category),
      ),
      protein: foodDatabase.filter((f) =>
        GROUP_CATEGORY_MAP.protein.includes(f.category),
      ),
      fat: foodDatabase.filter((f) =>
        GROUP_CATEGORY_MAP.fat.includes(f.category),
      ),
    };
  }, [foodDatabase]);

  useEffect(() => {
    if (initialSelected) {
      setSelected(initialSelected);
      return;
    }

    setSelected({
      carb: groupedFoods.carb.map((f) => f._id),
      protein: groupedFoods.protein.map((f) => f._id),
      fat: groupedFoods.fat.map((f) => f._id),
    });
  }, [initialSelected, groupedFoods]);

  const handleToggle = useCallback((foodId, group) => {
    setSelected((prev) => ({
      ...prev,
      [group]: prev[group].includes(foodId)
        ? prev[group].filter((id) => id !== foodId)
        : [...prev[group], foodId],
    }));
  }, []);

  const handleSelectAll = useCallback(
    (group) => {
      setSelected((prev) => ({
        ...prev,
        [group]: groupedFoods[group].map((f) => f._id),
      }));
    },
    [groupedFoods],
  );

  const handleClearAll = useCallback((group) => {
    setSelected((prev) => ({
      ...prev,
      [group]: [],
    }));
  }, []);

  const handleSave = useCallback(() => onSave(selected), [onSave, selected]);

  const handleSearchChange = (group, value) => {
    setSearchTerms((prev) => ({
      ...prev,
      [group]: value,
    }));
  };

  const filterBySearch = useCallback(
    (foods, term) => {
      const keyword = term.trim().toLowerCase();
      if (!keyword) return foods;

      return foods.filter((f) =>
        getFoodDisplayName(f).toLowerCase().includes(keyword),
      );
    },
    [getFoodDisplayName],
  );

  if (!isOpen) return null;

  if (!foodDatabase || foodDatabase.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-2xl p-6 text-white">
          Đang tải dữ liệu...
        </div>
      </div>
    );
  }

  const carbFoods = filterBySearch(groupedFoods.carb, searchTerms.carb);
  const proteinFoods = filterBySearch(
    groupedFoods.protein,
    searchTerms.protein,
  );
  const fatFoods = filterBySearch(groupedFoods.fat, searchTerms.fat);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-4 sm:px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-bold text-white">
            📌 Chọn thực phẩm yêu thích
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tinh bột */}
            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
              <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <h3 className="font-bold text-green-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Tinh bột
                </h3>
                <div className="space-x-2 text-xs">
                  <button
                    onClick={() => handleSelectAll("carb")}
                    className="text-blue-400 hover:underline"
                  >
                    Chọn tất
                  </button>
                  <button
                    onClick={() => handleClearAll("carb")}
                    className="text-red-400 hover:underline"
                  >
                    Bỏ hết
                  </button>
                </div>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchTerms.carb}
                  onChange={(e) => handleSearchChange("carb", e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {carbFoods.map((food) => (
                  <label
                    key={food._id}
                    className="flex items-center gap-2 text-sm text-gray-200 p-1 hover:bg-gray-700 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selected.carb.includes(food._id)}
                      onChange={() => handleToggle(food._id, "carb")}
                      className="rounded"
                    />
                    <span className="break-words">
                      {getFoodDisplayName(food)}
                    </span>
                  </label>
                ))}
                {carbFoods.length === 0 && (
                  <div className="text-gray-500 text-sm">Không có</div>
                )}
              </div>
            </div>

            {/* Đạm */}
            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
              <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <h3 className="font-bold text-red-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                  Đạm
                </h3>
                <div className="space-x-2 text-xs">
                  <button
                    onClick={() => handleSelectAll("protein")}
                    className="text-blue-400 hover:underline"
                  >
                    Chọn tất
                  </button>
                  <button
                    onClick={() => handleClearAll("protein")}
                    className="text-red-400 hover:underline"
                  >
                    Bỏ hết
                  </button>
                </div>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchTerms.protein}
                  onChange={(e) =>
                    handleSearchChange("protein", e.target.value)
                  }
                  className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {proteinFoods.map((food) => (
                  <label
                    key={food._id}
                    className="flex items-center gap-2 text-sm text-gray-200 p-1 hover:bg-gray-700 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selected.protein.includes(food._id)}
                      onChange={() => handleToggle(food._id, "protein")}
                      className="rounded"
                    />
                    <span>{getFoodDisplayName(food)}</span>
                  </label>
                ))}
                {proteinFoods.length === 0 && (
                  <div className="text-gray-500 text-sm">Không có</div>
                )}
              </div>
            </div>

            {/* Chất béo */}
            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
              <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <h3 className="font-bold text-yellow-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                  Chất béo
                </h3>
                <div className="space-x-2 text-xs">
                  <button
                    onClick={() => handleSelectAll("fat")}
                    className="text-blue-400 hover:underline"
                  >
                    Chọn tất
                  </button>
                  <button
                    onClick={() => handleClearAll("fat")}
                    className="text-red-400 hover:underline"
                  >
                    Bỏ hết
                  </button>
                </div>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchTerms.fat}
                  onChange={(e) => handleSearchChange("fat", e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-1 focus:ring-yellow-500"
                />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {fatFoods.map((food) => (
                  <label
                    key={food._id}
                    className="flex items-center gap-2 text-sm text-gray-200 p-1 hover:bg-gray-700 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selected.fat.includes(food._id)}
                      onChange={() => handleToggle(food._id, "fat")}
                      className="rounded"
                    />
                    <span>{getFoodDisplayName(food)}</span>
                  </label>
                ))}
                {fatFoods.length === 0 && (
                  <div className="text-gray-500 text-sm">Không có</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-4 sm:px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-600 rounded-xl text-gray-300 hover:bg-gray-700 transition"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl text-white font-semibold flex items-center gap-2 shadow-lg"
          >
            <Save className="w-4 h-4" /> Lưu
          </button>
        </div>
      </div>
    </div>
  );
};

export default FoodSelectorModal;

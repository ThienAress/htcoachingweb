import { useState, useMemo } from "react";
import { X, Search, Check } from "lucide-react";

const GROUP_LABELS = {
  protein: { label: "Đạm (Protein)", color: "text-red-400", border: "border-red-400", bg: "bg-red-400/10" },
  carb: { label: "Tinh bột (Carb)", color: "text-green-400", border: "border-green-400", bg: "bg-green-400/10" },
  fat: { label: "Chất béo (Fat)", color: "text-yellow-400", border: "border-yellow-400", bg: "bg-yellow-400/10" },
};

const classifyFood = (food) => {
  const protein = Number(food.protein || 0);
  const carb = Number(food.carb || 0);
  const fat = Number(food.fat || 0);
  const max = Math.max(protein, carb, fat);
  if (max === protein) return "protein";
  if (max === carb) return "carb";
  return "fat";
};

export default function FoodSelectorModal({ isOpen, onClose, onSave, initialSelected, foodDatabase = [] }) {
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState("protein");
  const [selected, setSelected] = useState(() => initialSelected || { protein: [], carb: [], fat: [] });

  const groupedFoods = useMemo(() => {
    const groups = { protein: [], carb: [], fat: [] };
    foodDatabase.forEach((food) => {
      const group = classifyFood(food);
      if (groups[group]) groups[group].push(food);
    });
    return groups;
  }, [foodDatabase]);

  const filteredFoods = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return groupedFoods[activeGroup]?.filter((food) =>
      !keyword || (food.label || food.name || "").toLowerCase().includes(keyword)
    ) || [];
  }, [groupedFoods, activeGroup, search]);

  const toggleFood = (food) => {
    const id = food._id;
    const current = selected[activeGroup] || [];
    const isSelected = current.includes(id);
    setSelected((prev) => ({
      ...prev,
      [activeGroup]: isSelected ? current.filter((i) => i !== id) : [...current, id],
    }));
  };

  const totalSelected = Object.values(selected).flat().length;

  const handleSave = () => {
    onSave(selected);
  };

  const handleReset = () => {
    setSelected({ protein: [], carb: [], fat: [] });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-bold text-white">Chọn món yêu thích</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Hệ thống sẽ ưu tiên các món bạn chọn khi tạo thực đơn
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Group Tabs */}
        <div className="flex gap-2 px-6 pt-4">
          {Object.entries(GROUP_LABELS).map(([group, meta]) => (
            <button
              key={group}
              onClick={() => { setActiveGroup(group); setSearch(""); }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border transition ${
                activeGroup === group
                  ? `${meta.bg} ${meta.border} ${meta.color}`
                  : "border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              {meta.label}
              {selected[group]?.length > 0 && (
                <span className={`ml-1.5 text-xs font-bold ${meta.color}`}>
                  ({selected[group].length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-6 pt-3 pb-2 relative">
          <Search className="absolute left-9 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 mt-1.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm món ăn..."
            className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Food List */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2">
          {filteredFoods.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">Không tìm thấy món nào</p>
          ) : (
            filteredFoods.map((food) => {
              const id = food._id;
              const isSelected = (selected[activeGroup] || []).includes(id);
              const meta = GROUP_LABELS[activeGroup];
              return (
                <button
                  key={id}
                  onClick={() => toggleFood(food)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition ${
                    isSelected
                      ? `${meta.bg} ${meta.border}`
                      : "border-gray-700 hover:border-gray-500 bg-gray-800/50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${isSelected ? meta.color : "text-white"}`}>
                      {food.label || food.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Đạm: {food.protein}g · Carb: {food.carb}g · Béo: {food.fat}g / 100g
                    </p>
                  </div>
                  {isSelected && <Check className={`w-4 h-4 shrink-0 ${meta.color}`} />}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-400">
            Đã chọn: <span className="font-bold text-white">{totalSelected}</span> món
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg transition"
            >
              Xóa tất cả
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-sm font-semibold bg-primary hover:bg-primary-dark text-white rounded-lg transition"
            >
              Lưu danh sách
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

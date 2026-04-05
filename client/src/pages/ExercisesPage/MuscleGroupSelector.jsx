import React from "react";
import { X, CheckCircle } from "lucide-react";

export default function MuscleGroupSelector({
  muscleGroups,
  selected,
  onToggle,
  showCustomGroupModal,
  setShowCustomGroupModal,
  tempSelectedGroups,
  setTempSelectedGroups,
  handleCreateCustomGroup,
}) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {muscleGroups.map((group) => {
          const isSelected = selected.includes(group.id);
          return (
            <div
              key={group.id}
              onClick={() => onToggle(group.id)}
              className={`p-4 rounded-xl text-center cursor-pointer transition-all duration-200 border-2 ${
                isSelected
                  ? "bg-red-500/20 border-red-500 shadow-lg shadow-red-500/20"
                  : "bg-gray-800/50 border-gray-700 hover:border-red-500/50"
              }`}
            >
              <span
                className={`font-semibold ${isSelected ? "text-red-400" : "text-gray-300"}`}
              >
                {group.name}
              </span>
              {isSelected && (
                <CheckCircle className="w-4 h-4 text-red-500 mx-auto mt-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Modal chọn nhóm cơ tùy chỉnh */}
      {showCustomGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-800 rounded-2xl max-w-md w-full p-6 border border-gray-700 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-red-500" />
                CHỌN NHÓM CƠ
              </h3>
              <button
                onClick={() => setShowCustomGroupModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-auto">
              {muscleGroups
                .filter((g) => g.id !== "custom")
                .map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-700 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={tempSelectedGroups.includes(group.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTempSelectedGroups((prev) =>
                          checked
                            ? [...prev, group.id]
                            : prev.filter((id) => id !== group.id),
                        );
                      }}
                      className="w-4 h-4 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-gray-200">{group.name}</span>
                  </label>
                ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCustomGroupModal(false)}
                className="px-4 py-2 border border-gray-600 rounded-xl text-gray-300 hover:bg-gray-700 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateCustomGroup}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-600/30 transition"
              >
                Tạo nhóm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

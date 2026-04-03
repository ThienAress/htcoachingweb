import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

const MacroAdjustModal = ({ isOpen, onClose, initialValues, onSave }) => {
  const [formValues, setFormValues] = useState({
    protein: "",
    carb: "",
    fat: "",
  });

  useEffect(() => {
    if (!isOpen) return;

    setFormValues({
      protein: String(initialValues?.protein ?? ""),
      carb: String(initialValues?.carb ?? ""),
      fat: String(initialValues?.fat ?? ""),
    });
  }, [isOpen, initialValues?.protein, initialValues?.carb, initialValues?.fat]);

  const handleChange = (key, value) => {
    const sanitized = value.replace(/[^\d]/g, "");
    setFormValues((prev) => ({
      ...prev,
      [key]: sanitized,
    }));
  };

  const calcCalories = (protein, carb, fat) => protein * 4 + carb * 4 + fat * 9;

  const proteinNum = Number(formValues.protein || 0);
  const carbNum = Number(formValues.carb || 0);
  const fatNum = Number(formValues.fat || 0);
  const previewCalories = calcCalories(proteinNum, carbNum, fatNum);

  const handleSave = () => {
    const payload = {
      protein: proteinNum,
      carb: carbNum,
      fat: fatNum,
      calories: previewCalories,
    };

    onSave?.(payload);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">Tinh chỉnh macro</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 transition"
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-sm text-gray-400 bg-gray-900/50 border border-gray-700 rounded-xl p-3">
            Modal này đang hiển thị{" "}
            <span className="text-white font-semibold">
              macro hiện tại của thực đơn
            </span>
            . Bạn sửa các số này thành{" "}
            <span className="text-white font-semibold">macro muốn đạt tới</span>
            , rồi bấm lưu.
          </div>

          <div>
            <label className="block text-sm font-medium text-red-400 mb-2">
              Đạm mục tiêu (g)
            </label>
            <input
              type="text"
              value={formValues.protein}
              onChange={(e) => handleChange("protein", e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Nhập đạm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-400 mb-2">
              Tinh bột mục tiêu (g)
            </label>
            <input
              type="text"
              value={formValues.carb}
              onChange={(e) => handleChange("carb", e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Nhập tinh bột"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-yellow-400 mb-2">
              Chất béo mục tiêu (g)
            </label>
            <input
              type="text"
              value={formValues.fat}
              onChange={(e) => handleChange("fat", e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="Nhập chất béo"
            />
          </div>

          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm">
            <div className="text-gray-300">
              Calories dự kiến:
              <span className="ml-2 font-bold text-orange-400">
                {previewCalories.toLocaleString()} kcal
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition"
          >
            Đóng
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold transition"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
};

export default MacroAdjustModal;

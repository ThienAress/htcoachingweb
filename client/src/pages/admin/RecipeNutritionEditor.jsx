import { Plus, Trash2 } from "lucide-react";
import {
  CORE_NUTRITION_FIELDS,
  createAdditionalNutritionRow,
} from "./recipeNutritionForm";

const inputClass =
  "min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-primary disabled:opacity-60";

const RecipeNutritionEditor = ({ value, onChange, disabled = false }) => {
  const updateCore = (key, nextValue) =>
    onChange({ ...value, [key]: nextValue });
  const updateAdditional = (rowId, field, nextValue) =>
    onChange({
      ...value,
      additional: value.additional.map((item) =>
        item.rowId === rowId ? { ...item, [field]: nextValue } : item,
      ),
    });

  return (
    <fieldset className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5">
      <legend className="px-2 text-base font-bold text-gray-900">
        Dinh dưỡng toàn công thức
      </legend>
      <p className="mb-4 text-sm leading-6 text-gray-500">
        Admin nhập tổng của toàn bộ công thức, không chia theo khẩu phần. Sáu chỉ
        số dưới đây luôn bắt buộc.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CORE_NUTRITION_FIELDS.map(({ key, label, unit, step }) => (
          <label key={key} className="text-sm font-medium text-gray-700">
            {label} ({unit})
            <input
              type="number"
              min="0"
              step={step}
              required
              value={value[key]}
              onChange={(event) => updateCore(key, event.target.value)}
              disabled={disabled}
              className={inputClass}
            />
          </label>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-5">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Thành phần bổ sung</h3>
          <p className="mt-1 text-xs text-gray-500">
            Ví dụ: chất xơ, chất béo bão hòa, kali hoặc vitamin.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              additional: [...value.additional, createAdditionalNutritionRow()],
            })
          }
          disabled={disabled || value.additional.length >= 20}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" /> Thêm thành phần
        </button>
      </div>

      {value.additional.length > 0 && (
        <div className="mt-4 space-y-3">
          {value.additional.map((item, index) => (
            <div
              key={item.rowId}
              className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_100px_140px_44px] sm:items-end"
            >
              <label className="text-xs font-medium text-gray-600">
                Tên thành phần {index + 1}
                <input
                  value={item.label}
                  onChange={(event) =>
                    updateAdditional(item.rowId, "label", event.target.value)
                  }
                  maxLength={80}
                  required
                  disabled={disabled}
                  className={inputClass}
                  placeholder="Chất xơ"
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Đơn vị
                <select
                  value={item.unit}
                  onChange={(event) =>
                    updateAdditional(item.rowId, "unit", event.target.value)
                  }
                  disabled={disabled}
                  className={inputClass}
                >
                  <option value="g">g</option>
                  <option value="mg">mg</option>
                  <option value="mcg">mcg</option>
                  <option value="kcal">kcal</option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-600">
                Giá trị
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={item.value}
                  onChange={(event) =>
                    updateAdditional(item.rowId, "value", event.target.value)
                  }
                  required
                  disabled={disabled}
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    additional: value.additional.filter(
                      (entry) => entry.rowId !== item.rowId,
                    ),
                  })
                }
                disabled={disabled}
                aria-label={`Xóa thành phần ${item.label || index + 1}`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
};

export default RecipeNutritionEditor;

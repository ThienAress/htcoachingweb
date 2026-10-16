import { Plus, X } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import { MAX_LIST_ITEMS } from "../../../utils/f1StageDesign";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100";

// Danh sách dòng chữ thêm/xoá được (trọng tâm chính, thay đổi có thể thấy, khi nào chuyển tiếp).
const F1StageListEditor = ({ control, register, name, label }) => {
  const { fields, append, remove } = useFieldArray({ control, name });
  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-semibold text-slate-700">{label}</p>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <input
              aria-label={`${label} ${index + 1}`}
              maxLength={200}
              className={inputClass}
              {...register(`${name}.${index}.value`)}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Xoá dòng ${index + 1} của ${label}`}
              className="shrink-0 rounded-lg border border-slate-200 px-2 text-slate-500 hover:bg-slate-50 hover:text-red-600"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
        {fields.length < MAX_LIST_ITEMS ? (
          <button
            type="button"
            onClick={() => append({ value: "" })}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus size={14} aria-hidden="true" />
            Thêm
          </button>
        ) : (
          <p className="text-xs text-slate-500">Tối đa {MAX_LIST_ITEMS} dòng</p>
        )}
      </div>
    </div>
  );
};

export default F1StageListEditor;

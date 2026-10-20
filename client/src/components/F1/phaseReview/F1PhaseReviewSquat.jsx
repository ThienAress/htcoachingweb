import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray } from "react-hook-form";
import RoundedSelect from "../assessment/RoundedSelect";
import { OHSA_VIEWS } from "../../../utils/f1PhaseReview";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100";

const STATUS = [
  { value: "persists", label: "Còn" },
  { value: "resolved", label: "Đã hết" },
];

const F1PhaseReviewSquat = ({ control, errors, idPrefix }) => {
  const { fields, append, remove } = useFieldArray({ control, name: "ohsa.items" });
  const rows = fields.map((field, index) => ({ field, index }));
  const added = rows.filter(({ field }) => !field.fixed);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {OHSA_VIEWS.map((view) => {
          const items = rows.filter(({ field }) => field.fixed && field.view === view.value);
          return (
            <div key={view.value} className="min-w-0 rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">{view.label}</p>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Không có biểu hiện</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {items.map(({ field, index }) => (
                    <li key={field.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-700">{field.label}</span>
                      <Controller
                        control={control}
                        name={`ohsa.items.${index}.status`}
                        render={({ field: statusField }) => (
                          <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={field.label}>
                            {STATUS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={statusField.value === option.value}
                                onClick={() => statusField.onChange(option.value)}
                                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                                  statusField.value === option.value
                                    ? "border-orange-300 bg-orange-50 text-orange-800"
                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800">Biểu hiện tư thế sai mới</p>
          <button
            type="button"
            onClick={() => append({ view: "", key: "", label: "", status: "new", fixed: false })}
            aria-label="Thêm biểu hiện tư thế sai mới"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus size={14} aria-hidden="true" />
            Thêm
          </button>
        </div>
        {added.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Chưa có biểu hiện mới.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {added.map(({ field, index }) => {
              const rowErrors = errors.ohsa?.items?.[index];
              return (
                <div key={field.id} className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr_auto] sm:items-start">
                  <div>
                    <Controller
                      control={control}
                      name={`ohsa.items.${index}.view`}
                      render={({ field: viewField }) => (
                        <RoundedSelect
                          label="Góc nhìn của biểu hiện mới"
                          value={viewField.value}
                          onChange={viewField.onChange}
                          placeholder="Chọn góc nhìn"
                          options={OHSA_VIEWS}
                        />
                      )}
                    />
                    {rowErrors?.view && <p className="mt-1 text-xs font-medium text-red-600">{rowErrors.view.message}</p>}
                  </div>
                  <div>
                    <Controller
                      control={control}
                      name={`ohsa.items.${index}.label`}
                      render={({ field: labelField }) => (
                        <input
                          id={`${idPrefix}-new-${index}`}
                          aria-label="Biểu hiện tư thế sai mới"
                          maxLength={100}
                          placeholder="Ví dụ: Võng thắt lưng"
                          className={inputClass}
                          {...labelField}
                        />
                      )}
                    />
                    {rowErrors?.label && <p className="mt-1 text-xs font-medium text-red-600">{rowErrors.label.message}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label="Xoá biểu hiện mới"
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-red-600"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default F1PhaseReviewSquat;

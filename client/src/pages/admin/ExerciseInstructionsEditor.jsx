import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

const EMPTY_STEP = { title: "", description: "" };

export default function ExerciseInstructionsEditor({ value = [], onChange }) {
  const updateStep = (index, field, nextValue) => {
    onChange(
      value.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [field]: nextValue } : step,
      ),
    );
  };

  const moveStep = (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <fieldset className="rounded-xl border border-gray-200 p-4">
      <legend className="text-sm font-bold text-gray-800">
        Hướng dẫn setup từng bước
      </legend>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mt-1 text-xs text-gray-500">
            Các bước sẽ hiển thị toàn bộ theo đúng thứ tự bên dưới.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...value, { ...EMPTY_STEP }])}
          disabled={value.length >= 30}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
          Thêm bước
        </button>
      </div>

      {value.length ? (
        <div className="mt-4 space-y-4">
          {value.map((step, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm text-gray-800">
                  Bước {index + 1}
                </strong>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                    aria-label={`Di chuyển bước ${index + 1} lên`}
                    className="rounded-lg p-2 text-gray-500 hover:bg-white hover:text-indigo-600 disabled:opacity-30"
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(index, 1)}
                    disabled={index === value.length - 1}
                    aria-label={`Di chuyển bước ${index + 1} xuống`}
                    className="rounded-lg p-2 text-gray-500 hover:bg-white hover:text-indigo-600 disabled:opacity-30"
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(value.filter((_, stepIndex) => stepIndex !== index))
                    }
                    aria-label={`Xóa bước ${index + 1}`}
                    className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <label className="mt-3 block text-xs font-semibold text-gray-600">
                Tiêu đề bước *
                <input
                  type="text"
                  value={step.title}
                  onChange={(event) =>
                    updateStep(index, "title", event.target.value)
                  }
                  maxLength={160}
                  required
                  placeholder="Ví dụ: Chỉnh chiều cao ghế"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>
              <label className="mt-3 block text-xs font-semibold text-gray-600">
                Mô tả thực hiện
                <textarea
                  value={step.description || ""}
                  onChange={(event) =>
                    updateStep(index, "description", event.target.value)
                  }
                  maxLength={2000}
                  rows={3}
                  placeholder="Mô tả vị trí cơ thể, thiết bị và điểm cần kiểm tra..."
                  className="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
          Chưa có bước setup. Bài tập vẫn có thể lưu và bổ sung sau.
        </p>
      )}
    </fieldset>
  );
}

import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { giftsFromText, giftsToText } from "../../../utils/pricingGifts";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

// Ô nhập danh sách (mỗi dòng một mục) dùng cho quà tặng và quyền lợi của bảng giá.
// `saved` là danh sách admin đã lưu (undefined = đang dùng mặc định); `validate` trả thông báo lỗi hoặc "".
const ListEditor = ({
  id,
  title,
  label,
  help,
  placeholder,
  saved,
  defaults,
  validate,
  busy,
  onSave,
  onReset,
}) => {
  const isCustom = Array.isArray(saved);
  const serverText = giftsToText(isCustom ? saved : defaults);
  const [text, setText] = useState(serverText);
  const [syncedText, setSyncedText] = useState(serverText);
  const [error, setError] = useState("");

  // Dữ liệu từ máy chủ đổi (sau khi lưu hoặc khôi phục) thì nạp lại ô nhập.
  if (serverText !== syncedText) {
    setSyncedText(serverText);
    setText(serverText);
    setError("");
  }

  const items = giftsFromText(text);
  const dirty = giftsToText(items) !== serverText;
  const fieldId = `list-${id}`;

  const handleSave = () => {
    const message = validate(items);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    onSave(items);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isCustom ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {isCustom ? "Đã chỉnh" : "Đang dùng mặc định"}
        </span>
      </div>

      <label htmlFor={fieldId} className="mt-3 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={fieldId}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError("");
        }}
        rows={Math.min(10, Math.max(3, items.length + 1))}
        aria-invalid={Boolean(error)}
        aria-describedby={`${fieldId}-help`}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus-visible:border-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
      />
      <p id={`${fieldId}-help`} className="mt-1 text-xs text-slate-500">
        {help}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !dirty}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-dark focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
        >
          <Save size={16} aria-hidden="true" />
          Lưu
        </button>
        {isCustom && (
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Khôi phục mặc định
          </button>
        )}
      </div>
    </section>
  );
};

export default ListEditor;

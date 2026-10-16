// SuggestedVolume.jsx — khối "Khối lượng tập đề xuất": hệ thống đề xuất sẵn Sets x Reps và Sets x Time, HLV chỉnh bằng icon bút
import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { buildVolume, formatVolume } from "../../../utils/suggestedVolume";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100";

const VolumeLine = ({ title, protocol, onSave }) => {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");

  const startEdit = () => {
    setError("");
    setDraft({
      setsMin: String(protocol.setsMin),
      setsMax: String(protocol.setsMax),
      valueMin: String(protocol.valueMin),
      valueMax: String(protocol.valueMax),
    });
  };
  const save = () => {
    const result = buildVolume(protocol, draft);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSave(result.protocol);
    setDraft(null);
  };
  const unit = protocol.mode === "time" ? "giây" : "reps";
  const field = (key, label) => (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        type="number"
        min="1"
        inputMode="numeric"
        className={inputClass}
        value={draft[key]}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
      />
    </label>
  );

  return (
    <div className="rounded-lg border border-orange-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-700">
          <span className="font-semibold">{title}:</span> {formatVolume(protocol)}
        </p>
        {!draft && (
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Sửa ${title}`}
            title={`Sửa ${title}`}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-orange-50 hover:text-orange-700"
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      {draft && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {field("setsMin", "Sets từ")}
            {field("setsMax", "Sets đến")}
            {field("valueMin", `${unit === "giây" ? "Giây" : "Reps"} từ`)}
            {field("valueMax", `${unit === "giây" ? "Giây" : "Reps"} đến`)}
          </div>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-700"
            >
              <Check size={14} aria-hidden="true" />
              Lưu
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <X size={14} aria-hidden="true" />
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SuggestedVolume = ({ repsProtocol, timeProtocol, onChangeProtocol }) => (
  <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50/40 p-4">
    <p className="text-sm font-bold text-slate-800">Khối lượng tập đề xuất</p>
    <VolumeLine title="Sets x Reps" protocol={repsProtocol} onSave={(next) => onChangeProtocol("reps", next)} />
    <VolumeLine title="Sets x Time" protocol={timeProtocol} onSave={(next) => onChangeProtocol("time", next)} />
  </div>
);

export default SuggestedVolume;

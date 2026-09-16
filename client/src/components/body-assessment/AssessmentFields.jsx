import { useEffect, useId, useState } from "react";
import { BodySilhouette } from "./BodySilhouette";
import { BODY_REGIONS, assessmentInputClass, assessmentButtonClass } from "./bodyAssessment";

const POSITION = { leftArm: "col-start-1 row-start-1", rightArm: "col-start-3 row-start-1", trunk: "col-start-1 col-end-4 row-start-4 grid grid-cols-2 gap-x-3", leftLeg: "col-start-1 row-start-3", rightLeg: "col-start-3 row-start-3" };
const Panel = ({ kind, register, setFocus, errors, disabled, tableMode, id }) => {
  const [selected, setSelected] = useState("trunk");
  const title = kind === "lean" ? "Phân bổ cơ nạc từng vùng" : "Phân bổ mỡ từng vùng";
  const select = (region) => { setSelected(region); setFocus(`segments.${region}.${kind}Kg`); };
  return (
    <fieldset className="min-w-0 border-t border-slate-700 pt-4" disabled={disabled}>
      <legend className="px-1 text-base font-bold text-slate-100">{title}</legend>
      <div className={tableMode ? "space-y-3" : "grid grid-cols-[minmax(0,1fr)_minmax(0,.65fr)_minmax(0,1fr)] gap-2"}>
        {!tableMode && <div className="col-start-1 col-end-4 row-start-1 row-end-4 flex items-center justify-center"><BodySilhouette label={title} selectedRegion={selected} onSelect={disabled ? undefined : select} /></div>}
        {BODY_REGIONS.map(([region, label]) => (
          <div key={region} className={tableMode ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2" : `${POSITION[region]} relative min-w-0 rounded-lg bg-slate-950`}>
            <button type="button" onClick={() => select(region)} className={`${!tableMode && region === "trunk" ? "col-span-2" : ""} min-h-11 w-full rounded text-left text-sm font-semibold text-slate-100 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400`} disabled={disabled}>{label}</button>
            {[`${kind}Kg`, `${kind}ReferencePercent`].map((field) => {
              const path = `segments.${region}.${field}`;
              const error = errors.segments?.[region]?.[field];
              return <label key={field} className="block min-w-0 text-xs text-slate-300" htmlFor={`${id}-${path}`}>
                <span className="sr-only">{title} — {label} — </span>{field.endsWith("Kg") ? "kg" : "% tham chiếu"}
                <input id={`${id}-${path}`} type="number" inputMode="decimal" step="any" min="0" {...register(path)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-${path}-error` : undefined} className={assessmentInputClass} />
                {error && <span id={`${id}-${path}-error`} className="block text-red-300">Số đo không hợp lệ</span>}
              </label>;
            })}
          </div>
        ))}
      </div>
    </fieldset>
  );
};

export const AssessmentFields = (props) => {
  const [kind, setKind] = useState("lean");
  const [tableMode, setTableMode] = useState(false);
  const id = useId();
  const firstInvalid = BODY_REGIONS.flatMap(([region]) => ["leanKg", "leanReferencePercent", "fatKg", "fatReferencePercent"].map((field) => ({ region, field })))
    .find(({ region, field }) => props.errors.segments?.[region]?.[field]);
  const invalidPath = firstInvalid ? `segments.${firstInvalid.region}.${firstInvalid.field}` : "";
  const visibleKind = firstInvalid ? (firstInvalid.field.startsWith("fat") ? "fat" : "lean") : kind;
  const { setFocus } = props;
  useEffect(() => { if (invalidPath) setFocus(invalidPath); }, [invalidPath, setFocus]);
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <div className="flex gap-2 lg:hidden" role="group" aria-label="Loại thành phần cơ thể">
        {[["lean", "Khối nạc"], ["fat", "Khối mỡ"]].map(([key, label]) => <button type="button" key={key} aria-pressed={visibleKind === key} disabled={props.disabled} onClick={() => setKind(key)} className={assessmentButtonClass}>{label}</button>)}
      </div>
      <button type="button" disabled={props.disabled} onClick={() => setTableMode((value) => !value)} aria-pressed={tableMode} className={assessmentButtonClass}>{tableMode ? "Nhập trên sơ đồ" : "Nhập dạng bảng"}</button>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      {["lean", "fat"].map((key) => <div key={key} className={visibleKind === key ? "min-w-0" : "hidden min-w-0 lg:block"}><Panel {...props} id={id} kind={key} tableMode={tableMode} /></div>)}
    </div>
    <p className="text-xs leading-5 text-slate-400">Trái/phải theo nhãn trên phiếu đo. Khối nạc không đồng nghĩa riêng với cơ xương. % tham chiếu có thể vượt 100%.</p>
  </div>;
};

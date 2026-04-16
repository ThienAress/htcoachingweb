import { useEffect, useState } from "react";

const Field = ({ label, ...props }) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
      />
    </label>
  );
};

const TextArea = ({ label, helperText, ...props }) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <textarea
        {...props}
        rows={4}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
      />
      {helperText ? (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </label>
  );
};

const SwitchRow = ({ label, checked, onChange, helperText }) => {
  return (
    <div className="rounded-2xl border border-slate-200 px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-sm font-medium text-slate-800">{label}</span>
          {helperText ? (
            <p className="mt-1 text-xs text-slate-500">{helperText}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative h-7 w-14 rounded-full transition ${
            checked ? "bg-emerald-500" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
              checked ? "left-8" : "left-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
};

const StepHealthScreening = ({ value, onChange, onToggleWarningSign }) => {
  const warningOptions = [
    { label: "Đau ngực", value: "chest_pain" },
    { label: "Chóng mặt", value: "dizziness" },
    { label: "Khó thở bất thường", value: "shortness_of_breath" },
    { label: "Tê lan", value: "radiating_pain" },
    { label: "Mất thăng bằng", value: "balance_loss" },
  ];

  const [hasInjuries, setHasInjuries] = useState(false);
  const [hasCurrentConditions, setHasCurrentConditions] = useState(false);
  const [hasSurgeries, setHasSurgeries] = useState(false);
  const [takesMedications, setTakesMedications] = useState(false);
  const [hasDoctorRestrictions, setHasDoctorRestrictions] = useState(false);

  useEffect(() => {
    setHasInjuries(Boolean((value.injuries || "").trim()));
    setHasCurrentConditions(Boolean((value.currentConditions || "").trim()));
    setHasSurgeries(Boolean((value.surgeries || "").trim()));
    setTakesMedications(Boolean((value.medications || "").trim()));
    setHasDoctorRestrictions(Boolean((value.doctorRestrictions || "").trim()));
  }, [
    value.injuries,
    value.currentConditions,
    value.surgeries,
    value.medications,
    value.doctorRestrictions,
  ]);

  const handlePainToggle = (checked) => {
    onChange("hasPainNow", checked);

    if (!checked) {
      onChange("painLocation", "");
      onChange("painLevel", 0);
    }
  };

  const handleTextToggle = (field, setState) => (checked) => {
    setState(checked);

    if (!checked) {
      onChange(field, "");
    }
  };

  return (
    <div className="space-y-4">
      <SwitchRow
        label="Hiện tại có đau hoặc khó chịu không?"
        checked={value.hasPainNow}
        onChange={handlePainToggle}
        helperText="Nếu không có, hệ thống sẽ mặc định coi như không đau hiện tại."
      />

      {value.hasPainNow && (
        <div className="grid md:grid-cols-2 gap-4">
          <Field
            label="Vị trí đau / khó chịu"
            value={value.painLocation}
            onChange={(e) => onChange("painLocation", e.target.value)}
            placeholder="Ví dụ: gối trái, lưng dưới"
          />
          <Field
            label="Mức độ đau 0-10"
            type="number"
            min="0"
            max="10"
            value={value.painLevel}
            onChange={(e) => onChange("painLevel", e.target.value)}
          />
        </div>
      )}

      <SwitchRow
        label="Có chấn thương cần lưu ý không?"
        checked={hasInjuries}
        onChange={handleTextToggle("injuries", setHasInjuries)}
      />

      {hasInjuries && (
        <TextArea
          label="Chấn thương"
          value={value.injuries}
          onChange={(e) => onChange("injuries", e.target.value)}
          helperText="Ví dụ: rách sụn chêm, trật vai cũ, đau cổ tay..."
        />
      )}

      <SwitchRow
        label="Có bệnh lý hiện tại không?"
        checked={hasCurrentConditions}
        onChange={handleTextToggle(
          "currentConditions",
          setHasCurrentConditions,
        )}
        helperText="Nếu không có thì tắt nút này, không cần nhập chữ 'không'."
      />

      {hasCurrentConditions && (
        <TextArea
          label="Bệnh lý hiện tại"
          value={value.currentConditions}
          onChange={(e) => onChange("currentConditions", e.target.value)}
          helperText="Ví dụ: thoát vị đĩa đệm, tăng huyết áp, đau thần kinh tọa..."
        />
      )}

      <SwitchRow
        label="Đã từng phẫu thuật chưa?"
        checked={hasSurgeries}
        onChange={handleTextToggle("surgeries", setHasSurgeries)}
        helperText="Nếu chưa từng thì tắt nút này, không cần nhập chữ 'không'."
      />

      {hasSurgeries && (
        <TextArea
          label="Phẫu thuật từng có"
          value={value.surgeries}
          onChange={(e) => onChange("surgeries", e.target.value)}
          helperText="Ví dụ: mổ dây chằng chéo, mổ thoát vị, mổ vai..."
        />
      )}

      <SwitchRow
        label="Hiện tại có đang dùng thuốc không?"
        checked={takesMedications}
        onChange={handleTextToggle("medications", setTakesMedications)}
      />

      {takesMedications && (
        <TextArea
          label="Thuốc đang dùng"
          value={value.medications}
          onChange={(e) => onChange("medications", e.target.value)}
          helperText="Ví dụ: thuốc huyết áp, thuốc giảm đau, thuốc chống viêm..."
        />
      )}

      <SwitchRow
        label="Có hạn chế vận động do bác sĩ không?"
        checked={hasDoctorRestrictions}
        onChange={handleTextToggle(
          "doctorRestrictions",
          setHasDoctorRestrictions,
        )}
        helperText="Nếu có nội dung ở đây thì hệ thống có thể đưa khách vào HOLD TEST."
      />

      {hasDoctorRestrictions && (
        <TextArea
          label="Hạn chế vận động do bác sĩ"
          value={value.doctorRestrictions}
          onChange={(e) => onChange("doctorRestrictions", e.target.value)}
          helperText="Ví dụ: không squat sâu, tránh xoay cột sống, hạn chế tải nặng..."
        />
      )}

      <div>
        <p className="font-semibold text-slate-800 mb-3">Dấu hiệu cảnh báo</p>
        <div className="grid md:grid-cols-2 gap-3">
          {warningOptions.map((item) => (
            <label
              key={item.value}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3"
            >
              <input
                type="checkbox"
                checked={value.warningSigns.includes(item.value)}
                onChange={() => onToggleWarningSign(item.value)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StepHealthScreening;

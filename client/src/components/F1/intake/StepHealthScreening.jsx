import {
  Heart,
  AlertTriangle,
  Pill,
  Stethoscope,
  Activity,
  ShieldAlert,
} from "lucide-react";

const Field = ({ label, icon: Icon, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-amber-500" />}
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
    </label>
  );
};

const TextArea = ({ label, helperText, icon: Icon, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-amber-500" />}
        {label}
      </span>
      <textarea
        {...props}
        rows={4}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
      {helperText && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
    </label>
  );
};

const SwitchRow = ({ label, checked, onChange, helperText, icon: Icon }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon && <Icon size={18} className="mt-0.5 text-amber-500" />}
          <div>
            <span className="text-sm font-bold text-slate-800">{label}</span>
            {helperText && (
              <p className="mt-1 text-xs text-slate-500">{helperText}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative h-7 w-14 shrink-0 rounded-full transition ${
            checked ? "bg-amber-500" : "bg-slate-300"
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

  // Derived booleans – computed directly from props, no local state needed
  const hasInjuries = Boolean((value.injuries || "").trim());
  const hasCurrentConditions = Boolean((value.currentConditions || "").trim());
  const hasSurgeries = Boolean((value.surgeries || "").trim());
  const takesMedications = Boolean((value.medications || "").trim());
  const hasDoctorRestrictions = Boolean(
    (value.doctorRestrictions || "").trim(),
  );

  const handlePainToggle = (checked) => {
    onChange("hasPainNow", checked);
    if (!checked) {
      onChange("painLocation", "");
      onChange("painLevel", 0);
    }
  };

  const handleTextToggle = (field) => (checked) => {
    if (!checked) onChange(field, "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3">
        <Heart size={20} className="text-amber-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">Sức khỏe</h3>
          <p className="text-sm text-slate-500">
            Thu thập thông tin về tình trạng sức khỏe hiện tại.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <SwitchRow
          label="Hiện tại có đau hoặc khó chịu không?"
          icon={AlertTriangle}
          checked={value.hasPainNow}
          onChange={handlePainToggle}
          helperText="Nếu không có, hệ thống sẽ mặc định coi như không đau hiện tại."
        />

        {value.hasPainNow && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Vị trí đau / khó chịu"
              icon={Activity}
              value={value.painLocation}
              onChange={(e) => onChange("painLocation", e.target.value)}
              placeholder="Ví dụ: gối trái, lưng dưới"
            />
            <Field
              label="Mức độ đau 0-10"
              icon={AlertTriangle}
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
          icon={Activity}
          checked={hasInjuries}
          onChange={handleTextToggle("injuries")}
        />
        {hasInjuries && (
          <TextArea
            label="Chấn thương"
            icon={Activity}
            value={value.injuries}
            onChange={(e) => onChange("injuries", e.target.value)}
            helperText="Ví dụ: rách sụn chêm, trật vai cũ, đau cổ tay..."
          />
        )}

        <SwitchRow
          label="Có bệnh lý hiện tại không?"
          icon={Stethoscope}
          checked={hasCurrentConditions}
          onChange={handleTextToggle("currentConditions")}
          helperText="Nếu không có thì tắt nút này, không cần nhập chữ 'không'."
        />
        {hasCurrentConditions && (
          <TextArea
            label="Bệnh lý hiện tại"
            icon={Stethoscope}
            value={value.currentConditions}
            onChange={(e) => onChange("currentConditions", e.target.value)}
            helperText="Ví dụ: thoát vị đĩa đệm, tăng huyết áp, đau thần kinh tọa..."
          />
        )}

        <SwitchRow
          label="Đã từng phẫu thuật chưa?"
          icon={Activity}
          checked={hasSurgeries}
          onChange={handleTextToggle("surgeries")}
          helperText="Nếu chưa từng thì tắt nút này, không cần nhập chữ 'không'."
        />
        {hasSurgeries && (
          <TextArea
            label="Phẫu thuật từng có"
            icon={Activity}
            value={value.surgeries}
            onChange={(e) => onChange("surgeries", e.target.value)}
            helperText="Ví dụ: mổ dây chằng chéo, mổ thoát vị, mổ vai..."
          />
        )}

        <SwitchRow
          label="Hiện tại có đang dùng thuốc không?"
          icon={Pill}
          checked={takesMedications}
          onChange={handleTextToggle("medications")}
        />
        {takesMedications && (
          <TextArea
            label="Thuốc đang dùng"
            icon={Pill}
            value={value.medications}
            onChange={(e) => onChange("medications", e.target.value)}
            helperText="Ví dụ: thuốc huyết áp, thuốc giảm đau, thuốc chống viêm..."
          />
        )}

        <SwitchRow
          label="Có hạn chế vận động do bác sĩ không?"
          icon={ShieldAlert}
          checked={hasDoctorRestrictions}
          onChange={handleTextToggle("doctorRestrictions")}
          helperText="Nếu có nội dung ở đây thì hệ thống có thể đưa khách vào HOLD TEST."
        />
        {hasDoctorRestrictions && (
          <TextArea
            label="Hạn chế vận động do bác sĩ"
            icon={ShieldAlert}
            value={value.doctorRestrictions}
            onChange={(e) => onChange("doctorRestrictions", e.target.value)}
            helperText="Ví dụ: không squat sâu, tránh xoay cột sống, hạn chế tải nặng..."
          />
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <AlertTriangle size={18} className="text-amber-500" />
            <p className="font-bold text-slate-800">Dấu hiệu cảnh báo</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {warningOptions.map((item) => (
              <label
                key={item.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3 transition hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={value.warningSigns.includes(item.value)}
                  onChange={() => onToggleWarningSign(item.value)}
                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm text-slate-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepHealthScreening;

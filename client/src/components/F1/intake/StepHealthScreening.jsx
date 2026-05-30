// StepHealthScreening.jsx
import {
  Heart,
  AlertTriangle,
  Pill,
  Stethoscope,
  Activity,
  ShieldAlert,
} from "lucide-react";

const Field = ({ label, icon: Icon, error, registration, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-orange-500" />}
        {label}
      </span>
      <input
        {...registration}
        {...props}
        className={`w-full rounded-lg border bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:ring-2 ${
          error
            ? "border-red-400 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
    </label>
  );
};

const TextArea = ({ label, helperText, icon: Icon, error, registration, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-orange-500" />}
        {label}
      </span>
      <textarea
        {...registration}
        {...props}
        rows={4}
        className={`w-full rounded-lg border bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:ring-2 ${
          error
            ? "border-red-400 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
        }`}
      />
      {helperText && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
    </label>
  );
};

const SwitchRow = ({ label, checked, onChange, helperText, icon: Icon }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon && <Icon size={18} className="mt-0.5 text-orange-500" />}
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
            checked ? "bg-orange-500" : "bg-slate-300"
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

const StepHealthScreening = ({ register, watch, setValue, errors }) => {
  const warningOptions = [
    { label: "Đau ngực", value: "chest_pain" },
    { label: "Chóng mặt", value: "dizziness" },
    { label: "Khó thở bất thường", value: "shortness_of_breath" },
    { label: "Tê lan", value: "radiating_pain" },
    { label: "Mất thăng bằng", value: "balance_loss" },
  ];

  const hasPainNow = watch("healthScreening.hasPainNow");
  const injuries = watch("healthScreening.injuries");
  const currentConditions = watch("healthScreening.currentConditions");
  const surgeries = watch("healthScreening.surgeries");
  const medications = watch("healthScreening.medications");
  const doctorRestrictions = watch("healthScreening.doctorRestrictions");
  const warningSigns = watch("healthScreening.warningSigns") || [];

  const hasInjuries = Boolean((injuries || "").trim());
  const hasCurrentConditions = Boolean((currentConditions || "").trim());
  const hasSurgeries = Boolean((surgeries || "").trim());
  const takesMedications = Boolean((medications || "").trim());
  const hasDoctorRestrictions = Boolean((doctorRestrictions || "").trim());

  const handlePainToggle = (checked) => {
    setValue("healthScreening.hasPainNow", checked, { shouldValidate: true });
    if (!checked) {
      setValue("healthScreening.painLocation", "");
      setValue("healthScreening.painLevel", 0);
    }
  };

  const handleTextToggle = (field) => (checked) => {
    if (!checked) setValue(`healthScreening.${field}`, "");
  };

  const handleWarningToggle = (value) => {
    const newWarnings = warningSigns.includes(value)
      ? warningSigns.filter((v) => v !== value)
      : [...warningSigns, value];
    setValue("healthScreening.warningSigns", newWarnings, { shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-3">
        <Heart size={20} className="text-orange-600" />
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
          checked={hasPainNow}
          onChange={handlePainToggle}
          helperText="Nếu không có, hệ thống sẽ mặc định coi như không đau hiện tại."
        />

        {hasPainNow && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Vị trí đau / khó chịu"
              icon={Activity}
              registration={register("healthScreening.painLocation")}
              error={errors?.healthScreening?.painLocation}
              placeholder="Ví dụ: gối trái, lưng dưới"
            />
            <Field
              label="Mức độ đau 0-10"
              icon={AlertTriangle}
              type="number"
              min="0"
              max="10"
              registration={register("healthScreening.painLevel")}
              error={errors?.healthScreening?.painLevel}
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
            registration={register("healthScreening.injuries")}
            error={errors?.healthScreening?.injuries}
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
            registration={register("healthScreening.currentConditions")}
            error={errors?.healthScreening?.currentConditions}
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
            registration={register("healthScreening.surgeries")}
            error={errors?.healthScreening?.surgeries}
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
            registration={register("healthScreening.medications")}
            error={errors?.healthScreening?.medications}
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
            registration={register("healthScreening.doctorRestrictions")}
            error={errors?.healthScreening?.doctorRestrictions}
            helperText="Ví dụ: không squat sâu, tránh xoay cột sống, hạn chế tải nặng..."
          />
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <AlertTriangle size={18} className="text-orange-500" />
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
                  checked={warningSigns.includes(item.value)}
                  onChange={() => handleWarningToggle(item.value)}
                  className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
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

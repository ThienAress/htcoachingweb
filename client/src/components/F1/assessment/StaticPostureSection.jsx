// StaticPostureSection.jsx
import { User, Bone } from "lucide-react";

const postureOptionGroups = {
  feetAnkles: [
    { label: "Bình thường", value: "normal" },
    { label: "Bàn chân bẹt", value: "pes_planus" },
    { label: "Bàn chân xoay ra ngoài", value: "feet_turn_out" },
    { label: "Gót chân nhấc lên nhẹ", value: "mild_heel_rise" },
  ],
  knees: [
    { label: "Bình thường", value: "normal" },
    { label: "Gối xoay vào trong", value: "knee_valgus" },
    { label: "Gối đẩy ra ngoài", value: "knee_varus" },
    { label: "Ưỡn gối quá mức", value: "knee_hyperextension" },
  ],
  shouldersThoracic: [
    { label: "Bình thường", value: "normal" },
    { label: "Vai tròn / Cuộn vai ra trước", value: "rounded_shoulders" },
    { label: "Vai nhô cao", value: "elevated_shoulders" },
    { label: "Lưng gù", value: "thoracic_kyphosis" },
    { label: "Vai lệch không đều", value: "asymmetrical_shoulders" },
  ],
  headNeck: [
    { label: "Bình thường", value: "normal" },
    { label: "Đầu đưa ra trước", value: "forward_head_posture" },
    { label: "Đầu nghiêng hoặc xoay", value: "head_tilt_rotation" },
  ],
  lphc: [
    { label: "Bình thường", value: "normal" },
    { label: "Nghiêng khung chậu ra trước", value: "anterior_pelvic_tilt" },
    { label: "Nghiêng khung chậu ra sau", value: "posterior_pelvic_tilt" },
    { label: "Hông không cân bằng", value: "pelvic_tilt_rotation" },
  ],
};

const SelectField = ({ label, value, onChange, options = [] }) => {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      >
        <option value="">Chọn kết quả</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
};

const StaticPostureSection = ({ value, onChange }) => {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3">
        <User size={20} className="text-amber-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">
            Đánh giá tư thế tĩnh
          </h3>
          <p className="text-sm text-slate-500">
            Đánh giá tư thế tĩnh nền trước khi xem chuyển động.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <SelectField
          label="Bàn chân / Cổ chân"
          value={value.feetAnkles}
          onChange={(next) => onChange("feetAnkles", next)}
          options={postureOptionGroups.feetAnkles}
        />

        <SelectField
          label="Đầu gối"
          value={value.knees}
          onChange={(next) => onChange("knees", next)}
          options={postureOptionGroups.knees}
        />

        <SelectField
          label="LPHC (Hông - Chậu - Thắt lưng)"
          value={value.lphc}
          onChange={(next) => onChange("lphc", next)}
          options={postureOptionGroups.lphc}
        />

        <SelectField
          label="Vai / Cột sống ngực"
          value={value.shouldersThoracic}
          onChange={(next) => onChange("shouldersThoracic", next)}
          options={postureOptionGroups.shouldersThoracic}
        />

        <div className="md:col-span-2">
          <SelectField
            label="Đầu / Cổ"
            value={value.headNeck}
            onChange={(next) => onChange("headNeck", next)}
            options={postureOptionGroups.headNeck}
          />
        </div>
      </div>
    </div>
  );
};

export default StaticPostureSection;

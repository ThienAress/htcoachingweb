// OverheadSquatSection.jsx
import { Eye, Move, Target } from "lucide-react";

const ohsaOptionGroups = {
  anterior: {
    title: "Góc nhìn mặt trước",
    helper:
      "Ở góc nhìn này, mắt bạn sẽ tập trung chủ yếu vào phần thân dưới: Bàn chân/Cổ chân và Đầu gối.",
    options: [
      { label: "Bàn chân xoay ra ngoài", value: "feet_turn_out" },
      { label: "Gối chụm vào trong", value: "knees_move_inward" },
      { label: "Gối đẩy ra ngoài", value: "knees_move_outward" },
    ],
  },
  lateral: {
    title: "Góc nhìn mặt bên",
    helper:
      "Đây là góc nhìn cung cấp nhiều thông tin nhất. Bạn sẽ tập trung vào sự thẳng hàng của Phức hợp Hông-Chậu-Thắt lưng (LPHC), Vai và Đầu/Cổ.",
    options: [
      { label: "Đổ người về trước quá mức", value: "excessive_forward_lean" },
      { label: "Võng thắt lưng", value: "low_back_arch" },
      { label: "Tròn / Cụp lưng dưới", value: "low_back_round" },
      { label: "Tay rớt về phía trước", value: "arms_fall_forward" },
    ],
  },
  posterior: {
    title: "Góc nhìn mặt sau",
    helper:
      "Ở góc này, bạn sẽ kiểm tra lại phần Bàn chân/Cổ chân từ phía sau và xem sự cân bằng của Hông (LPHC).",
    options: [
      { label: "Gót chân nhấc lên", value: "heel_rise" },
      { label: "Bàn chân bẹt / Sập vòm", value: "pes_planus" },
      { label: "Hông lệch bấp bênh", value: "pelvic_shift" },
    ],
  },
};

const CheckboxGroup = ({
  title,
  helper,
  values = [],
  options = [],
  onToggle,
}) => {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div className="flex items-center gap-2">
          <Eye size={18} className="text-amber-600" />
          <h4 className="font-bold text-slate-800">{title}</h4>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm text-slate-500">{helper}</p>
        <div className="mt-4 space-y-2">
          {options.map((item) => (
            <label
              key={item.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3 transition hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={values.includes(item.value)}
                onChange={() => onToggle(item.value)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-slate-700">{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

const OverheadSquatSection = ({ value, onToggle }) => {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3">
        <Move size={20} className="text-amber-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">
            Đánh giá squat tay qua đầu
          </h3>
          <p className="text-sm text-slate-500">
            Chọn các biểu hiện quan sát được theo từng góc nhìn.
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <CheckboxGroup
          title={ohsaOptionGroups.anterior.title}
          helper={ohsaOptionGroups.anterior.helper}
          values={value.anterior}
          options={ohsaOptionGroups.anterior.options}
          onToggle={(item) => onToggle("anterior", item)}
        />
        <CheckboxGroup
          title={ohsaOptionGroups.lateral.title}
          helper={ohsaOptionGroups.lateral.helper}
          values={value.lateral}
          options={ohsaOptionGroups.lateral.options}
          onToggle={(item) => onToggle("lateral", item)}
        />
        <CheckboxGroup
          title={ohsaOptionGroups.posterior.title}
          helper={ohsaOptionGroups.posterior.helper}
          values={value.posterior}
          options={ohsaOptionGroups.posterior.options}
          onToggle={(item) => onToggle("posterior", item)}
        />
      </div>
    </div>
  );
};

export default OverheadSquatSection;

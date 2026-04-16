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
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="font-semibold text-slate-800">{title}</h4>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>

      <div className="mt-4 grid gap-3">
        {options.map((item) => (
          <label
            key={item.value}
            className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={values.includes(item.value)}
              onChange={() => onToggle(item.value)}
            />
            <span className="text-sm text-slate-700">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

const OverheadSquatSection = ({ value, onToggle }) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Đánh giá squat tay qua đầu
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Chọn các biểu hiện quan sát được theo từng góc nhìn.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
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

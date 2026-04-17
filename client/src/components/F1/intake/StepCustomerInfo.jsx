// StepCustomerInfo.jsx
import {
  User,
  Calendar,
  Briefcase,
  Phone,
  Mail,
  VenetianMask,
} from "lucide-react";

const Field = ({ label, required, icon: Icon, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-amber-500" />}
        {label} {required && <span className="text-amber-500">*</span>}
      </span>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
    </label>
  );
};

const SelectField = ({ label, options = [], icon: Icon, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-amber-500" />}
        {label}
      </span>
      <select
        {...props}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
};

const StepCustomerInfo = ({ value, onChange }) => {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3">
        <User size={20} className="text-amber-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">
            Thông tin khách hàng
          </h3>
          <p className="text-sm text-slate-500">
            Nhập thông tin cơ bản của khách hàng.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Họ và tên"
          icon={User}
          value={value.fullName}
          onChange={(e) => onChange("fullName", e.target.value)}
          required
          placeholder="Nguyễn Văn A"
        />
        <Field
          label="Tuổi"
          icon={Calendar}
          type="number"
          value={value.age}
          onChange={(e) => onChange("age", e.target.value)}
          required
          placeholder="25"
        />
        <SelectField
          label="Giới tính"
          icon={VenetianMask}
          value={value.gender}
          onChange={(e) => onChange("gender", e.target.value)}
          options={[
            { label: "Chọn giới tính", value: "" },
            { label: "Nam", value: "male" },
            { label: "Nữ", value: "female" },
            { label: "Khác", value: "other" },
          ]}
        />
        <Field
          label="Nghề nghiệp"
          icon={Briefcase}
          value={value.occupation}
          onChange={(e) => onChange("occupation", e.target.value)}
          placeholder="Nhân viên văn phòng"
        />
        <Field
          label="Số điện thoại"
          icon={Phone}
          value={value.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          placeholder="0912345678"
        />
        <Field
          label="Email"
          icon={Mail}
          type="email"
          value={value.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="example@gmail.com"
        />
      </div>
    </div>
  );
};

export default StepCustomerInfo;

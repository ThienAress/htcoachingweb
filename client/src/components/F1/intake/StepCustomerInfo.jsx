// StepCustomerInfo.jsx
import {
  User,
  Calendar,
  Briefcase,
  Phone,
  Mail,
  VenetianMask,
} from "lucide-react";

const Field = ({ label, required, icon: Icon, error, registration, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-orange-500" />}
        {label} {required && <span className="text-orange-500">*</span>}
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

const SelectField = ({ label, options = [], icon: Icon, error, registration, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-orange-500" />}
        {label}
      </span>
      <select
        {...registration}
        {...props}
        className={`w-full rounded-lg border bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:ring-2 ${
          error
            ? "border-red-400 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
        }`}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
    </label>
  );
};

const StepCustomerInfo = ({ register, errors }) => {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-3">
        <User size={20} className="text-orange-600" />
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
          registration={register("customerInfo.fullName")}
          error={errors?.customerInfo?.fullName}
          required
          placeholder="Nguyễn Văn A"
        />
        <Field
          label="Tuổi"
          icon={Calendar}
          type="number"
          registration={register("customerInfo.age")}
          error={errors?.customerInfo?.age}
          required
          placeholder="25"
        />
        <SelectField
          label="Giới tính"
          icon={VenetianMask}
          registration={register("customerInfo.gender")}
          error={errors?.customerInfo?.gender}
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
          registration={register("customerInfo.occupation")}
          error={errors?.customerInfo?.occupation}
          placeholder="Nhân viên văn phòng"
        />
        <Field
          label="Số điện thoại"
          icon={Phone}
          registration={register("customerInfo.phone")}
          error={errors?.customerInfo?.phone}
          placeholder="0912345678"
        />
        <Field
          label="Email"
          icon={Mail}
          type="email"
          registration={register("customerInfo.email")}
          error={errors?.customerInfo?.email}
          placeholder="example@gmail.com"
        />
      </div>
    </div>
  );
};

export default StepCustomerInfo;

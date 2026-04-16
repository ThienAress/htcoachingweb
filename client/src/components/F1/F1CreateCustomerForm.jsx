import { useState } from "react";
import { ArrowLeft } from "lucide-react";

const Input = ({ label, required, error, ...props }) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>

      <input
        {...props}
        className={`w-full rounded-xl border px-4 py-3 outline-none ${
          error
            ? "border-red-400 focus:border-red-500"
            : "border-slate-200 focus:border-slate-400"
        }`}
      />

      {error ? <p className="mt-1 text-sm text-red-500">{error}</p> : null}
    </label>
  );
};

const Select = ({ label, options = [], required, error, ...props }) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>

      <select
        {...props}
        className={`w-full rounded-xl border px-4 py-3 outline-none ${
          error
            ? "border-red-400 focus:border-red-500"
            : "border-slate-200 focus:border-slate-400"
        }`}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      {error ? <p className="mt-1 text-sm text-red-500">{error}</p> : null}
    </label>
  );
};

const normalizeSpaces = (value = "") => value.trim().replace(/\s+/g, " ");

const validateCreateCustomerForm = (form) => {
  const errors = {};

  const fullName = normalizeSpaces(form.fullName);
  const age = String(form.age || "").trim();
  const gender = String(form.gender || "").trim();
  const occupation = normalizeSpaces(form.occupation);
  const phone = String(form.phone || "").trim();
  const email = String(form.email || "")
    .trim()
    .toLowerCase();

  if (!fullName) {
    errors.fullName = "Vui lòng nhập họ và tên";
  } else if (fullName.length < 8) {
    errors.fullName = "Họ và tên phải có ít nhất 8 ký tự";
  } else if (fullName.length > 20) {
    errors.fullName = "Họ và tên tối đa 20 ký tự";
  }

  if (!age) {
    errors.age = "Vui lòng nhập tuổi";
  } else if (!/^\d+$/.test(age)) {
    errors.age = "Tuổi chỉ được nhập số";
  } else {
    const ageNumber = Number(age);
    if (ageNumber < 1 || ageNumber > 100) {
      errors.age = "Tuổi phải từ 1 đến 100";
    }
  }

  if (!gender) {
    errors.gender = "Vui lòng chọn giới tính";
  }

  if (!occupation) {
    errors.occupation = "Vui lòng nhập nghề nghiệp";
  } else if (occupation.length > 20) {
    errors.occupation = "Nghề nghiệp tối đa 20 ký tự";
  }

  if (!phone) {
    errors.phone = "Vui lòng nhập số điện thoại";
  } else if (!/^\d+$/.test(phone)) {
    errors.phone = "Số điện thoại chỉ được nhập số";
  } else if (phone.length !== 10) {
    errors.phone = "Số điện thoại phải đúng 10 số";
  }

  if (!email) {
    errors.email = "Vui lòng nhập gmail";
  } else if (!email.endsWith("@gmail.com")) {
    errors.email = "Email phải có đuôi @gmail.com";
  }

  return errors;
};

const F1CreateCustomerForm = ({
  createForm,
  setCreateForm,
  submittingCreate,
  onBack,
  onSubmit,
}) => {
  const [errors, setErrors] = useState({});

  const updateField = (field, value) => {
    setCreateForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const nextErrors = validateCreateCustomerForm(createForm);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    onSubmit(e);
  };

  return (
    <section className="max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        Quay lại danh sách
      </button>

      <div className="rounded-3xl bg-white p-6 md:p-8 shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900">Tạo khách hàng F1</h2>
        <p className="text-slate-500 mt-2">
          Tạo hồ sơ gốc trước, sau đó hệ thống sẽ chuyển thẳng sang đánh giá
          thông tin.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 grid md:grid-cols-2 gap-4"
        >
          <Input
            label="Họ và tên"
            value={createForm.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            required
            maxLength={20}
            error={errors.fullName}
          />

          <Input
            label="Tuổi"
            type="text"
            inputMode="numeric"
            value={createForm.age}
            onChange={(e) =>
              updateField("age", e.target.value.replace(/\D/g, ""))
            }
            required
            error={errors.age}
          />

          <Select
            label="Giới tính"
            value={createForm.gender}
            onChange={(e) => updateField("gender", e.target.value)}
            options={[
              { label: "Chọn giới tính", value: "" },
              { label: "Nam", value: "male" },
              { label: "Nữ", value: "female" },
              { label: "Khác", value: "other" },
            ]}
            required
            error={errors.gender}
          />

          <Input
            label="Nghề nghiệp"
            value={createForm.occupation}
            onChange={(e) => updateField("occupation", e.target.value)}
            required
            maxLength={20}
            error={errors.occupation}
          />

          <Input
            label="Số điện thoại"
            type="text"
            inputMode="numeric"
            value={createForm.phone}
            onChange={(e) =>
              updateField(
                "phone",
                e.target.value.replace(/\D/g, "").slice(0, 10),
              )
            }
            required
            maxLength={10}
            error={errors.phone}
          />

          <Input
            label="Gmail"
            type="email"
            value={createForm.email}
            onChange={(e) => updateField("email", e.target.value.trim())}
            required
            error={errors.email}
          />

          <div className="md:col-span-2 flex gap-3 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={submittingCreate}
              className="rounded-xl bg-[#1C2D42] px-5 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {submittingCreate
                ? "Đang tạo khách hàng..."
                : "Tạo khách hàng và vào đánh giá thông tin"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default F1CreateCustomerForm;

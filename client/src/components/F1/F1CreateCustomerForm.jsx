// F1CreateCustomerForm.jsx
import { useEffect, useState } from "react";
import { X, UserPlus, Shield, Sparkles } from "lucide-react";
import { useModalScrollLock } from "../../hooks/useModalScrollLock";
import RoundedSelect from "./assessment/RoundedSelect";
import ConversionOriginFields from "../admin/ConversionOriginFields";

const Input = ({ label, required, error, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label} {required && <span className="text-orange-500">*</span>}
      </span>
      <input
        {...props}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-slate-800 outline-none transition-all duration-200 focus:ring-2 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-100"
            : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
        }`}
      />
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
    </label>
  );
};

const Select = ({ label, options = [], required, error, value, onChange }) => (
  <div className="block">
    <span className="mb-1.5 block text-sm font-semibold text-slate-800">
      {label} {required && <span className="text-orange-500">*</span>}
    </span>
    <RoundedSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={options[0]?.label}
    />
    {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
  </div>
);

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

  if (form.originType && !form.originId) {
    errors.originId = "Vui lòng chọn đúng bản ghi nguồn";
  }

  return errors;
};

const F1CreateCustomerForm = ({
  createForm,
  setCreateForm,
  submittingCreate,
  canSelectOrigin,
  conversionOrigins,
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

  useModalScrollLock(true);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !submittingCreate) onBack?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack, submittingCreate]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-3 md:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submittingCreate) onBack?.();
      }}
    >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="f1-create-title"
      className="mx-auto w-full max-w-4xl"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-orange-100 p-2 text-orange-600">
              <UserPlus size={22} />
            </div>
            <div>
              <h2 id="f1-create-title" className="text-2xl font-extrabold tracking-tight text-slate-800 uppercase">
                Tạo khách hàng F1
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Tạo hồ sơ gốc trước, sau đó hệ thống sẽ chuyển thẳng sang đánh
                giá thông tin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            disabled={submittingCreate}
            aria-label="Đóng"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-8 md:px-8">
          <div className="grid gap-5 md:grid-cols-2">
            <Input autoComplete="off"
              name="fullName"
              label="Họ và tên"
              value={createForm.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              required
              maxLength={20}
              error={errors.fullName}
            />

            <Input
              name="age"
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
              name="gender"
              label="Giới tính"
              value={createForm.gender}
              onChange={(value) => updateField("gender", value)}
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
              name="occupation"
              label="Nghề nghiệp"
              value={createForm.occupation}
              onChange={(e) => updateField("occupation", e.target.value)}
              required
              maxLength={20}
              error={errors.occupation}
            />

            <Input autoComplete="off"
              name="phone"
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

            <Input autoComplete="off"
              name="email"
              label="Gmail"
              type="email"
              value={createForm.email}
              onChange={(e) => updateField("email", e.target.value.trim())}
              required
              error={errors.email}
            />
          </div>

          {canSelectOrigin && (
            <ConversionOriginFields
              originType={createForm.originType}
              originId={createForm.originId}
              onTypeChange={(value) => updateField("originType", value)}
              onIdChange={(value) => updateField("originId", value)}
              bookings={conversionOrigins.bookings}
              contacts={conversionOrigins.contacts}
              isLoading={conversionOrigins.isLoading}
              isError={conversionOrigins.isError}
              onRetry={conversionOrigins.retry}
              error={errors.originId}
            />
          )}

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
            >
              Hủy
            </button>

            <button
              data-testid="f1-create-submit"
              type="submit"
              disabled={submittingCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-3 font-bold text-white shadow-md transition-all hover:shadow-lg hover:brightness-105 disabled:opacity-60"
            >
              {submittingCreate ? (
                <>
                  <Sparkles size={18} className="animate-pulse" />
                  Đang tạo khách hàng...
                </>
              ) : (
                <>
                  <Shield size={18} />
                  Tạo khách hàng và vào đánh giá thông tin
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
    </div>
  );
};

export default F1CreateCustomerForm;

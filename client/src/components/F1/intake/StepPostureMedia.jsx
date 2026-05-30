// StepPostureMedia.jsx
import { useEffect, useMemo } from "react";
import { ImagePlus, X, Camera, Shield, Brain, Info } from "lucide-react";

const FilePreview = ({ file }) => {
  const previewUrl = useMemo(() => {
    if (!file) return "";
    // If it's already an uploaded URL
    if (typeof file === "string") return file;
    // If it's a File object
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (file && typeof file !== "string" && previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, file]);

  if (!file) {
    return (
      <div className="mt-3 flex h-[320px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        <div className="text-center">
          <Camera size={32} className="mx-auto mb-2 text-slate-300" />
          Chưa có ảnh xem trước
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="flex h-[320px] items-center justify-center overflow-hidden rounded-lg bg-white">
        <img
          src={previewUrl}
          alt={typeof file === "string" ? "Uploaded media" : file.name}
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  );
};

const FileField = ({ label, file, onChange }) => {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-orange-500" />
            <p className="font-bold text-slate-800">{label}</p>
          </div>
          {file && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <X size={14} />
              Xóa
            </button>
          )}
        </div>
      </div>
      <div className="p-5">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-orange-200 bg-orange-50/30 px-4 py-4 text-sm font-medium text-orange-700 transition hover:bg-orange-50">
          <ImagePlus size={16} />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
          />
          Chọn ảnh
        </label>
        <p className="mt-3 text-xs text-slate-500 break-all">
          {file ? (typeof file === "string" ? "Đã tải lên" : file.name) : "Chưa chọn file"}
        </p>
        <FilePreview file={file} />
      </div>
    </div>
  );
};

const SwitchRow = ({ label, checked, onChange, icon: Icon, helperText }) => {
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

const StepPostureMedia = ({
  watch,
  setValue,
}) => {
  const frontImage = watch("postureMedia.frontImage");
  const backImage = watch("postureMedia.backImage");
  const sideImage = watch("postureMedia.sideImage");

  const allowDataStorage = watch("consent.allowDataStorage");
  const allowMediaStorage = watch("consent.allowMediaStorage");
  const allowAiAnalysis = watch("consent.allowAiAnalysis");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-3">
        <Camera size={20} className="text-orange-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">
            Ảnh posture & before
          </h3>
          <p className="text-sm text-slate-500">
            Bước này dùng để lưu ảnh posture/before cho giai đoạn assessment.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 text-orange-600" />
          <p className="text-sm text-orange-800">
            Preview đã được chỉnh để nhìn rõ full body hơn, tránh crop ảnh.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3 md:grid-cols-2">
        <FileField
          label="Ảnh mặt trước"
          file={frontImage}
          onChange={(file) => setValue("postureMedia.frontImage", file)}
        />
        <FileField
          label="Ảnh mặt sau"
          file={backImage}
          onChange={(file) => setValue("postureMedia.backImage", file)}
        />
        <FileField
          label="Ảnh mặt bên"
          file={sideImage}
          onChange={(file) => setValue("postureMedia.sideImage", file)}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-3">
          <Shield size={20} className="text-orange-600" />
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              Đồng ý & Bảo mật
            </h3>
            <p className="text-sm text-slate-500">
              Xác nhận quyền lưu trữ và sử dụng dữ liệu.
            </p>
          </div>
        </div>

        <SwitchRow
          label="Đồng ý lưu dữ liệu"
          icon={Shield}
          checked={allowDataStorage}
          onChange={(checked) => setValue("consent.allowDataStorage", checked, { shouldValidate: true })}
          helperText="Dữ liệu khách hàng sẽ được lưu trữ an toàn trong hệ thống."
        />
        <SwitchRow
          label="Đồng ý lưu ảnh/video"
          icon={Camera}
          checked={allowMediaStorage}
          onChange={(checked) => setValue("consent.allowMediaStorage", checked, { shouldValidate: true })}
          helperText="Ảnh posture sẽ được lưu để theo dõi tiến trình."
        />
        <SwitchRow
          label="Đồng ý AI hỗ trợ phân tích"
          icon={Brain}
          checked={allowAiAnalysis}
          onChange={(checked) => setValue("consent.allowAiAnalysis", checked, { shouldValidate: true })}
          helperText="AI sẽ phân tích dữ liệu để đưa ra gợi ý chính xác hơn."
        />
      </div>
    </div>
  );
};

export default StepPostureMedia;

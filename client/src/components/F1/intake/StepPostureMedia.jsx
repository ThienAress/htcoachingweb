import { useEffect, useMemo } from "react";
import { ImagePlus, X } from "lucide-react";

const FilePreview = ({ file }) => {
  const previewUrl = useMemo(() => {
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!file) {
    return (
      <div className="mt-3 flex h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        Chưa có ảnh xem trước
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex h-[420px] items-center justify-center overflow-hidden rounded-xl bg-white">
        <img
          src={previewUrl}
          alt={file.name}
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  );
};

const FileField = ({ label, file, onChange }) => {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 bg-white">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">{label}</p>

        {file ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <X size={14} />
            Xóa
          </button>
        ) : null}
      </div>

      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 hover:bg-slate-50">
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
        {file ? file.name : "Chưa chọn file"}
      </p>

      <FilePreview file={file} />
    </div>
  );
};

const SwitchRow = ({ label, checked, onChange }) => {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-14 rounded-full transition ${
          checked ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-8" : "left-1"
          }`}
        />
      </button>
    </div>
  );
};

const StepPostureMedia = ({
  value,
  consent,
  onMediaChange,
  onConsentChange,
}) => {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-900">
          Bước này dùng để lưu ảnh posture/before cho giai đoạn assessment.
          Preview đã được chỉnh để nhìn rõ full body hơn, tránh crop ảnh.
        </p>
      </div>

      <div className="grid xl:grid-cols-3 md:grid-cols-2 gap-4">
        <FileField
          label="Ảnh mặt trước"
          file={value.frontImage}
          onChange={(file) => onMediaChange("frontImage", file)}
        />
        <FileField
          label="Ảnh mặt sau"
          file={value.backImage}
          onChange={(file) => onMediaChange("backImage", file)}
        />
        <FileField
          label="Ảnh mặt bên"
          file={value.sideImage}
          onChange={(file) => onMediaChange("sideImage", file)}
        />
      </div>

      <SwitchRow
        label="Đồng ý lưu dữ liệu"
        checked={consent.allowDataStorage}
        onChange={(checked) => onConsentChange("allowDataStorage", checked)}
      />
      <SwitchRow
        label="Đồng ý lưu ảnh/video"
        checked={consent.allowMediaStorage}
        onChange={(checked) => onConsentChange("allowMediaStorage", checked)}
      />
      <SwitchRow
        label="Đồng ý AI hỗ trợ phân tích"
        checked={consent.allowAiAnalysis}
        onChange={(checked) => onConsentChange("allowAiAnalysis", checked)}
      />
    </div>
  );
};

export default StepPostureMedia;

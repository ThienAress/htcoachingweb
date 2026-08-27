import { useRef, useCallback, useState } from "react";
import SignaturePad from "react-signature-canvas";
import { ImageUp, RotateCcw } from "lucide-react";
import {
  normalizeSignatureSourceFile,
  SIGNATURE_SOURCE_ACCEPT,
} from "./signatureImage";

const SignatureCanvas = ({
  onSignatureChange,
  disabled = false,
  label = "Khu vực vẽ chữ ký",
  allowImageUpload = false,
  previewValue = "",
  onProcessingChange,
}) => {
  const sigRef = useRef(null);
  const fileRef = useRef(null);
  const uploadRequestRef = useRef(0);
  const [uploadError, setUploadError] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const interactionDisabled = disabled || isProcessingImage;

  const setProcessing = useCallback(
    (processing) => {
      setIsProcessingImage(processing);
      onProcessingChange?.(processing);
    },
    [onProcessingChange],
  );

  const handleEnd = useCallback(() => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      const dataUrl = sigRef.current.toDataURL("image/png");
      setUploadError("");
      onSignatureChange(dataUrl);
    }
  }, [onSignatureChange]);

  const handleClear = useCallback(() => {
    if (sigRef.current) {
      sigRef.current.clear();
      if (fileRef.current) fileRef.current.value = "";
      setUploadError("");
      onSignatureChange("");
    }
  }, [onSignatureChange]);

  const handleImageUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const requestId = uploadRequestRef.current + 1;
      uploadRequestRef.current = requestId;
      setUploadError("");
      setProcessing(true);
      try {
        const dataUrl = await normalizeSignatureSourceFile(file);
        if (requestId !== uploadRequestRef.current) return;
        sigRef.current?.clear();
        onSignatureChange(dataUrl);
      } catch (error) {
        if (requestId === uploadRequestRef.current) {
          setUploadError(error.message || "Không thể xử lý ảnh chữ ký.");
        }
      } finally {
        event.target.value = "";
        if (requestId === uploadRequestRef.current) setProcessing(false);
      }
    },
    [onSignatureChange, setProcessing],
  );

  return (
    <div className="space-y-3">
      {allowImageUpload && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-800">
                Dùng ảnh chữ ký có sẵn
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Nên dùng PNG nền trong suốt. Hỗ trợ PNG, JPG/JPEG và WebP, tối
                đa 5 MB.
              </p>
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-700 px-4 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-700">
              <ImageUp size={17} aria-hidden="true" />
              Tải ảnh chữ ký
              <input
                ref={fileRef}
                type="file"
                accept={SIGNATURE_SOURCE_ACCEPT}
                onChange={handleImageUpload}
                disabled={interactionDisabled}
                className="sr-only"
                aria-label="Tải ảnh chữ ký"
              />
            </label>
          </div>
          {uploadError && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {uploadError}
            </p>
          )}
        </div>
      )}

      <div className="theme-always-light relative touch-none overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-white focus-within:border-emerald-600">
        <SignaturePad
          ref={sigRef}
          canvasProps={{
            className: "h-[200px] w-full",
            "aria-label": label,
          }}
          penColor="#1a1a1a"
          minWidth={1.5}
          maxWidth={3}
          clearOnResize={false}
          onEnd={handleEnd}
        />
        {interactionDisabled && (
          <div
            className="absolute inset-0 cursor-not-allowed bg-white/70"
            aria-hidden="true"
          />
        )}
      </div>

      {previewValue && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="mb-2 text-xs font-medium text-zinc-500">
            Chữ ký sẽ dùng trên hợp đồng
          </p>
          <img
            src={previewValue}
            alt="Xem trước chữ ký Bên A"
            className="h-24 w-full object-contain"
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Ký tên bằng ngón tay hoặc chuột (nhấc tay vẫn giữ nét)
        </p>
        <button
          type="button"
          onClick={handleClear}
          disabled={interactionDisabled}
          className="flex min-h-11 items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Xóa & ký lại
        </button>
      </div>
    </div>
  );
};

export default SignatureCanvas;

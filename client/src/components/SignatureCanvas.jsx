import { useRef, useCallback } from "react";
import SignaturePad from "react-signature-canvas";
import { RotateCcw } from "lucide-react";

const SignatureCanvas = ({
  onSignatureChange,
  disabled = false,
  label = "Khu vực vẽ chữ ký",
}) => {
  const sigRef = useRef(null);

  const handleEnd = useCallback(() => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      const dataUrl = sigRef.current.toDataURL("image/png");
      onSignatureChange(dataUrl);
    }
  }, [onSignatureChange]);

  const handleClear = useCallback(() => {
    if (sigRef.current) {
      sigRef.current.clear();
      onSignatureChange("");
    }
  }, [onSignatureChange]);

  return (
    <div className="space-y-3">
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
        {disabled && (
          <div
            className="absolute inset-0 cursor-not-allowed bg-white/70"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Ký tên bằng ngón tay hoặc chuột (nhấc tay vẫn giữ nét)
        </p>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
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

import { useRef, useCallback } from "react";
import SignaturePad from "react-signature-canvas";
import { RotateCcw } from "lucide-react";

const SignatureCanvas = ({ onSignatureChange, disabled = false }) => {
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
      <div
        className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden"
        style={{ touchAction: "none" }}
      >
        <SignaturePad
          ref={sigRef}
          canvasProps={{
            className: "w-full",
            style: { width: "100%", height: 200 },
          }}
          penColor="#1a1a1a"
          minWidth={1.5}
          maxWidth={3}
          clearOnResize={false}
          onEnd={handleEnd}
        />
        {disabled && (
          <div className="absolute inset-0 bg-white/60 cursor-not-allowed" />
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Ký tên bằng ngón tay hoặc chuột (nhấc tay vẫn giữ nét)
        </p>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Xóa & ký lại
        </button>
      </div>
    </div>
  );
};

export default SignatureCanvas;

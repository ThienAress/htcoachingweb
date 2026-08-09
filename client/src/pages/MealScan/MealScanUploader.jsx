import {
  AlertTriangle,
  ImagePlus,
  LockKeyhole,
  ScanLine,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const formatFileSize = (size) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
    size / 1024 / 1024,
  );

export default function MealScanUploader({
  user,
  file,
  previewUrl,
  status,
  canAnalyze,
  onFile,
  onAnalyze,
  onRemove,
  inputRef,
  imageQuality,
}) {
  const { t } = useTranslation("mealScan");
  const busy = ["checking", "compressing", "analyzing"].includes(status);

  const receiveFile = (candidate) => {
    if (candidate) onFile(candidate);
  };

  return (
    <section
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-labelledby="meal-scan-upload-title"
    >
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff5500]/10 text-[#ff5500]">
            <Zap size={18} aria-hidden="true" />
          </span>
          <div>
            <h2
              id="meal-scan-upload-title"
              className="text-sm font-bold uppercase tracking-widest text-[#ff5500]"
            >
              {t("uploader.title")}
            </h2>
            <p className="text-xs leading-5 text-slate-500">
              {t("uploader.description")}
            </p>
          </div>
        </div>
      </div>

      {/* Upload area */}
      <div className="flex-1 p-5">
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label={t("uploader.choose_file")}
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(event) => receiveFile(event.target.files?.[0])}
          disabled={busy}
        />

        {previewUrl ? (
          <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <img
              src={previewUrl}
              alt={t("uploader.preview_alt")}
              className="aspect-[4/3] w-full object-contain"
            />
            {/* Scan overlay animation */}
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 backdrop-blur-sm">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <div className="absolute inset-0 animate-ping rounded-full border border-[#ff5500]/30" />
                  <div className="absolute inset-2 animate-pulse rounded-full border border-[#ff5500]/50" />
                  <div className="absolute inset-4 rounded-full border border-[#ff5500]/80" />
                  <ScanLine size={26} className="relative text-[#ff5500]" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-semibold text-[#ff5500]">
                  {status === "compressing"
                    ? t("uploader.compressing")
                    : status === "checking"
                      ? t("uploader.checking")
                      : t("uploader.analyzing")}
                </p>
              </div>
            )}
            {/* File info bar */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-slate-900/80 px-4 py-3 backdrop-blur-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{file?.name}</p>
                <p className="text-xs text-slate-300">
                  {formatFileSize(file?.size || 0)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 text-white transition-colors hover:border-rose-400/50 hover:bg-rose-500/20 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={t("uploader.remove")}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              receiveFile(event.dataTransfer.files?.[0]);
            }}
            disabled={busy}
            className="group flex min-h-64 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center transition-all duration-200 hover:border-[#ff5500]/50 hover:bg-[#ff5500]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-all duration-200 group-hover:border-[#ff5500]/30 group-hover:bg-[#ff5500]/10 group-hover:text-[#ff5500]">
              <ImagePlus size={26} aria-hidden="true" />
            </span>
            <span className="font-semibold text-slate-700 transition-colors group-hover:text-[#e54600]">
              {t("uploader.drop")}
            </span>
            <span className="mt-2 text-sm text-slate-500">
              {t("uploader.formats")}
            </span>
          </button>
        )}

        {file && !busy && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={15} aria-hidden="true" />
            {t("uploader.replace")}
          </button>
        )}
      </div>

      {/* Privacy notice */}
      <div className="mx-5 mb-4 flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
        <LockKeyhole
          size={14}
          className="mt-0.5 shrink-0 text-slate-400"
          aria-hidden="true"
        />
        <span>{t("uploader.privacy")}</span>
      </div>

      {imageQuality?.warnings?.length > 0 && (
        <div
          className="mx-5 mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"
          role="status"
        >
          <AlertTriangle
            size={14}
            className="mt-0.5 shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <span>
            {imageQuality.warnings
              .map((warning) => t(`quality.${warning}`))
              .join(" ")}
          </span>
        </div>
      )}

      {/* CTA */}
      <div className="border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!file || busy || !canAnalyze}
          aria-describedby={file && !canAnalyze ? "meal-scan-lock-hint" : undefined}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5500] px-5 font-bold text-white transition-all hover:bg-[#e54600] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy ? (
            <>
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden="true"
              />
              <span>
                {status === "compressing"
                  ? t("uploader.compressing")
                  : status === "checking"
                    ? t("uploader.checking")
                    : t("uploader.analyzing")}
              </span>
            </>
          ) : (
            <>
              <ScanLine size={18} aria-hidden="true" />
              {t("uploader.analyze")}
            </>
          )}
        </button>
        {file && !busy && !canAnalyze && (
          <p
            id="meal-scan-lock-hint"
            className="mt-2 text-center text-xs font-medium leading-5 text-amber-700"
          >
            {t("uploader.lock_first")}
          </p>
        )}
        {!user && (
          <div className="mt-2 text-center text-xs leading-5 text-slate-500">
            <p>{t("uploader.anonymous_hint")}</p>
            <Link
              to="/login"
              state={{ from: "/quet-mon-an" }}
              className="mt-1 inline-flex min-h-11 items-center justify-center font-semibold text-[#e54600] underline decoration-[#ff5500]/30 underline-offset-2 hover:decoration-[#ff5500] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]"
            >
              {t("uploader.login_more")}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

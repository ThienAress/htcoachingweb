import { useEffect, useId, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { buildCatalogMediaItems } from "../../config/homeSectionCatalog";

const getKeyedUrl = (imagesByKey, itemKey) => {
  const value = imagesByKey instanceof Map
    ? imagesByKey.get(itemKey)
    : imagesByKey?.[itemKey];
  return typeof value === "string" && value.trim() ? value : "";
};

const getLegacyUrl = (item, legacyImages, legacyImage) => {
  if (Number.isInteger(item.legacyIndex)) return legacyImages?.[item.legacyIndex] || "";
  if (item.legacySingle) return legacyImage || "";
  return "";
};

const KeyedMediaRow = ({
  item,
  customImageUrl,
  legacyImageUrl,
  onUpload,
  onRemove,
  onPreview,
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const inputId = `site-media-${item.section}-${item.key}`;
  const displayImage = previewUrl || item.image;
  const hasDisplayImage = Boolean(displayImage);
  const statusLabel = customImageUrl
    ? "Ảnh tùy chỉnh"
    : legacyImageUrl
      ? "Ảnh hiện tại"
      : hasDisplayImage
        ? "Ảnh mặc định"
        : "Chưa có ảnh";

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl("");
  };

  const handleUpload = async () => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    try {
      await onUpload({
        section: item.section,
        itemKey: item.key,
        file: selectedFile,
      });
      clearSelection();
    } catch {
      // Toast lỗi được mutation cha xử lý; giữ file để admin có thể thử lại.
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!customImageUrl || isRemoving) return;

    setIsRemoving(true);
    try {
      await onRemove({
        section: item.section,
        itemKey: item.key,
        imageUrl: customImageUrl,
      });
    } catch {
      // Toast lỗi được mutation cha xử lý.
    } finally {
      setIsRemoving(false);
    }
  };

  const isBusy = isUploading || isRemoving;

  return (
    <div className="grid gap-4 px-5 py-5 md:grid-cols-[128px_minmax(180px,1fr)_minmax(260px,1.4fr)] md:items-center md:px-6">
      <button
        type="button"
        onClick={() => hasDisplayImage && onPreview(displayImage)}
        disabled={!hasDisplayImage}
        className="group relative h-24 w-32 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-default"
        aria-label={hasDisplayImage ? `Xem ảnh ${item.adminLabel}` : `${item.adminLabel} chưa có ảnh`}
      >
        {hasDisplayImage ? (
          <img
            src={displayImage}
            alt=""
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-xs font-semibold text-slate-500">
            <ImageIcon size={22} aria-hidden="true" />
            Chưa có ảnh
          </span>
        )}
        {previewUrl && (
          <span className="absolute left-2 top-2 rounded-md bg-blue-700 px-2 py-1 text-xs font-semibold text-white">
            Ảnh mới
          </span>
        )}
      </button>

      <div className="min-w-0">
        <h4 className="text-base font-bold text-slate-900">{item.adminLabel}</h4>
        <p className="mt-1 text-sm text-slate-500">Mã: {item.key}</p>
        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          customImageUrl
            ? "bg-emerald-50 text-emerald-700"
            : "bg-slate-100 text-slate-600"
        }`}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-3">
        <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700">
          Chọn ảnh cho {item.adminLabel}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={isBusy}
          className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600 file:mr-3 file:min-h-11 file:border-0 file:bg-blue-50 file:px-4 file:font-semibold file:text-blue-700 hover:file:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isBusy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            {customImageUrl ? "Thay ảnh" : "Tải ảnh"}
          </button>

          {previewUrl && (
            <button
              type="button"
              onClick={clearSelection}
              disabled={isBusy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={17} />
              Chọn lại
            </button>
          )}

          {customImageUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isBusy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRemoving ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
              Xóa ảnh riêng
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const KeyedMediaSection = ({
  title,
  description,
  catalog,
  imagesByKey,
  legacyImages = [],
  legacyImage = "",
  onUpload,
  onRemove,
  onPreview,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  const items = useMemo(
    () => buildCatalogMediaItems(catalog, {
      imagesByKey,
      legacyImages,
      legacyImage,
    }),
    [catalog, imagesByKey, legacyImage, legacyImages],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-start gap-3 px-5 py-5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 md:px-6"
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <ImageIcon size={21} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold text-slate-900">{title}</span>
          <span className="mt-1 block max-w-3xl text-sm leading-6 text-slate-600">{description}</span>
        </span>
        <span className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-hidden="true">
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      </button>

      <div
        id={contentId}
        hidden={!isOpen}
        className="divide-y divide-slate-200 border-t border-slate-200"
      >
        {items.map((item) => (
          <KeyedMediaRow
            key={`${item.section}:${item.key}`}
            item={item}
            customImageUrl={getKeyedUrl(imagesByKey, item.key)}
            legacyImageUrl={getLegacyUrl(item, legacyImages, legacyImage)}
            onUpload={onUpload}
            onRemove={onRemove}
            onPreview={onPreview}
          />
        ))}
      </div>
    </section>
  );
};

export default KeyedMediaSection;

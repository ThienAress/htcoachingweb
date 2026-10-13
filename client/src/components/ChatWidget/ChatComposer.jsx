import { useRef } from "react";
import { ArrowUp, Globe, Paperclip, Square, X } from "lucide-react";

const ICON_BUTTON =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60";

export default function ChatComposer({
  inputRef,
  value,
  onChange,
  onSend,
  onStop,
  isLoading,
  selectedImage,
  onSelectImage,
  onRemoveImage,
  canAttach,
  webSearchEnabled,
  onToggleWebSearch,
  canUseWebSearch,
}) {
  const fileInputRef = useRef(null);
  const hasContent = Boolean(value.trim() || selectedImage);
  const webSearchActive = canUseWebSearch && webSearchEnabled;
  const webSearchTitle = canUseWebSearch
    ? webSearchActive
      ? "Đang bật: HT Assistant được tra cứu nguồn trên web khi cần"
      : "Bật để HT Assistant tra cứu thông tin mới nhất trên web"
    : "Đăng nhập để dùng Tìm kiếm thông minh";

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-gray-200 bg-gray-100 px-3 pb-3 pt-3 shadow-sm transition-[border-color,background-color] duration-150 focus-within:border-emerald-500/40 focus-within:bg-white motion-reduce:transition-none dark:border-white/10 dark:bg-white/5 dark:focus-within:bg-white/10">
      {selectedImage && (
        <div className="group relative ml-1 h-16 w-16 overflow-hidden rounded-lg border border-gray-300 shadow-md dark:border-white/20">
          <img src={selectedImage} alt="Ảnh đã chọn" className="h-full w-full object-cover" />
          <button
            type="button"
            aria-label="Xóa ảnh đã chọn"
            onClick={onRemoveImage}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Nhắn tin cho HT Assistant"
        aria-label="Nhập câu hỏi cho HT Assistant"
        rows={2}
        disabled={isLoading}
        className="max-h-[200px] min-h-[48px] w-full resize-none bg-transparent px-1 text-base leading-relaxed text-gray-900 outline-none placeholder-gray-500 disabled:opacity-50 dark:text-white"
        style={{ fieldSizing: "content" }}
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleWebSearch}
          disabled={!canUseWebSearch}
          aria-pressed={webSearchActive}
          title={webSearchTitle}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-50 ${
            webSearchActive
              ? "border-emerald-500/50 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300"
              : "border-gray-300 text-gray-600 hover:bg-gray-200 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
          }`}
        >
          <Globe size={16} aria-hidden="true" />
          Tìm kiếm thông minh
        </button>

        <div className="flex items-center gap-1">
          {canAttach && (
            <>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                ref={fileInputRef}
                onChange={onSelectImage}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                aria-label="Đính kèm ảnh"
                title="Đính kèm ảnh"
                className={`${ICON_BUTTON} text-gray-500 hover:bg-gray-200 hover:text-emerald-600 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-emerald-400`}
              >
                <Paperclip size={18} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={isLoading ? onStop : onSend}
            disabled={!isLoading && !hasContent}
            aria-label={isLoading ? "Dừng phản hồi" : "Gửi tin nhắn"}
            title={isLoading ? "Dừng phản hồi" : "Gửi tin nhắn"}
            className={`${ICON_BUTTON} ${
              isLoading
                ? "bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                : hasContent
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                  : "cursor-not-allowed bg-gray-300 text-white dark:bg-white/15 dark:text-gray-400"
            }`}
          >
            {isLoading ? <Square size={14} fill="currentColor" /> : <ArrowUp size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

import { Film, Trash2, Upload } from "lucide-react";

export default function ExerciseVideoUploadField({
  exerciseId,
  videoUrl,
  isUploading,
  isDeleting,
  onUpload,
  onDelete,
}) {
  return (
    <fieldset className="rounded-xl border border-gray-200 p-4">
      <legend className="text-sm font-bold text-gray-800">Video bài tập</legend>
      {!exerciseId ? (
        <p className="mt-2 text-sm text-gray-500">
          Lưu bài tập trước, sau đó mở lại để upload video.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              preload="metadata"
              className="max-h-64 w-full rounded-xl bg-black"
            >
              Trình duyệt chưa hỗ trợ video này.
            </video>
          ) : (
            <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400">
              <div className="text-center">
                <Film className="mx-auto size-7" aria-hidden="true" />
                <p className="mt-2 text-xs">Chưa có video</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
              <Upload size={16} aria-hidden="true" />
              {isUploading ? "Đang upload..." : videoUrl ? "Thay video" : "Chọn video"}
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                className="sr-only"
                disabled={isUploading || isDeleting}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUpload(file);
                  event.target.value = "";
                }}
              />
            </label>
            {videoUrl && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isUploading || isDeleting}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={16} aria-hidden="true" />
                {isDeleting ? "Đang xóa..." : "Xóa video"}
              </button>
            )}
          </div>
          <p className="text-xs leading-5 text-gray-500">
            MP4, MOV hoặc WEBM; tối đa 100MB. Video sẽ không tự phát ở trang public.
          </p>
        </div>
      )}
    </fieldset>
  );
}

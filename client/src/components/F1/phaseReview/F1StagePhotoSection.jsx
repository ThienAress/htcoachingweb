import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Sparkles, Upload } from "lucide-react";
import { toast } from "react-toastify";
import {
  generateStageVisual,
  uploadStagePhoto,
} from "../../../services/f1Customer.service";
import { resolveMediaUrl } from "../../../utils/mediaUrl";
import { phaseReviewsQueryKey } from "../../../utils/f1PhaseReview";

const errorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.errors?.[0]?.msg ||
  fallback;

const PhotoCard = ({ title, imageUrl, emptyText, action }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {action}
    </div>
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
      {imageUrl ? (
        <img src={resolveMediaUrl(imageUrl)} alt={title} className="h-[320px] w-full object-cover" />
      ) : (
        <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-sm text-slate-400">
          <ImageIcon size={28} aria-hidden="true" />
          <p>{emptyText}</p>
        </div>
      )}
    </div>
  </div>
);

const UploadButton = ({ label, disabled, onFile }) => {
  const inputRef = useRef(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
      >
        <Upload size={13} aria-hidden="true" />
        Tải ảnh
      </button>
    </>
  );
};

// Ảnh của giai đoạn 2 trở đi: HLV tải ảnh hiện tại rồi tạo ảnh dự đoán cho giai đoạn đó.
const F1StagePhotoSection = ({ customerId, stageOrder, visual = {}, onConfirmGenerate }) => {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: phaseReviewsQueryKey(customerId) });

  const uploadMutation = useMutation({
    mutationFn: ({ file, side }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("side", side);
      return uploadStagePhoto(customerId, stageOrder, form);
    },
    onSuccess: async (res) => {
      await refresh();
      toast.success(res?.message || "Đã tải ảnh lên");
    },
    onError: (error) => toast.error(errorMessage(error, "Tải ảnh thất bại")),
  });

  const generateMutation = useMutation({
    mutationFn: (forceRegenerate) =>
      generateStageVisual(customerId, stageOrder, {
        requestId: crypto.randomUUID(),
        forceRegenerate,
      }),
    onSuccess: async (res) => {
      await refresh();
      toast.success(res?.message || "Đã tạo ảnh dự đoán");
    },
    onError: async (error) => {
      await refresh();
      toast.error(errorMessage(error, "Tạo ảnh dự đoán thất bại"));
    },
  });

  const hasBefore = Boolean(visual.beforeFrontUrl && visual.beforeSideUrl);
  const hasAfter = Boolean(visual.frontUrl || visual.sideUrl);
  const attempts = Number(visual.attemptCount || 0);
  const maxAttempts = Number(visual.maxAttempts || 3);
  const busy = uploadMutation.isPending || generateMutation.isPending;

  const handleGenerate = async () => {
    const force = hasAfter;
    const confirmed = await onConfirmGenerate(force, attempts, maxAttempts);
    if (confirmed) generateMutation.mutate(force);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-800">Hình ảnh kỳ vọng sau giai đoạn {stageOrder}</p>
          <p className="mt-1 text-sm text-slate-500">
            Tải ảnh hiện tại của khách (mặt trước và mặt bên) rồi tạo ảnh dự đoán. Mỗi lần tạo ảnh có thể phát sinh chi phí.
          </p>
          <p className="mt-1 text-xs text-orange-600">
            Đã dùng {attempts}/{maxAttempts} lượt cho giai đoạn này.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!hasBefore || busy || attempts >= maxAttempts}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-3 font-bold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
        >
          <Sparkles size={18} aria-hidden="true" />
          {generateMutation.isPending ? "Đang tạo ảnh AI..." : hasAfter ? "Tạo lại ảnh AI" : "Tạo ảnh AI"}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-800">Ảnh hiện tại</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <PhotoCard
              title="Hiện tại • Mặt trước"
              imageUrl={visual.beforeFrontUrl}
              emptyText="Chưa có ảnh mặt trước"
              action={
                <UploadButton
                  label={`Tải ảnh mặt trước giai đoạn ${stageOrder}`}
                  disabled={busy}
                  onFile={(file) => uploadMutation.mutate({ file, side: "front" })}
                />
              }
            />
            <PhotoCard
              title="Hiện tại • Mặt bên"
              imageUrl={visual.beforeSideUrl}
              emptyText="Chưa có ảnh mặt bên"
              action={
                <UploadButton
                  label={`Tải ảnh mặt bên giai đoạn ${stageOrder}`}
                  disabled={busy}
                  onFile={(file) => uploadMutation.mutate({ file, side: "side" })}
                />
              }
            />
          </div>
        </div>
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-800">Ảnh dự đoán sau giai đoạn {stageOrder}</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <PhotoCard title="Sau tập • Mặt trước" imageUrl={visual.frontUrl} emptyText="Chưa có ảnh sau tập (mặt trước)" />
            <PhotoCard title="Sau tập • Mặt bên" imageUrl={visual.sideUrl} emptyText="Chưa có ảnh sau tập (mặt bên)" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default F1StagePhotoSection;

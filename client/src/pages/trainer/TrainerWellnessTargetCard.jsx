import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Save, Target } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import {
  getTrainerClientWellnessTarget,
  updateTrainerClientWellnessTarget,
} from "../../services/wellnessTarget.service";
import {
  getWellnessTargetSubmitLabel,
  targetToFormValues,
  waterLitersToMl,
  wellnessTargetFormSchema,
} from "../today-dashboard/wellnessTarget";

const inputClass =
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-60";

export const TrainerWellnessTargetCard = ({ clientId }) => {
  const queryClient = useQueryClient();
  const queryKey = ["wellness-target", "trainer", clientId];
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (await getTrainerClientWellnessTarget(clientId)).data.data,
    enabled: Boolean(clientId),
    staleTime: 20_000,
    gcTime: 0,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(wellnessTargetFormSchema),
    defaultValues: targetToFormValues(null),
  });

  useEffect(() => {
    if (!query.isLoading) reset(targetToFormValues(query.data));
  }, [query.data, query.isLoading, reset]);

  const mutation = useMutation({
    mutationFn: async (values) =>
      (
        await updateTrainerClientWellnessTarget(clientId, {
          expectedVersion: query.data?.version || 0,
          requestId: window.crypto.randomUUID(),
          targets: {
            sleepHours: values.sleepHours,
            waterMl: waterLitersToMl(values.waterLiters),
            steps: values.steps,
          },
          note: values.note.trim(),
        })
      ).data.data,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      reset(targetToFormValues(data));
      toast.success(
        query.data
          ? "Đã cập nhật mục tiêu sức khỏe"
          : "Đã lưu mục tiêu sức khỏe",
      );
    },
    onError: (error) => {
      if (error.response?.status === 409) {
        toast.error("Mục tiêu vừa được cập nhật. Đang tải phiên bản mới nhất");
        void query.refetch();
        return;
      }
      toast.error(
        error.response?.data?.message || "Không thể lưu mục tiêu sức khỏe",
      );
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Target className="mt-0.5 h-5 w-5 text-cyan-400" aria-hidden="true" />
          <div>
            <h2 className="font-bold text-white">Mục tiêu sức khỏe</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Đặt mục tiêu tham chiếu; học viên vẫn tự nhập số thực tế mỗi ngày.
            </p>
          </div>
        </div>

      </div>

      {query.isLoading ? (
        <div className="mt-5 h-32 animate-pulse rounded-xl bg-slate-950" role="status">
          <span className="sr-only">Đang tải mục tiêu sức khỏe...</span>
        </div>
      ) : query.isError ? (
        <div className="mt-5 text-sm text-red-300">
          <p>{query.error?.response?.data?.message || "Không thể tải mục tiêu."}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Thử lại
          </button>
        </div>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-300">
              Giấc ngủ mục tiêu (giờ)
              <input type="number" min="1" max="24" step="0.5" {...register("sleepHours")} className={inputClass} />
              {errors.sleepHours && <span className="mt-1 block text-xs text-red-300">Từ 1 đến 24 giờ</span>}
            </label>
            <label className="text-sm font-medium text-slate-300">
              Nước uống mục tiêu (lít)
              <input
                type="number"
                min="0.25"
                max="20"
                step="0.05"
                inputMode="decimal"
                placeholder="Ví dụ: 2.5"
                {...register("waterLiters")}
                className={inputClass}
              />
              {errors.waterLiters && <span className="mt-1 block text-xs text-red-300">Từ 0,25 đến 20 lít</span>}
            </label>
            <label className="text-sm font-medium text-slate-300">
              Số bước mục tiêu
              <input type="number" min="100" max="200000" step="100" {...register("steps")} className={inputClass} />
              {errors.steps && <span className="mt-1 block text-xs text-red-300">Từ 100 đến 200.000 bước</span>}
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-300">
            Ghi chú cho học viên
            <textarea rows={2} maxLength={500} {...register("note")} className={inputClass} />
            {errors.note && <span className="mt-1 block text-xs text-red-300">Tối đa 500 ký tự</span>}
          </label>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cyan-500 px-4 font-bold text-slate-950 transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {getWellnessTargetSubmitLabel(query.data, mutation.isPending)}
          </button>
        </form>
      )}
    </section>
  );
};

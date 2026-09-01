import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Droplets, Footprints, RefreshCw, Save } from "lucide-react";
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
  "mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-50 outline-none transition placeholder:text-slate-500 hover:border-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50";

const FIELDS = [
  { name: "sleepHours", label: "Giấc ngủ mục tiêu", unit: "giờ", Icon: BedDouble, min: 1, max: 24, step: 0.5, inputMode: "decimal", placeholder: "Ví dụ: 8" },
  { name: "waterLiters", label: "Nước uống mục tiêu", unit: "lít", Icon: Droplets, min: 0.25, max: 20, step: 0.05, inputMode: "decimal", placeholder: "Ví dụ: 2,5" },
  { name: "steps", label: "Số bước mục tiêu", unit: "bước", Icon: Footprints, min: 100, max: 200000, step: 100, inputMode: "numeric", placeholder: "Ví dụ: 8.000" },
];

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
        toast.error("Mục tiêu vừa được cập nhật. Đang tải dữ liệu mới nhất");
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
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm">
      <div className="flex items-start gap-4 border-b border-slate-800 p-5 sm:p-6">
        <div>
          <h3 className="text-xl font-bold text-slate-50 sm:text-2xl">Chỉ số mục tiêu</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Đặt mục tiêu và gửi cho khách hàng
          </p>
        </div>
      </div>

      <div className="p-5">
        {query.isLoading ? (
          <div className="space-y-3" role="status">
            <span className="sr-only">Đang tải mục tiêu sức khỏe...</span>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="h-20 animate-pulse rounded-xl bg-gray-800/60" />
              <div className="h-20 animate-pulse rounded-xl bg-gray-800/60" />
              <div className="h-20 animate-pulse rounded-xl bg-gray-800/60" />
            </div>
          </div>
        ) : query.isError ? (
          <div className="text-sm text-red-300">
            <p>{query.error?.response?.data?.message || "Không thể tải mục tiêu."}</p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-sm font-semibold hover:bg-red-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Thử lại
            </button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={submit}>
            {/* 3-column metric inputs */}
            <div className="grid gap-3 sm:grid-cols-3">
              {FIELDS.map(({ name, label, unit, Icon, min, max, step, inputMode, placeholder }) => (
                <label key={name} className="block">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Icon className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                      {label}
                    <span className="text-xs font-normal text-slate-400">({unit})</span>
                  </span>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    inputMode={inputMode}
                    placeholder={placeholder}
                    {...register(name)}
                    className={inputClass}
                  />
                  {errors[name] && (
                    <span className="mt-1.5 block text-xs text-rose-300">
                      {name === "sleepHours" && "Từ 1 đến 24 giờ"}
                      {name === "waterLiters" && "Từ 0,25 đến 20 lít"}
                      {name === "steps" && "Từ 100 đến 200.000 bước"}
                    </span>
                  )}
                </label>
              ))}
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-semibold text-slate-200">
                Ghi chú cho học viên
              </label>
              <textarea
                rows={2}
                maxLength={500}
                {...register("note")}
                className={inputClass + " resize-y"}
                placeholder="Nhập ghi chú, lời khuyên cho học viên..."
              />
              {errors.note && (
                <span className="mt-1.5 block text-xs text-rose-300">Tối đa 500 ký tự</span>
              )}
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-400 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              {getWellnessTargetSubmitLabel(query.data, mutation.isPending)}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

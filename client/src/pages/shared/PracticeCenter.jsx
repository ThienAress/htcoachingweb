import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FlaskConical,
  MailCheck,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useOutletContext } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import SEO from "../../components/SEO";
import {
  getPracticeCenter,
  sendPracticeCenterSimulation,
} from "../../services/practiceCenter.service";
import PracticeCenterContent from "./components/PracticeCenterContent";
import { PracticeCenterLoadingState } from "./components/PracticeCenterStates";

const QUERY_KEY = ["practice-center"];
const formSchema = z.object({
  scenario: z.enum(["order", "checkin", "journey"], {
    message: "Chọn một kịch bản mô phỏng",
  }),
});

export default function PracticeCenter() {
  const outletContext = useOutletContext();
  const darkSurface = outletContext?.trainerTheme === "dark";
  const cardClass = darkSurface
    ? "border-slate-800 bg-slate-900"
    : "border-slate-200 bg-white";
  const mutedTextClass = darkSurface ? "text-slate-300" : "text-slate-600";
  const subtleTextClass = darkSurface ? "text-slate-400" : "text-slate-500";
  const strongTextClass = darkSurface ? "text-slate-50" : "text-slate-950";
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async ({ signal }) => (await getPracticeCenter({ signal })).data.data,
    staleTime: 20_000,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { scenario: "order" },
  });
  const selectedKey = useWatch({ control, name: "scenario" });
  const selected = query.data?.scenarios?.find(
    (scenario) => scenario.key === selectedKey,
  );
  const remaining = Number(query.data?.quota?.remaining || 0);
  const exhausted = Boolean(query.data) && remaining === 0;
  const requiredUnits =
    pendingRequest?.scenario === selectedKey
      ? pendingRequest.pendingUnits
      : selected?.cost;
  const insufficient = Boolean(selected) && requiredUnits > remaining;

  const mutation = useMutation({
    mutationFn: async ({ scenario, requestId }) =>
      (
        await sendPracticeCenterSimulation({
          scenario,
          requestId,
        })
      ).data.data,
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, (current) =>
        current ? { ...current, quota: data.quota } : current,
      );
      setLastResult(data);
      setPendingRequest(null);
      toast.success("Đã gửi email mô phỏng tới email đăng nhập");
    },
    onError: (error) => {
      const quota = error.response?.data?.meta?.quota;
      if (quota) {
        queryClient.setQueryData(QUERY_KEY, (current) =>
          current ? { ...current, quota } : current,
        );
      }
      const pending = error.response?.data?.data?.pending || [];
      const unknown = error.response?.data?.data?.unknown || [];
      if (pending.length > 0 && error.response?.data?.requestId) {
        setPendingRequest({
          scenario: error.response.data.scenario,
          requestId: error.response.data.requestId,
          pendingUnits: pending.length,
        });
      } else if (unknown.length > 0) {
        setPendingRequest(null);
      }
      toast.error(
        error.response?.data?.message ||
          "Không thể gửi email mô phỏng. Vui lòng thử lại.",
      );
    },
  });

  const submitSimulation = (values) => {
    const definition = query.data.scenarios.find(
      (scenario) => scenario.key === values.scenario,
    );
    const request =
      pendingRequest?.scenario === values.scenario
        ? pendingRequest
        : {
            scenario: values.scenario,
            requestId: globalThis.crypto.randomUUID(),
            pendingUnits: definition?.cost || 1,
          };
    setPendingRequest(request);
    mutation.mutate({
      scenario: request.scenario,
      requestId: request.requestId,
    });
  };

  return (
    <main
      className={`min-h-full p-4 sm:p-6 ${
        darkSurface ? "bg-slate-950 text-slate-50" : "bg-slate-100 text-slate-950"
      }`}
    >
      <SEO title="Trung tâm thực hành" noindex />
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex max-w-3xl items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm">
            <FlaskConical className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Trung tâm thực hành
            </h1>
            <p className={`mt-2 text-sm leading-6 sm:text-base ${mutedTextClass}`}>
              Tự trải nghiệm email Order và Check-in trước khi làm việc với khách hàng.
              Mọi dữ liệu trong đây đều là mô phỏng.
            </p>
          </div>
        </header>

        {query.isLoading ? (
          <PracticeCenterLoadingState />
        ) : query.isError ? (
          <section
            className="rounded-2xl border border-rose-200 bg-rose-50 p-6"
            role="alert"
          >
            <h2 className="font-bold text-rose-950">Không thể tải Trung tâm thực hành</h2>
            <p className="mt-2 text-sm text-rose-800">
              {query.error?.response?.data?.message ||
                "Kiểm tra lại kết nối hoặc thử tải lại dữ liệu."}
            </p>
            <button
              type="button"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-rose-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`size-4 ${query.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`}
                aria-hidden="true"
              />
              Thử lại
            </button>
          </section>
        ) : !query.data?.scenarios?.length ? (
          <section className={`rounded-2xl border p-8 text-center ${cardClass}`}>
            <MailCheck className="mx-auto size-8 text-slate-400" aria-hidden="true" />
            <h2 className="mt-3 font-bold">Chưa có kịch bản mô phỏng</h2>
            <p className={`mt-2 text-sm ${mutedTextClass}`}>
              Các kịch bản đang được chuẩn bị. Vui lòng quay lại sau.
            </p>
          </section>
        ) : (
          <PracticeCenterContent
            data={query.data}
            pendingRequest={pendingRequest}
            remaining={remaining}
            exhausted={exhausted}
            insufficient={insufficient}
            isPending={mutation.isPending}
            register={register}
            handleSubmit={handleSubmit}
            errors={errors}
            onSubmit={submitSimulation}
            darkSurface={darkSurface}
            cardClass={cardClass}
            mutedTextClass={mutedTextClass}
            subtleTextClass={subtleTextClass}
            strongTextClass={strongTextClass}
            lastResult={lastResult}
          />
        )}
      </div>
    </main>
  );
}

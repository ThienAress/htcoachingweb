import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, MailPlus, RotateCcw, UserCheck } from "lucide-react";
import { toast } from "react-toastify";
import {
  getPendingTrainerGrants,
  grantTrainerPlanByEmail,
  revokePendingTrainerGrant,
} from "../../../services/trainerSubscription.service";
import { useTrainerPlanCatalog } from "../../../hooks/useTrainerPlanCatalog";


const TrainerGrantPanel = () => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [planCode, setPlanCode] = useState("standard");
  const [billingCycle, setBillingCycle] = useState("month");

  const {
    data: trainerCatalog,
    isLoading: catalogLoading,
    isError: catalogError,
    refetch: refetchCatalog,
  } = useTrainerPlanCatalog();
  const planOptions = useMemo(
    () => (trainerCatalog?.plans || []).map((plan) => ({
      code: plan.code,
      label: `${plan.title} — ${plan.durationDays ? `${plan.durationDays} ngày / ` : ""}${plan.maxClients} khách`,
    })),
    [trainerCatalog],
  );
  const planLabels = useMemo(
    () => Object.fromEntries(
      (trainerCatalog?.plans || []).map((plan) => [plan.code, plan.title]),
    ),
    [trainerCatalog],
  );
  const selectedPlan = trainerCatalog?.byCode?.[planCode];
  const availableCycles = useMemo(
    () => (selectedPlan?.billingCycles || []).map((cycle) => ({
      value: cycle,
      label: cycle === "trial" ? `Dùng thử ${selectedPlan.durationDays} ngày` : cycle === "year" ? "Theo năm" : "Theo tháng",
    })),
    [selectedPlan],
  );

  const {
    data: pendingResponse,
    isLoading: pendingLoading,
    isError: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["pending-trainer-grants"],
    queryFn: () => getPendingTrainerGrants().then((res) => res.data),
  });
  const pendingGrants = pendingResponse?.data || [];

  const refreshLists = () => {
    queryClient.invalidateQueries({ queryKey: ["subscribers"] });
    queryClient.invalidateQueries({ queryKey: ["pending-trainer-grants"] });
  };

  const grantMutation = useMutation({
    mutationFn: grantTrainerPlanByEmail,
    onSuccess: (response) => {
      toast.success(response.data.message);
      setEmail("");
      refreshLists();
    },
    onError: (error) =>
      toast.error(error.response?.data?.message || "Không thể cấp gói"),
  });

  const revokeMutation = useMutation({
    mutationFn: revokePendingTrainerGrant,
    onSuccess: (response) => {
      toast.success(response.data.message);
      refreshLists();
    },
    onError: (error) =>
      toast.error(error.response?.data?.message || "Không thể thu hồi gói"),
  });

  const handlePlanChange = (event) => {
    const nextPlan = event.target.value;
    setPlanCode(nextPlan);
    const next = trainerCatalog?.byCode?.[nextPlan];
    setBillingCycle(next?.billingCycles?.[0] || "month");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    grantMutation.mutate({ email: email.trim(), planCode, billingCycle });
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-orange-50 p-2 text-orange-600">
          <MailPlus className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">Cấp gói theo email</h2>
          <p className="text-sm text-slate-500">
            Email chưa có tài khoản sẽ được giữ ở trạng thái chờ và tự nhận gói
            khi đăng nhập đúng email.
          </p>
        </div>
      </div>
      {catalogError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>Không thể tải danh mục gói hiện tại.</p>
          <button
            type="button"
            onClick={() => refetchCatalog()}
            className="mt-2 min-h-11 rounded-md px-3 py-2 font-semibold hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            Thử tải lại
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(190px,0.8fr)_minmax(150px,0.6fr)_auto]"
      >
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Email người nhận
          <input
            type="email"
            required
            maxLength={320}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="trainer@gmail.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Gói dịch vụ
          <select
            value={planCode}
            onChange={handlePlanChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            {planOptions.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Chu kỳ
          <select
            value={billingCycle}
            onChange={(event) => setBillingCycle(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            {availableCycles.map((cycle) => (
              <option key={cycle.value} value={cycle.value}>
                {cycle.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={grantMutation.isPending || catalogLoading || catalogError || !email.trim()}
          className="min-h-11 self-end rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {grantMutation.isPending ? "Đang cấp..." : "Cấp gói"}
        </button>
      </form>

      <div className="border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Clock3 className="h-4 w-4 text-amber-500" aria-hidden="true" />
          Đang chờ đăng nhập ({pendingGrants.length})
        </div>
        {pendingLoading ? (
          <p className="text-sm text-slate-500">Đang tải danh sách chờ...</p>
        ) : pendingError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>Không thể tải danh sách email đang chờ.</p>
            <button
              type="button"
              onClick={() => refetchPending()}
              className="mt-2 min-h-11 rounded-md px-3 py-2 font-semibold text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              Thử tải lại
            </button>
          </div>
        ) : pendingGrants.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            Không có email nào đang chờ nhận gói.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {pendingGrants.map((grant) => (
              <li
                key={grant._id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {grant.normalizedEmail}
                  </p>
                  <p className="text-xs text-slate-500">
                    {planLabels[grant.planCode] || grant.planCode} · {grant.billingCycle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeMutation.mutate(grant._id)}
                  disabled={revokeMutation.isPending}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Thu hồi
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default TrainerGrantPanel;

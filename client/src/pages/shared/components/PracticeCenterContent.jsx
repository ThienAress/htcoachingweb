import { CheckCircle2, Send, ShieldCheck } from "lucide-react";

const resetLabel = (resetAt) => {
  if (!resetAt) return "Hạn mức được tính trong 24 giờ gần nhất.";
  return `Lượt kế tiếp dự kiến mở lúc ${new Date(resetAt).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  })}.`;
};

const PracticeCenterContent = ({
  data,
  pendingRequest,
  remaining,
  exhausted,
  insufficient,
  isPending,
  register,
  handleSubmit,
  errors,
  onSubmit,
  darkSurface,
  cardClass,
  mutedTextClass,
  subtleTextClass,
  strongTextClass,
  lastResult,
}) => (
  <div className="grid items-start gap-6 lg:grid-cols-12">
    <form
      className="space-y-5 lg:col-span-7"
      onSubmit={handleSubmit(onSubmit)}
    >
      <fieldset>
        <legend className="text-lg font-bold">Chọn kịch bản muốn thử</legend>
        <p className={`mt-1 text-sm ${mutedTextClass}`}>
          Email chỉ được gửi tới tài khoản đang đăng nhập.
        </p>
        <div className="mt-4 space-y-3">
          {data.scenarios.map((scenario, index) => {
            const requiredUnits =
              pendingRequest?.scenario === scenario.key
                ? pendingRequest.pendingUnits
                : scenario.cost;
            const disabled = requiredUnits > remaining || isPending;
            return (
              <label
                key={scenario.key}
                className={`flex min-h-24 cursor-pointer items-start gap-4 rounded-xl border p-4 transition-[border-color,box-shadow] hover:border-emerald-500 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 ${
                  darkSurface
                    ? "border-slate-700 bg-slate-900"
                    : "border-slate-300 bg-white"
                }`}
              >
                <input
                  type="radio"
                  value={scenario.key}
                  disabled={disabled}
                  {...register("scenario")}
                  className="mt-1 size-4 accent-emerald-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`font-bold ${strongTextClass}`}>
                      {index + 1}. {scenario.label}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        darkSurface
                          ? "bg-cyan-950 text-cyan-200"
                          : "bg-cyan-50 text-cyan-800"
                      }`}
                    >
                      {requiredUnits} lượt
                    </span>
                  </span>
                  <span
                    className={`mt-1 block text-sm leading-6 ${mutedTextClass}`}
                  >
                    {scenario.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {errors.scenario && (
        <p className="text-sm font-medium text-rose-700" role="alert">
          {errors.scenario.message}
        </p>
      )}
      {(exhausted || insufficient) && (
        <p
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
          role="status"
        >
          {exhausted
            ? "Bạn đã dùng hết lượt mô phỏng trong 24 giờ."
            : "Bạn không còn đủ lượt cho kịch bản này."}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending || exhausted || insufficient}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
      >
        <Send className="size-4" aria-hidden="true" />
        {isPending ? "Đang gửi mô phỏng..." : "Gửi email mô phỏng"}
      </button>
    </form>

    <aside
      className={`rounded-2xl border p-5 shadow-sm lg:col-span-5 ${cardClass}`}
    >
      <h2 className="flex items-center gap-2 font-bold">
        <ShieldCheck className="size-5 text-emerald-700" aria-hidden="true" />
        Kiểm tra trước khi gửi
      </h2>
      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className={subtleTextClass}>Email nhận mô phỏng</dt>
          <dd className={`mt-1 break-all font-semibold ${strongTextClass}`}>
            {data.recipient}
          </dd>
        </div>
        <div>
          <dt className={subtleTextClass}>Hạn mức hiện tại</dt>
          <dd className="mt-1 text-xl font-bold text-emerald-800">
            {remaining} / {data.quota.limit} lượt còn lại
          </dd>
          <dd className={`mt-1 text-xs leading-5 ${subtleTextClass}`}>
            {resetLabel(data.quota.resetAt)}
          </dd>
        </div>
      </dl>
      <div
        className={`mt-5 border-t pt-5 text-sm leading-6 ${
          darkSurface
            ? "border-slate-800 text-slate-300"
            : "border-slate-200 text-slate-600"
        }`}
      >
        <p>
          Email luôn có nhãn <strong>[MÔ PHỎNG]</strong>.
        </p>
        <p>Không tạo Order, Check-in, hợp đồng hoặc trừ buổi thật.</p>
      </div>
      {lastResult && (
        <div
          className="mt-5 flex gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
          role="status"
        >
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <p>
            Đã gửi mô phỏng tới <strong>{lastResult.recipient}</strong>.
          </p>
        </div>
      )}
    </aside>
  </div>
);

export default PracticeCenterContent;

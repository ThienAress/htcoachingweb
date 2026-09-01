import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
} from "lucide-react";

const metricLabels = {
  orders: "Order đang hoạt động",
  schedules: "Lịch tập tương lai",
  scheduleClaims: "Slot lịch liên quan",
  workoutPlans: "Giáo án Workout",
  coachingDays: "Ngày Online Coaching",
  checkins: "Check-in giữ nguyên",
  contracts: "Hợp đồng giữ nguyên",
  signedContracts: "Hợp đồng đã ký giữ nguyên",
  f1Customers: "Hồ sơ F1 giữ nguyên",
};

const SummaryRows = ({ values }) =>
  Object.entries(values).map(([key, value]) => (
    <div
      key={key}
      className="flex items-center justify-between border-b border-slate-100 py-2"
    >
      <span className="text-slate-600">{metricLabels[key]}</span>
      <strong className="text-slate-950">{value}</strong>
    </div>
  ));

const TransferPreview = ({
  preview,
  confirmed,
  onConfirmedChange,
  onConfirm,
  isPending,
  errorMessage,
}) => {
  if (!preview) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center text-center text-slate-500">
        <Info className="size-8" aria-hidden="true" />
        <p className="mt-3 max-w-sm text-sm leading-6">
          Chọn khách, HLV mới và nhập lý do để xem chính xác dữ liệu được
          chuyển hoặc giữ nguyên.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-cyan-950 p-5 text-cyan-50">
        <p className="text-sm font-semibold text-cyan-200">
          Ảnh hưởng chuyển giao
        </p>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span className="font-semibold">{preview.fromTrainer.name}</span>
          <ArrowRight className="size-4 text-cyan-300" aria-hidden="true" />
          <span className="font-semibold">{preview.toTrainer.name}</span>
        </div>
        <p className="mt-2 text-xs text-cyan-200">
          {preview.client.name} · {preview.client.email}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
        <SummaryRows values={preview.affected} />
        <SummaryRows values={preview.retained} />
      </div>
      <p
        className={`rounded-lg px-3 py-2 text-sm font-medium ${
          preview.capacity.exceeded
            ? "bg-rose-50 text-rose-800"
            : "bg-emerald-50 text-emerald-800"
        }`}
      >
        Sức chứa HLV mới: {preview.capacity.projectedClients}/
        {preview.capacity.maxClients} học viên
      </p>
      {preview.warnings.length > 0 && (
        <ul className="space-y-2 text-sm text-amber-900">
          {preview.warnings.map((warning) => (
            <li key={warning.code} className="flex gap-2">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {warning.message}
            </li>
          ))}
        </ul>
      )}
      <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => onConfirmedChange(event.target.checked)}
          className="mt-1 size-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
        />
        <span>Tôi đã kiểm tra phần được chuyển và phần giữ nguyên.</span>
      </label>
      {errorMessage && (
        <p className="text-sm font-medium text-rose-700" role="alert">
          {errorMessage}
        </p>
      )}
      <button
        type="button"
        onClick={onConfirm}
        disabled={!preview.canTransfer || !confirmed || isPending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {isPending ? "Đang chuyển..." : "Xác nhận chuyển HLV"}
      </button>
    </div>
  );
};

export default TransferPreview;

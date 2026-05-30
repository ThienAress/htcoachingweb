// F1CustomerDetail.jsx
import {
  ArrowLeft,
  ClipboardList,
  Activity,
  Sparkles,
  TrendingUp,
  Trash2,
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from "lucide-react";
import F1TestPermissionReviewCard from "./F1TestPermissionReviewCard";

const InfoItem = ({ label, value }) => {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-white overflow-hidden">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className="mt-1.5 text-base font-semibold text-slate-800 truncate"
        title={value}
      >
        {value || "--"}
      </p>
    </div>
  );
};

const ProgressCard = ({ title, done }) => {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${done
          ? "border-emerald-200 bg-emerald-50/60 shadow-sm"
          : "border-slate-100 bg-white hover:border-slate-200"
        }`}
    >
      {done ? (
        <CheckCircle2 size={20} className="text-emerald-600" />
      ) : (
        <Clock size={20} className="text-slate-400" />
      )}
      <div>
        <p
          className={`text-sm font-semibold ${done ? "text-emerald-800" : "text-slate-700"}`}
        >
          {title}
        </p>
        <p className="text-xs text-slate-500">
          {done ? "Đã hoàn tất" : "Chưa hoàn tất"}
        </p>
      </div>
    </div>
  );
};

const StatusBadge = ({ value }) => {
  const map = {
    new: "Mới tạo",
    intake_in_progress: "Đang khảo sát",
    intake_completed: "Đã khảo sát",
    testing_completed: "Đã đánh giá thể chất",
    assessment_completed: "Đã đánh giá thể chất",
    ai_report_generated: "Đã có AI report",
    archived: "Lưu trữ",
  };
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
      {map[value] || value}
    </span>
  );
};

const ReadinessBadge = ({ value }) => {
  const styles = {
    pending: "bg-orange-50 text-orange-700 ring-orange-200",
    ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    caution: "bg-orange-50 text-orange-700 ring-orange-200",
    hold: "bg-red-50 text-red-700 ring-red-200",
  };
  const labels = {
    pending: "Đang chờ",
    ready: "Sẵn sàng",
    caution: "Chú ý",
    hold: "Tạm hoãn",
  };
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${styles[value] || "bg-slate-100 text-slate-700 ring-slate-200"
        }`}
    >
      {labels[value] || value}
    </span>
  );
};

const PermissionBadge = ({ value }) => {
  const styles = {
    full_test: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    modified_test: "bg-orange-50 text-orange-700 ring-orange-200",
    hold_test: "bg-red-50 text-red-700 ring-red-200",
  };
  const labels = {
    full_test: "Đánh giá đầy đủ",
    modified_test: "Đánh giá có điều chỉnh",
    hold_test: "Hoãn đánh giá",
  };
  if (!value) return null;
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${styles[value] || "bg-slate-100 text-slate-700 ring-slate-200"
        }`}
    >
      {labels[value] || value}
    </span>
  );
};

const ReasonCard = ({ title, items = [], tone = "red" }) => {
  if (!items.length) return null;
  const toneMap = {
    red: {
      bg: "bg-red-50",
      border: "border-red-100",
      text: "text-red-800",
      icon: "text-red-500",
    },
    orange: {
      bg: "bg-orange-50",
      border: "border-orange-100",
      text: "text-orange-800",
      icon: "text-orange-500",
    },
  };
  const current = toneMap[tone] || toneMap.red;
  return (
    <div
      className={`mt-5 rounded-xl border ${current.border} ${current.bg} p-4`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className={current.icon} />
        <p className={`font-bold ${current.text}`}>{title}</p>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-white/80 bg-white/70 p-3 text-sm shadow-sm"
          >
            <p className="font-medium text-slate-800">{item.label}</p>
            {Array.isArray(item.values) && item.values.length > 0 ? (
              <p className="mt-1 text-slate-600">{item.values.join(", ")}</p>
            ) : (
              <p className="mt-1 text-slate-600">
                {item.value || "Cần kiểm tra thêm"}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const F1CustomerDetail = ({
  customer,
  onBack,
  onStartIntake,
  onStartAssessment,
  onOpenAiReport,
  onOpenResultPrediction,
  onDelete,
  deleting = false,
  reviewingTestPermission = false,
  onReviewTestPermission,
}) => {
  if (!customer) return null;

  const intakeDone = [
    "intake_completed",
    "testing_completed",
    "assessment_completed",
    "ai_report_generated",
  ].includes(customer.status);

  const assessmentDone = [
    "testing_completed",
    "assessment_completed",
    "ai_report_generated",
  ].includes(customer.status);

  const reportDone = ["ai_report_generated"].includes(customer.status);
  const resultPredictionDone = Boolean(customer.lastResultPredictionId);
  const canOpenAssessment =
    [
      "intake_completed",
      "testing_completed",
      "assessment_completed",
      "ai_report_generated",
    ].includes(customer.status) && customer.testPermission !== "hold_test";
  const canOpenAiReport = [
    "testing_completed",
    "assessment_completed",
    "ai_report_generated",
  ].includes(customer.status);
  const canOpenResultPrediction = ["ai_report_generated"].includes(
    customer.status,
  );

  return (
    <section className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
      <button
        onClick={onBack}
        className="group inline-flex items-center gap-2 text-slate-500 transition hover:text-orange-600"
      >
        <ArrowLeft
          size={18}
          className="transition-transform group-hover:-translate-x-1"
        />
        Quay lại danh sách
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/30">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-6 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">{customer.code || "--"}</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 uppercase">
                {customer.fullName}
              </h2>
              <p className="mt-1 text-slate-500">
                {customer.occupation || "Chưa có nghề nghiệp"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <StatusBadge value={customer.status || "new"} />
                <ReadinessBadge value={customer.readinessStatus || "pending"} />
                <PermissionBadge value={customer.testPermission} />
              </div>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 size={16} />
                {deleting ? "Đang xóa..." : "Xóa khách hàng"}
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 md:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="Tuổi" value={customer.age} />
            <InfoItem label="Giới tính" value={customer.gender} />
            <InfoItem label="Số điện thoại" value={customer.phone} />
            <InfoItem label="Email" value={customer.email} />
          </div>

          <ReasonCard
            title="Lý do khách đang được tạm hoãn test"
            items={customer.holdReasons || []}
            tone="red"
          />
          <ReasonCard
            title="Những điểm cần lưu ý khi test có điều chỉnh"
            items={customer.cautionReasons || []}
            tone="orange"
          />

          <F1TestPermissionReviewCard
            customer={customer}
            submitting={reviewingTestPermission}
            onSubmit={onReviewTestPermission}
          />

          <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50/30 p-5">
            <p className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
              Tiến trình khách F1
            </p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
              <ProgressCard title="Hồ sơ cơ bản" done />
              <ProgressCard title="Khảo sát" done={intakeDone} />
              <ProgressCard title="Đánh giá thể chất" done={assessmentDone} />
              <ProgressCard title="AI Report" done={reportDone} />
              <ProgressCard
                title="Dự đoán kết quả"
                done={resultPredictionDone}
              />
            </div>
          </div>

          <div className="mt-8 flex w-full flex-nowrap gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={onStartIntake}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-3 font-bold text-white shadow-md transition hover:shadow-lg"
            >
              <ClipboardList size={18} />
              Bắt đầu khảo sát
            </button>
            <button
              onClick={onStartAssessment}
              disabled={!canOpenAssessment}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Activity size={18} />
              Đánh giá thể chất
            </button>
            <button
              onClick={onOpenAiReport}
              disabled={!canOpenAiReport}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Sparkles size={18} />
              AI Report
            </button>
            <button
              onClick={onOpenResultPrediction}
              disabled={!canOpenResultPrediction}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <TrendingUp size={18} />
              Dự đoán kết quả
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default F1CustomerDetail;

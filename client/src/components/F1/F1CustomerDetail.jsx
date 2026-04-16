import {
  ArrowLeft,
  ClipboardList,
  Activity,
  Sparkles,
  TrendingUp,
  Trash2,
  AlertTriangle,
  Image as ImageIcon,
} from "lucide-react";
import F1TestPermissionReviewCard from "./F1TestPermissionReviewCard";

const InfoItem = ({ label, value }) => {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value || "--"}</p>
    </div>
  );
};

const ProgressCard = ({ title, done }) => {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          done ? "text-emerald-700" : "text-slate-700"
        }`}
      >
        {title}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {done ? "Đã hoàn tất" : "Chưa hoàn tất"}
      </p>
    </div>
  );
};

const StatusBadge = ({ value }) => {
  const map = {
    new: "Mới tạo",
    intake_in_progress: "Đang intake",
    intake_completed: "Đã intake",
    testing_completed: "Đã đánh giá thể chất",
    assessment_completed: "Đã đánh giá thể chất",
    ai_report_generated: "Đã có AI report",
    archived: "Lưu trữ",
  };

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {map[value] || value}
    </span>
  );
};

const ReadinessBadge = ({ value }) => {
  const styles = {
    pending: "bg-amber-100 text-amber-700",
    ready: "bg-emerald-100 text-emerald-700",
    caution: "bg-orange-100 text-orange-700",
    hold: "bg-red-100 text-red-700",
  };

  const labels = {
    pending: "Pending",
    ready: "Ready",
    caution: "Caution",
    hold: "Hold",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[value] || "bg-slate-100 text-slate-700"
      }`}
    >
      {labels[value] || value}
    </span>
  );
};

const PermissionBadge = ({ value }) => {
  const styles = {
    full_test: "bg-emerald-100 text-emerald-700",
    modified_test: "bg-orange-100 text-orange-700",
    hold_test: "bg-red-100 text-red-700",
  };

  const labels = {
    full_test: "Full Test",
    modified_test: "Modified Test",
    hold_test: "Hold Test",
  };

  if (!value) return null;

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[value] || "bg-slate-100 text-slate-700"
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
      wrap: "border-red-200 bg-red-50",
      title: "text-red-700",
      item: "border-red-100 bg-white",
    },
    orange: {
      wrap: "border-orange-200 bg-orange-50",
      title: "text-orange-700",
      item: "border-orange-100 bg-white",
    },
  };

  const currentTone = toneMap[tone] || toneMap.red;

  return (
    <div className={`mt-4 rounded-2xl border p-4 ${currentTone.wrap}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className={currentTone.title} />
        <p className={`font-semibold ${currentTone.title}`}>{title}</p>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div
            key={`${item.field}-${index}`}
            className={`rounded-xl border px-3 py-2 text-sm text-slate-700 ${currentTone.item}`}
          >
            <p className="font-medium">{item.label}</p>

            {Array.isArray(item.values) && item.values.length > 0 ? (
              <p className="mt-1">{item.values.join(", ")}</p>
            ) : (
              <p className="mt-1">{item.value || "Cần kiểm tra thêm"}</p>
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
    <section className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        Quay lại danh sách
      </button>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm text-slate-500">{customer.code || "--"}</p>
            <h2 className="text-2xl font-bold text-slate-900">
              {customer.fullName}
            </h2>
            <p className="mt-1 text-slate-500">
              {customer.occupation || "Chưa có nghề nghiệp"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge value={customer.status || "new"} />
            <ReadinessBadge value={customer.readinessStatus || "pending"} />
            <PermissionBadge value={customer.testPermission} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 text-sm md:grid-cols-2">
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

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">
            Tiến trình khách F1
          </p>

          <div className="grid gap-3 md:grid-cols-6">
            <ProgressCard title="Hồ sơ cơ bản" done />
            <ProgressCard title="Intake" done={intakeDone} />
            <ProgressCard title="Đánh giá thể chất" done={assessmentDone} />
            <ProgressCard title="AI Report" done={reportDone} />
            <ProgressCard title="Dự đoán kết quả" done={resultPredictionDone} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onStartIntake}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1C2D42] px-4 py-3 font-semibold text-white hover:opacity-90"
          >
            <ClipboardList size={18} />
            Bắt đầu intake
          </button>

          <button
            onClick={onStartAssessment}
            disabled={!canOpenAssessment}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 disabled:opacity-50"
          >
            <Activity size={18} />
            Đánh giá thể chất
          </button>

          <button
            onClick={onOpenAiReport}
            disabled={!canOpenAiReport}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 disabled:opacity-50"
          >
            <Sparkles size={18} />
            AI Report
          </button>

          <button
            onClick={onOpenResultPrediction}
            disabled={!canOpenResultPrediction}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 disabled:opacity-50"
          >
            <TrendingUp size={18} />
            Dự đoán kết quả
          </button>

          <button
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            <Trash2 size={18} />
            {deleting ? "Đang xóa..." : "Xóa khách hàng"}
          </button>
        </div>
      </div>
    </section>
  );
};

export default F1CustomerDetail;

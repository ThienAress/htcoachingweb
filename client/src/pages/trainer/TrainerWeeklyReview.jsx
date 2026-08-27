const STATUS_LABELS = {
  submitted: "Đã gửi",
  reviewed: "Đã gửi",
};
const WEEKLY_MEASUREMENTS = [
  ["weightKg", "Cân nặng", "kg"],
  ["waistCm", "Vòng eo", "cm"],
  ["bodyFatPercent", "Tỷ lệ mỡ cơ thể", "%"],
  ["skeletalMusclePercent", "Tỷ lệ cơ xương", "%"],
];

export const TrainerWeeklyMeasurements = ({ body = {} }) => (
  <dl className="mt-4 grid gap-px overflow-hidden rounded-xl bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
    {WEEKLY_MEASUREMENTS.map(([key, label, unit]) => {
      const value = Number(body[key]);
      const available = body[key] !== null && body[key] !== undefined && Number.isFinite(value);
      return (
        <div key={key} className="bg-slate-950 px-4 py-3">
          <dt className="text-xs font-semibold text-slate-500">{label}</dt>
          <dd className="mt-1 text-sm font-bold text-slate-100">
            {available
              ? `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${unit}`
              : "Chưa ghi"}
          </dd>
        </div>
      );
    })}
  </dl>
);

export const TrainerWeeklyReview = ({ checkin }) => {
  if (!checkin) {
    return (
      <section className="rounded-2xl border border-gray-700/50 bg-gray-950/40 p-5">
        <h3 className="font-bold text-white">Báo cáo tuần</h3>
        <p className="mt-2 text-sm text-gray-400">
          Học viên chưa gửi báo cáo tuần hiện tại.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-700/50 bg-gray-950/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-bold text-white">Báo cáo tuần</h3>
        <span className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300">
          {STATUS_LABELS[checkin.status] || "Bản nháp"}
        </span>
      </div>
      <TrainerWeeklyMeasurements body={checkin.body} />
    </section>
  );
};

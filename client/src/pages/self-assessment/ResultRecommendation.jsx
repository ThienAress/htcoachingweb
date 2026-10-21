import { Link } from "react-router-dom";

import {
  INSIGHT_STATUS_LABELS,
  INTENSITY_LABELS,
  LEVEL_TONES,
  TRAINING_STATUS_LABELS,
} from "./constants";

const Card = ({ title, children }) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
    <h3 className="text-base font-bold text-white">{title}</h3>
    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">{children}</div>
  </section>
);

const Row = ({ label, value }) => (
  <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
    <dt className="text-slate-400">{label}</dt>
    <dd className="font-semibold text-white">{value}</dd>
  </div>
);

const span = (range, unit = "") => `${range.min}-${range.max}${unit}`;

export const InsightsCard = ({ insights = [] }) =>
  insights.length === 0 ? null : (
    <Card title="Chỉ số cơ thể">
      <ul className="space-y-3">
        {insights.map((item) => (
          <li key={item.key}>
            <p className="font-semibold text-white">
              {item.label}: {item.value}{" "}
              <span className="ml-1 rounded-full border border-slate-600 px-2 py-0.5 text-xs font-medium text-slate-300">
                {INSIGHT_STATUS_LABELS[item.status] || ""}
              </span>
            </p>
            <p className="text-slate-400">{item.message}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">Các chỉ số chỉ mang tính tham khảo, không phải chẩn đoán y khoa.</p>
    </Card>
  );

export const CautionsCard = ({ cautions = [] }) =>
  cautions.length === 0 ? null : (
    <Card title="Lưu ý an toàn">
      <ul className="list-disc space-y-1 pl-5">
        {cautions.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Card>
  );

const ReferencesCard = ({ references = [] }) => (
  <details className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
    <summary className="cursor-pointer font-semibold text-slate-300">Nguồn tham khảo</summary>
    <ul className="mt-3 list-disc space-y-1 pl-5">
      {references.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  </details>
);

const Recommendation = ({ recommendation }) => {
  const r = recommendation;
  return (
    <div className="space-y-4">
      <Card title="Giai đoạn bắt đầu">
        <p className="font-semibold text-white">{r.startPhase.label}</p>
        <ul className="list-disc space-y-1 pl-5 text-slate-400">
          {r.startPhase.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="text-slate-400">
          Bạn thuộc nhóm: {TRAINING_STATUS_LABELS[r.trainingStatus] || "Đang tập"}.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Lịch tập trong tuần">
          <dl className="space-y-1">
            <Row label="Số buổi gợi ý" value={`${r.weeklyPlan.daysPerWeek} buổi/tuần`} />
            <Row label="Khoảng phù hợp" value={`${span(r.weeklyPlan.recommendedRange)} buổi/tuần`} />
            <Row label="Cách chia buổi" value={r.weeklyPlan.split} />
          </dl>
          <ul className="list-disc space-y-1 pl-5 text-slate-400">
            {r.weeklyPlan.sessionTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </Card>

        <Card title="Tập sức mạnh">
          <dl className="space-y-1">
            <Row label="Số hiệp mỗi bài (sets)" value={span(r.resistance.setsPerExercise)} />
            <Row label="Số lần mỗi hiệp (reps)" value={span(r.resistance.repRange)} />
            <Row label="Còn dư bao nhiêu lần (RIR)" value={span(r.resistance.rir)} />
            <Row label="Nghỉ giữa hiệp" value={span(r.resistance.restSeconds, " giây")} />
            <Row label="Tổng hiệp mỗi nhóm cơ/tuần" value={span(r.resistance.weeklySetsPerMuscle)} />
          </dl>
        </Card>

        <Card title="Tim phổi">
          <dl className="space-y-1">
            <Row label="Thời lượng mỗi tuần" value={span(r.cardio.weeklyMinutes, " phút")} />
            <Row label="Cường độ" value={INTENSITY_LABELS[r.cardio.intensity]} />
            {r.cardio.heartRateZones && (
              <>
                <Row label="Vùng nhịp tim vừa" value={span(r.cardio.heartRateZones.moderate, " lần/phút")} />
                <Row label="Vùng nhịp tim mạnh" value={span(r.cardio.heartRateZones.vigorous, " lần/phút")} />
              </>
            )}
          </dl>
          <p className="text-slate-400">{r.cardio.intensityNote}</p>
        </Card>

        <Card title="Dinh dưỡng">
          <dl className="space-y-1">
            <Row label="Đạm mỗi ngày (g/kg)" value={span(r.nutrition.proteinGPerKg)} />
            {r.nutrition.proteinGramsPerDay && (
              <Row label="Tương đương" value={span(r.nutrition.proteinGramsPerDay, " g/ngày")} />
            )}
          </dl>
          <p className="text-slate-400">{r.nutrition.energyAdjustment}</p>
          {r.nutrition.cautions.map((item) => (
            <p key={item} className="text-amber-200">{item}</p>
          ))}
          <p className="flex flex-wrap gap-3 pt-1">
            <Link className="font-semibold text-orange-300 underline-offset-2 hover:underline" to={r.nutrition.tools.tdee}>
              Tính TDEE
            </Link>
            <Link className="font-semibold text-orange-300 underline-offset-2 hover:underline" to={r.nutrition.tools.mealPlan}>
              Lập thực đơn
            </Link>
          </p>
        </Card>

        <Card title="Hồi phục và vận động hằng ngày">
          <dl className="space-y-1">
            <Row label="Giấc ngủ gợi ý" value={span(r.recovery.sleepTargetHours, " giờ/đêm")} />
            <Row label="Bước chân mỗi ngày" value={span(r.dailyActivity.stepsTarget)} />
          </dl>
          {r.recovery.notes.map((note) => (
            <p key={note} className="text-slate-400">{note}</p>
          ))}
        </Card>

        <Card title="Nhóm nên ưu tiên">
          <ul className="space-y-3">
            {r.focusAreas.map((area) => (
              <li key={area.metric}>
                <p className="font-semibold text-white">
                  {area.label}
                  <span className={`ml-2 rounded-full border px-2 py-0.5 text-xs ${LEVEL_TONES[area.level] || "border-slate-600 text-slate-300"}`}>
                    {area.levelLabel}
                  </span>
                </p>
                <p className="text-slate-400">{area.exercises.join(", ")}</p>
              </li>
            ))}
          </ul>
          <Link className="inline-block pt-1 font-semibold text-orange-300 underline-offset-2 hover:underline" to={r.libraryPath}>
            Mở thư viện bài tập
          </Link>
        </Card>
      </div>

      <InsightsCard insights={r.insights} />
      <CautionsCard cautions={r.cautions} />
      <ReferencesCard references={r.references} />
    </div>
  );
};

export default Recommendation;

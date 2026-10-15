import { AlertTriangle, CalendarDays } from "lucide-react";
import {
  PHASE_EXPLANATIONS,
  PHASE_NAMES,
  translateTrainingFocus,
} from "../../../constants/f1Phases";
import {
  COMPONENT_LABELS,
  DECISION_META,
  formatDelta,
  formatNumber,
} from "../../../utils/f1PhaseReview";

const METRICS = [
  ["weightKg", "Cân nặng", "kg"],
  ["waistCm", "Vòng eo", "cm"],
  ["hipCm", "Vòng hông", "cm"],
  ["bodyFatPercent", "Tỷ lệ mỡ", "%"],
  ["restingHeartRate", "Nhịp tim nghỉ", "bpm"],
];

const TONES = {
  good: { ring: "#16a34a", pill: "bg-green-50 text-green-700" },
  warn: { ring: "#d97706", pill: "bg-amber-50 text-amber-700" },
  bad: { ring: "#dc2626", pill: "bg-red-50 text-red-700" },
};

const SOURCES = [
  ["NHLBI: mục tiêu ~10% cân nặng trong ~6 tháng rồi giữ cân", "https://www.nhlbi.nih.gov/health/educational/lose_wt/guidelines.htm"],
  ["WHO 2020: 150–300 phút vận động mỗi tuần", "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7719906/"],
  ["Hall, Lancet 2011: giảm cân chậm dần theo thời gian", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593"],
  ["Reimers 2018: tập luyện và nhịp tim nghỉ", "https://www.mdpi.com/2077-0383/7/12/503/htm"],
  ["NASM: chuyển giai đoạn theo năng lực từng người", "https://blog.nasm.org/opt-model-phase-1"],
];

const withUnit = (value, unit) => (formatNumber(value) === "--" ? "--" : `${formatNumber(value)} ${unit}`);

const Section = ({ title, children }) => (
  <section className="space-y-3">
    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
    {children}
  </section>
);

const ScoreRing = ({ total, color }) => (
  <div
    className="grid h-36 w-36 shrink-0 place-items-center rounded-full"
    style={{ background: `conic-gradient(${color} ${total}%, #e2e8f0 0)` }}
  >
    <div className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-full bg-white text-center">
      <span className="text-3xl font-black leading-none text-slate-800">{formatNumber(total)}%</span>
      <span className="max-w-[5.5rem] text-xs leading-tight text-slate-500">mức hoàn thành</span>
    </div>
  </div>
);

const pickGaps = (gaps = [], total, target) => {
  const picked = [];
  let sum = total;
  for (const gap of gaps) {
    if (sum >= target) break;
    picked.push(gap);
    sum += gap.points;
  }
  return picked;
};

const List = ({ items = [] }) =>
  items.length ? (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {item}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-slate-500">Không có</p>
  );

export const F1NextStagePlan = ({ review }) => {
  const plan = review.nextPhasePlan || {};
  const outcome = review.nextOutcome || {};
  const nextStart = outcome.baseline || {};
  const checkpoint = outcome.checkpoint || {};

  return (
    <>
      <Section title={`Kế hoạch giai đoạn ${plan.stageOrder}: ${PHASE_NAMES[plan.phaseKey] || plan.phaseTitle || ""}`}>
        <div className="rounded-lg bg-orange-50 p-4 text-sm text-slate-700">
          <p className="inline-flex items-center gap-2 font-semibold text-orange-800">
            <CalendarDays size={16} aria-hidden="true" />
            {plan.durationWeeks} tuần
          </p>
          {PHASE_EXPLANATIONS[plan.phaseKey] && <p className="mt-2">{PHASE_EXPLANATIONS[plan.phaseKey]}</p>}
          <p className="mt-2">{plan.objective}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-slate-500">Mang theo từ giai đoạn trước</p>
            <List items={plan.carryOver} />
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-slate-500">Trọng tâm chính</p>
            <List items={translateTrainingFocus(plan.keyFocus || [])} />
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-slate-500">Khi nào đánh giá lại</p>
            <List items={plan.exitCriteria} />
          </div>
        </div>
      </Section>

      <Section title={`Dự đoán giai đoạn ${plan.stageOrder} (bắt đầu từ số đo thực tế)`}>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[30rem] text-left text-sm tabular-nums">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {["Chỉ số", "Đầu giai đoạn", "Cuối giai đoạn (dự kiến)", "Thay đổi"].map((head) => (
                  <th key={head} className="px-4 py-2.5 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {METRICS.map(([key, label, unit]) => {
                const range = checkpoint.projectedRange?.[key];
                return (
                  <tr key={key}>
                    <td className="px-4 py-2.5 text-slate-600">{label}</td>
                    <td className="px-4 py-2.5">{withUnit(nextStart[key], unit)}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">
                      {withUnit(checkpoint.projected?.[key], unit)}
                      {range && (
                        <span className="block text-xs font-normal text-slate-500">
                          {formatNumber(range.min)}–{formatNumber(range.max)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{formatDelta(checkpoint.deltaFromBaseline?.[key])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {[outcome.projectionNote, outcome.goalProgress?.summary].filter(Boolean).map((text) => (
          <p key={text} className="text-sm text-slate-600">{text}</p>
        ))}
      </Section>

    </>
  );
};

const F1PhaseReviewResult = ({ review, showNext = true }) => {
  const evaluation = review.evaluation || {};
  const plan = review.nextPhasePlan || {};
  const decision = DECISION_META[evaluation.decision] || DECISION_META.coach_review;
  const tone = TONES[decision.tone];
  const target = evaluation.total < 80 ? 80 : 90;
  const gaps = evaluation.total < 90 ? pickGaps(evaluation.gaps, evaluation.total, target) : [];
  const start = evaluation.start || {};
  const projected = evaluation.projected || {};

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 md:flex-row md:items-center">
        <ScoreRing total={evaluation.total || 0} color={tone.ring} />
        <div className="min-w-0 flex-1 space-y-3">
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${tone.pill}`}>{decision.label}</span>
          <p className="text-sm text-slate-700">{plan.entryReason}</p>
          {Object.entries(evaluation.breakdown || {}).map(([key, part]) =>
            part ? (
              <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(10rem,14rem)_1fr_4.5rem]">
                <span className="col-start-1 row-start-1 text-sm font-medium text-slate-700">{COMPONENT_LABELS[key]}</span>
                <div className="col-span-2 row-start-2 h-2.5 overflow-hidden rounded-full bg-slate-200 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                  <div className="h-full rounded-full bg-orange-500" style={{ width: `${(part.points / part.max) * 100}%` }} />
                </div>
                <span className="col-start-2 row-start-1 text-right text-sm font-semibold tabular-nums text-slate-800 sm:col-start-3">
                  {formatNumber(part.points)}/{part.max}
                </span>
              </div>
            ) : null,
          )}
          <p className="text-xs text-slate-500">≥ 80%: chuyển giai đoạn · 60–79%: kéo dài 2–4 tuần · dưới 60%: lặp lại giai đoạn</p>
        </div>
      </section>

      {[...(evaluation.warnings || []), evaluation.safetyNote ? `Ghi chú an toàn: ${evaluation.safetyNote}` : ""]
        .filter(Boolean)
        .map((text) => (
          <p key={text} className="flex gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={18} className="shrink-0" aria-hidden="true" />
            {text}
          </p>
        ))}

      <Section title={`Giai đoạn ${review.stageOrder}: dự kiến và thực tế`}>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[34rem] text-left text-sm tabular-nums">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {["Chỉ số", "Đầu giai đoạn", "Dự kiến", "Thực tế", "Thay đổi"].map((head) => (
                  <th key={head} className="px-4 py-2.5 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {METRICS.map(([key, label, unit]) => (
                <tr key={key}>
                  <td className="px-4 py-2.5 text-slate-600">{label}</td>
                  <td className="px-4 py-2.5">{withUnit(start[key], unit)}</td>
                  <td className="px-4 py-2.5">{withUnit(projected[key], unit)}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{withUnit(review.actual?.[key], unit)}</td>
                  <td className="px-4 py-2.5">
                    {review.actual?.[key] != null && start[key] != null ? formatDelta(review.actual[key] - start[key]) : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {gaps.length > 0 && (
        <Section title={`Để đạt ${target}%`}>
          <ul className="space-y-2">
            {gaps.map((gap) => (
              <li key={gap.text} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span>{gap.text}</span>
                <span className="shrink-0 font-semibold text-orange-700">+{formatNumber(gap.points)} điểm</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {showNext && <F1NextStagePlan review={review} />}

      <section className="space-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-600">Cơ sở tham khảo</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {SOURCES.map(([label, href]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-slate-700">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <p>
          Ngưỡng 80% là quy ước của hệ thống để HLV dễ theo dõi, không phải chuẩn y khoa. Dự đoán chỉ để tham khảo, không thay
          tư vấn y tế. Muốn giảm nhanh hơn, khách trao đổi trực tiếp với HLV.
        </p>
      </section>
    </div>
  );
};

export default F1PhaseReviewResult;

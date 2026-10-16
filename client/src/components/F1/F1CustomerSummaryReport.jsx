// F1CustomerSummaryReport.jsx — "Báo cáo tổng quát khách hàng" dạng hộp thoại giữa màn hình
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  getLatestAssessment,
  getLatestIntake,
  getLatestResultPrediction,
  getPhaseReviews,
} from "../../services/f1Customer.service";
import { PHASE_NAMES, buildStageTabs } from "../../constants/f1Phases";
import F1WeeklyScheduleView from "./stageDesign/F1WeeklyScheduleView";
import { phaseReviewsQueryKey } from "../../utils/f1PhaseReview";
import F1PhaseReviewResult, {
  F1NextStagePlan,
} from "./phaseReview/F1PhaseReviewResult";
import { useModalScrollLock } from "../../hooks/useModalScrollLock";
import {
  F1_EXPERIENCE_LABELS,
  F1_GOAL_LABELS,
  F1_LEVEL_LABELS,
  F1_POSTURE_LABELS,
  F1_STRESS_LABELS,
  F1_WARNING_SIGN_LABELS,
  F1_WORK_ACTIVITY_LABELS,
  getF1GenderLabel,
  labelOf,
} from "../../constants/f1Labels";

const yesNo = (value) => (value ? "Có" : "Không");
const textOrNone = (value) => (String(value || "").trim() ? value : "Không có");
const list = (items = [], map = {}) =>
  items.length ? items.map((item) => labelOf(map, item)).join(", ") : "Không có";

const Item = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium text-slate-500">{label}</dt>
    <dd className="mt-0.5 break-words text-sm font-semibold text-slate-800">
      {children || "--"}
    </dd>
  </div>
);

const Group = ({ title, children }) => (
  <section className="rounded-xl border border-slate-200 p-5">
    <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-orange-600">
      {title}
    </h3>
    {children}
  </section>
);

const Grid = ({ children }) => (
  <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
);

const LevelChip = ({ level }) => {
  const tone = {
    good: "bg-emerald-50 text-emerald-700",
    average: "bg-emerald-50 text-emerald-700",
    below_average: "bg-amber-50 text-amber-700",
    low: "bg-red-50 text-red-700",
  }[level];
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
        tone || "bg-slate-100 text-slate-600"
      }`}
    >
      {F1_LEVEL_LABELS[level] || "Chưa đánh giá"}
    </span>
  );
};

const METRIC_ROWS = [
  ["Sức mạnh đẩy thân trên (Upper Push)", "strengthAssessment", "upperBodyPush"],
  ["Sức mạnh kéo thân trên (Upper Pull)", "strengthAssessment", "upperBodyPull"],
  ["Sức mạnh thân dưới (Lower Body)", "strengthAssessment", "lowerBody"],
  ["Sức mạnh cơ lõi (Core)", "strengthAssessment", "coreStrength"],
  ["Sức bền cơ bắp (Muscular Endurance)", "enduranceAssessment", "muscularEndurance"],
  ["Sức bền cơ lõi (Core Endurance)", "enduranceAssessment", "coreEndurance"],
  ["Năng lực tim mạch (Cardio Capacity)", "cardioAssessment", "cardioCapacity"],
  ["Hồi phục nhịp tim (Heart Rate Recovery)", "cardioAssessment", "recoveryHeartRate"],
];

const ohsaRows = (ohsa = {}) =>
  [
    ["Mặt trước", "anterior"],
    ["Mặt bên", "lateral"],
    ["Mặt sau", "posterior"],
  ].map(([label, view]) => {
    const issues = ohsa[view] || [];
    if (issues.length) {
      return { label, result: list(issues, F1_POSTURE_LABELS), tone: "warn" };
    }
    return ohsa[`${view}Normal`]
      ? { label, result: "Không có biểu hiện sai", tone: "ok" }
      : { label, result: "Chưa đánh giá", tone: "idle" };
  });

const resultToneClass = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  idle: "text-slate-500",
};

const HealthLifeGroup = ({ health = {}, life = {} }) => (
    <Group title="Sức khỏe và lối sống">
      <Grid>
        <Item label="Đau hoặc khó chịu hiện tại">
          {health.hasPainNow
            ? `${list(health.painLocation)} · mức ${health.painLevel ?? 0}/10`
            : "Không"}
        </Item>
        <Item label="Chấn thương cần lưu ý">{textOrNone(health.injuries)}</Item>
        <Item label="Bệnh lý hiện tại">{textOrNone(health.currentConditions)}</Item>
        <Item label="Phẫu thuật">{textOrNone(health.surgeries)}</Item>
        <Item label="Thuốc đang dùng">{textOrNone(health.medications)}</Item>
        <Item label="Hạn chế do bác sĩ">{textOrNone(health.doctorRestrictions)}</Item>
        <Item label="Dấu hiệu cảnh báo">
          {list(health.warningSigns, F1_WARNING_SIGN_LABELS)}
        </Item>
        <Item label="Giấc ngủ">{life.sleepHours ? `${life.sleepHours} giờ/ngày` : ""}</Item>
        <Item label="Mức căng thẳng">{labelOf(F1_STRESS_LABELS, life.stressLevel, "")}</Item>
        <Item label="Vận động trong công việc">
          {labelOf(F1_WORK_ACTIVITY_LABELS, life.workActivityLevel, "")}
        </Item>
        <Item label="Bữa ăn mỗi ngày">{life.mealsPerDay}</Item>
        <Item label="Ăn ngoài thường xuyên">{yesNo(life.usuallyEatOut)}</Item>
        <Item label="Uống đủ nước">{yesNo(life.drinkEnoughWater)}</Item>
        <Item label="Dị ứng thực phẩm">{textOrNone(life.foodAllergies)}</Item>
      </Grid>
    </Group>
);

const GoalGroup = ({ goal = {} }) => (
    <Group title="Mục tiêu và tập luyện">
      <Grid>
        <Item label="Mục tiêu chính">{labelOf(F1_GOAL_LABELS, goal.primaryGoal, "")}</Item>
        <Item label="Cân nặng mong muốn">
          {goal.targetWeightKg ? `${goal.targetWeightKg} kg` : ""}
        </Item>
        <Item label="Thời gian mong muốn">{goal.targetTimeframe}</Item>
        <Item label="Đang tập luyện">{yesNo(goal.currentlyTraining)}</Item>
        <Item label="Kinh nghiệm">
          {labelOf(F1_EXPERIENCE_LABELS, goal.trainingExperience, "")}
        </Item>
        <Item label="Đã nghỉ tập">{goal.breakDuration}</Item>
        <Item label="Số buổi mỗi tuần">{goal.trainingDaysPerWeek}</Item>
        <Item label="Thời lượng mỗi buổi">
          {goal.sessionDurationMinutes ? `${goal.sessionDurationMinutes} phút` : ""}
        </Item>
        <Item label="Các môn từng tập">{list(goal.sportsHistory)}</Item>
      </Grid>
    </Group>
);

// Giai đoạn 2 trở đi chỉ hiện các số đo mới; họ tên, tuổi, giới tính, chiều cao... không đổi nên bỏ qua.
const LatestBodyGroup = ({ actual = {} }) => (
  <Group title="Thông tin khách hàng">
    <Grid>
      <Item label="Cân nặng · BMI">
        {actual.weightKg ? `${actual.weightKg} kg${actual.bmi ? ` · ${actual.bmi}` : ""}` : ""}
      </Item>
      <Item label="Vòng eo">{actual.waistCm ? `${actual.waistCm} cm` : ""}</Item>
      <Item label="Vòng hông">{actual.hipCm ? `${actual.hipCm} cm` : ""}</Item>
      <Item label="Tỷ lệ mỡ">{actual.bodyFatPercent ? `${actual.bodyFatPercent}%` : ""}</Item>
      <Item label="Nhịp tim nghỉ">{actual.restingHeartRate ? `${actual.restingHeartRate} bpm` : ""}</Item>
    </Grid>
  </Group>
);

const AssessmentGroup = ({ assessment }) => {
  if (!assessment) {
    return (
      <Group title="Đánh giá thể chất">
        <p className="py-4 text-center text-sm text-slate-500">
          <strong className="block text-slate-700">Chưa đánh giá thể chất</strong>
          Kết quả sẽ hiện ở đây sau khi lưu đánh giá thể chất.
        </p>
      </Group>
    );
  }
  const posture = assessment.postureAssessment || {};
  return (
    <Group title="Đánh giá thể chất">
      <Grid>
        <Item label="Mức thể chất tổng thể">
          <LevelChip level={assessment.overallPhysicalLevel} />
        </Item>
        <Item label="Nhịp tim nghỉ">
          {assessment.cardioAssessment?.restingHeartRate
            ? `${assessment.cardioAssessment.restingHeartRate} nhịp/phút`
            : ""}
        </Item>
        <Item label="Tư thế tĩnh">
          {[posture.feetAnkles, posture.knees, posture.lphc, posture.shouldersThoracic, posture.headNeck]
            .filter((value) => value && value !== "normal")
            .map((value) => labelOf(F1_POSTURE_LABELS, value))
            .join(", ") || "Bình thường"}
        </Item>
      </Grid>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 px-4 py-2">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[38%]" />
            <col className="w-[17%]" />
            <col className="w-[17%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">
                Squat tay qua đầu (Overhead Squat)
              </th>
              <th className="py-2 pr-3 font-medium">Kết quả</th>
              <th colSpan={2} className="py-2" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {ohsaRows(assessment.movementAssessment?.overheadSquat).map((row) => (
              <tr key={row.label} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3 font-medium text-slate-800">
                  Góc nhìn {row.label.toLowerCase()}
                </td>
                <td className={`py-2 pr-3 font-semibold ${resultToneClass[row.tone]}`}>
                  {row.result}
                </td>
                <td colSpan={2} aria-hidden="true" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 px-4 py-2">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[38%]" />
            <col className="w-[17%]" />
            <col className="w-[17%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Hạng mục</th>
              <th className="py-2 pr-3 font-medium">Bài đã test</th>
              <th className="py-2 pr-3 font-medium">Điểm đánh giá</th>
              <th className="py-2 font-medium">Độ khó</th>
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map(([label, group, key]) => {
              const metric = assessment[group]?.[key] || {};
              const names = (metric.exercises || []).map((item) => item.name);
              return (
                <tr key={key} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-medium text-slate-800">{label}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {names.join(" · ") || "--"}
                  </td>
                  <td className="py-2 pr-3 font-semibold text-slate-800">
                    {metric.score !== null && metric.score !== undefined && metric.score !== ""
                      ? `${metric.score}/10`
                      : "--"}
                  </td>
                  <td className="py-2">
                    <LevelChip level={metric.level} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {assessment.assessorNotes && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ghi chú HLV: {assessment.assessorNotes}
        </p>
      )}
    </Group>
  );
};

const F1CustomerSummaryReport = ({
  customer,
  onClose,
  onContinue,
  continueLabel,
}) => {
  const closeRef = useRef(null);
  useModalScrollLock(true);

  const intakeQuery = useQuery({
    queryKey: ["f1-summary-intake", customer?._id, customer?.lastIntakeId],
    queryFn: () => getLatestIntake(customer._id),
    enabled: Boolean(customer?._id),
  });
  const assessmentQuery = useQuery({
    queryKey: ["f1-summary-assessment", customer?._id, customer?.lastAssessmentId],
    queryFn: () => getLatestAssessment(customer._id),
    enabled: Boolean(customer?._id),
  });

  const predictionQuery = useQuery({
    queryKey: ["f1-summary-prediction", customer?._id, customer?.lastResultPredictionId],
    queryFn: () => getLatestResultPrediction(customer._id),
    enabled: Boolean(customer?._id && customer?.lastResultPredictionId),
  });
  const prediction = predictionQuery.data?.data || null;
  const reviewsQuery = useQuery({
    queryKey: phaseReviewsQueryKey(customer?._id),
    queryFn: () => getPhaseReviews(customer._id),
    enabled: Boolean(customer?._id && prediction?._id),
  });
  const reviews = useMemo(
    () => reviewsQuery.data?.data?.reviews || [],
    [reviewsQuery.data],
  );
  const stageTabs = useMemo(
    () =>
      buildStageTabs(prediction?.phaseRoadmap || [], reviews).filter(
        (tab) => !tab.locked,
      ),
    [prediction, reviews],
  );
  const [activeStage, setActiveStage] = useState(1);
  const stageOrder = stageTabs.some((tab) => tab.stageOrder === activeStage)
    ? activeStage
    : 1;
  const reviewOfStage = reviews.find((item) => item.stageOrder === stageOrder);
  const reviewBefore = reviews.find((item) => item.stageOrder === stageOrder - 1);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const intake = intakeQuery.data?.data || null;
  const assessment = assessmentQuery.data?.data || null;
  const info = intake?.customerInfo || {};
  const body = intake?.bodyMetrics || {};
  const health = intake?.healthScreening || {};
  const life = intake?.lifestyleNutrition || {};
  const goal = intake?.trainingProfileGoal || {};
  const loading = intakeQuery.isLoading || assessmentQuery.isLoading;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 p-4 md:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="f1-summary-title"
        data-testid="f1-summary-report"
        className="mx-auto flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="f1-summary-title" className="text-xl font-extrabold text-slate-800">
              Báo cáo tổng quát khách hàng
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {customer?.fullName} · {customer?.code || "--"}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng báo cáo"
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {loading && <p className="text-sm text-slate-500">Đang tải báo cáo...</p>}
          {!loading && !intake && (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              Chưa có kết quả khảo sát để tổng hợp báo cáo.
            </p>
          )}
          {stageTabs.length > 0 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Các giai đoạn của khách">
              {stageTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={tab.stageOrder === stageOrder}
                  onClick={() => setActiveStage(tab.stageOrder)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                    tab.stageOrder === stageOrder
                      ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {stageOrder > 1 && (
            <div className="space-y-6">
              {reviewBefore ? <LatestBodyGroup actual={reviewBefore.actual} /> : null}
              {reviewBefore?.profile ? (
                <>
                  <HealthLifeGroup
                    health={reviewBefore.profile.healthScreening}
                    life={reviewBefore.profile.lifestyleNutrition}
                  />
                  <GoalGroup goal={reviewBefore.profile.trainingProfileGoal} />
                </>
              ) : null}
              {reviewBefore ? (
                <F1NextStagePlan review={reviewBefore} />
              ) : null}
              {reviewOfStage ? (
                <section className="space-y-3">
                  <h3 className="text-lg font-bold text-slate-800">
                    Kết quả cuối giai đoạn {stageOrder}
                  </h3>
                  <F1PhaseReviewResult review={reviewOfStage} showNext={false} />
                </section>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Giai đoạn này chưa có kết quả cuối giai đoạn.
                </p>
              )}
            </div>
          )}

          {stageOrder === 1 && intake && (
            <>
              <Group title="Thông tin khách hàng">
                <Grid>
                  <Item label="Họ và tên">{info.fullName || customer?.fullName}</Item>
                  <Item label="Tuổi">{info.age || customer?.age}</Item>
                  <Item label="Giới tính">{getF1GenderLabel(info.gender || customer?.gender)}</Item>
                  <Item label="Chiều cao">{body.heightCm ? `${body.heightCm} cm` : ""}</Item>
                  <Item label="Vòng eo">{body.waistCm ? `${body.waistCm} cm` : ""}</Item>
                  <Item label="Vòng hông">{body.hipCm ? `${body.hipCm} cm` : ""}</Item>
                  <Item label="Tỷ lệ mỡ">{body.bodyFatPercent ? `${body.bodyFatPercent}%` : ""}</Item>
                  <Item label="Nhịp tim nghỉ">{body.restingHeartRate ? `${body.restingHeartRate} bpm` : ""}</Item>
                  <Item label="Cân nặng · BMI">
                    {body.weightKg ? `${body.weightKg} kg${body.bmi ? ` · ${body.bmi}` : ""}` : ""}
                  </Item>
                  <Item label="Số điện thoại">{info.phone || customer?.phone}</Item>
                  <Item label="Nghề nghiệp">{info.occupation || customer?.occupation}</Item>
                </Grid>
              </Group>

              {prediction?.phaseRoadmap?.[0] && (
                <Group title="Kế hoạch giai đoạn 1">
                  <Grid>
                    <Item label="Giai đoạn">{PHASE_NAMES[prediction.phaseRoadmap[0].phaseKey]}</Item>
                    <Item label="Thời lượng">{`${prediction.phaseRoadmap[0].durationWeeks} tuần`}</Item>
                    <Item label="Người thiết kế">{prediction.planSource === "trainer" ? "HLV thiết kế" : "Hệ thống đề xuất"}</Item>
                  </Grid>
                  {prediction.phaseRoadmap[0].objective && (
                    <p className="mt-3 text-sm text-slate-700">{prediction.phaseRoadmap[0].objective}</p>
                  )}
                  {prediction.phaseRoadmap[0].weeklySchedule && (
                    <div className="mt-3">
                      <F1WeeklyScheduleView schedule={prediction.phaseRoadmap[0].weeklySchedule} />
                    </div>
                  )}
                </Group>
              )}

              <HealthLifeGroup health={health} life={life} />

              <GoalGroup goal={goal} />

              <AssessmentGroup assessment={assessment} />

              {reviewOfStage && (
                <Group title="Kết quả cuối giai đoạn 1">
                  <F1PhaseReviewResult review={reviewOfStage} showNext={false} />
                </Group>
              )}
            </>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Đóng
          </button>
          {onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-2.5 font-bold text-white shadow-md transition hover:shadow-lg"
            >
              {continueLabel}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
};

export default F1CustomerSummaryReport;

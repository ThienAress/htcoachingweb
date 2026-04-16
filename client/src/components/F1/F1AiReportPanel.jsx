import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Sparkles,
  RefreshCcw,
  Activity,
  ClipboardList,
  ShieldAlert,
  Target,
} from "lucide-react";
import {
  generateAiReport,
  getLatestAiReport,
} from "../../services/f1Customer.service";
import { toast } from "react-toastify";

const READINESS_LABELS = {
  pending: "Chờ đánh giá",
  ready: "Sẵn sàng tập luyện",
  caution: "Cần điều chỉnh",
  hold: "Tạm hoãn tập luyện",
};

const PRIMARY_GOAL_LABELS = {
  fat_loss: "Giảm mỡ",
  weight_gain: "Tăng cân",
  muscle_gain: "Tăng cơ",
  maintenance: "Duy trì",
};

const PHYSICAL_LEVEL_LABELS = {
  low: "Thấp",
  below_average: "Dưới trung bình",
  average: "Trung bình",
  good: "Tốt",
};

const PAIN_FLAG_LABELS = {
  none: "Không có cảnh báo đau",
  mild: "Đau mức nhẹ",
  moderate: "Đau mức trung bình",
  severe: "Đau mức nghiêm trọng",
};

const PHASE_LABELS = {
  pending_review: "Chờ review thêm trước khi vào phase huấn luyện",
  phase_1: "Cấp độ 1 · Phase 1 - Stabilization Endurance",
  phase_2: "Cấp độ 2 · Phase 2 - Strength Endurance",
  phase_3: "Cấp độ 2 · Phase 3 - Muscular Development / Hypertrophy",
  phase_4: "Cấp độ 2 · Phase 4 - Maximal Strength",
  phase_5: "Cấp độ 3 · Phase 5 - Power",
};

const STRENGTH_FLAG_LABELS = {
  upper_body_push_low: "Sức mạnh đẩy thân trên còn thấp",
  upper_body_pull_low: "Sức mạnh kéo thân trên còn thấp",
  lower_body_strength_low: "Sức mạnh thân dưới còn thấp",
  core_strength_low: "Sức mạnh core còn thấp",
};

const ENDURANCE_FLAG_LABELS = {
  muscular_endurance_low: "Sức bền cơ còn thấp",
  core_endurance_low: "Sức bền core còn thấp",
};

const CARDIO_FLAG_LABELS = {
  resting_hr_elevated: "Nhịp tim nghỉ cao",
  cardio_capacity_low: "Năng lực tim mạch còn thấp",
  recovery_heart_rate_low: "Khả năng hồi phục tim mạch còn thấp",
};

const CORRECTIVE_FOCUS_LABELS = {
  glute_activation: "Kích hoạt cơ mông",
  ankle_mobility: "Cải thiện linh hoạt cổ chân",
  single_leg_stability: "Tăng ổn định một chân",
  lower_body_alignment: "Chỉnh trục thân dưới",
  stability_training: "Tăng ổn định nền tảng",
  movement_foundation: "Xây nền chuyển động",
  core_control: "Tăng kiểm soát core",
  squat_pattern_retraining: "Học lại pattern squat",
  lumbopelvic_control: "Kiểm soát lưng - chậu",
  core_bracing: "Học siết core",
  hip_mobility: "Cải thiện linh hoạt hông",
  thoracic_mobility: "Cải thiện linh hoạt lưng ngực",
  scapular_control: "Kiểm soát xương bả vai",
  posture_awareness: "Nhận thức tư thế",
  thoracic_extension: "Cải thiện ưỡn lưng ngực",
  cervical_alignment: "Căn chỉnh cổ",
};

const TRAINING_FOCUS_LABELS = {
  energy_expenditure: "Tăng tiêu hao năng lượng",
  cardio_base_building: "Xây nền tim mạch",
  strength_progression: "Tăng tiến sức mạnh",
  movement_quality_under_load: "Cải thiện chất lượng chuyển động khi có tải",
  lower_body_strength: "Ưu tiên sức mạnh thân dưới",
  core_strength: "Ưu tiên sức mạnh core",
  muscular_endurance: "Ưu tiên sức bền cơ",
  pattern_retraining: "Học lại pattern vận động",
  general_foundation: "Xây nền tổng quát",
  movement_foundation: "Xây nền chuyển động",
  stability_training: "Tăng ổn định nền tảng",
  core_stability: "Ưu tiên ổn định core",
};

const translateValue = (value, map) => (value ? map[value] || value : "--");
const translateArray = (items = [], map = {}) =>
  items.map((item) => map[item] || item);

const InfoCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center gap-2 text-slate-500">
      {Icon ? <Icon size={16} /> : null}
      <p className="text-xs uppercase tracking-wide">{label}</p>
    </div>
    <p className="mt-2 text-sm font-semibold text-slate-900">{value || "--"}</p>
  </div>
);

const SectionCard = ({ title, subtitle, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
    <div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      ) : null}
    </div>
    {children}
  </div>
);

const BulletList = ({ items = [], emptyText = "Chưa có dữ liệu" }) => {
  if (!items.length) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={`${item}-${index}`}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          {item}
        </div>
      ))}
    </div>
  );
};

const SummaryCard = ({ title, items = [], emptyText = "Chưa có dữ liệu" }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <h4 className="text-base font-bold text-slate-900">{title}</h4>
    <div className="mt-3">
      <BulletList items={items} emptyText={emptyText} />
    </div>
  </div>
);

const AppendixCard = ({
  title,
  items = [],
  tone = "slate",
  emptyText = "Chưa có dữ liệu",
}) => {
  const toneMap = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-violet-100 text-violet-700",
    orange: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h4 className="text-base font-bold text-slate-900">{title}</h4>
      {!items.length ? (
        <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                toneMap[tone] || toneMap.slate
              }`}
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const PhysicalRadarChart = ({ data = [] }) => {
  const size = 340;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 110;
  const rings = [2, 4, 6, 8, 10];

  const angleForIndex = (index) => -90 + index * (360 / data.length);
  const toPoint = (score, index) => {
    const angle = (Math.PI / 180) * angleForIndex(index);
    const radius = (Math.max(Math.min(score, 10), 0) / 10) * maxR;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  };

  const polygonPoints = data
    .map((item, index) => {
      const point = toPoint(item.score || 0, index);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  const ringPoints = (ring) =>
    data
      .map((_, index) => {
        const point = toPoint(ring, index);
        return `${point.x},${point.y}`;
      })
      .join(" ");

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[360px] overflow-visible"
      >
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={ringPoints(ring)}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}

        {data.map((item, index) => {
          const outer = toPoint(10, index);
          return (
            <g key={item.label}>
              <line
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={outer.x}
                y={outer.y}
                textAnchor={
                  index === 1 ? "start" : index === 3 ? "end" : "middle"
                }
                dominantBaseline={
                  index === 0 ? "auto" : index === 2 ? "hanging" : "middle"
                }
                dy={index === 0 ? -10 : index === 2 ? 10 : 0}
                dx={index === 1 ? 10 : index === 3 ? -10 : 0}
                className="fill-slate-600 text-[12px] font-medium"
              >
                {item.label}
              </text>
            </g>
          );
        })}

        {rings.map((ring, idx) => (
          <text
            key={`ring-${ring}`}
            x={cx + 6}
            y={cy - (ring / 10) * maxR + 4}
            className="fill-slate-400 text-[10px]"
          >
            {rings[rings.length - 1 - idx]}
          </text>
        ))}

        <polygon
          points={polygonPoints}
          fill="rgba(127,29,29,0.14)"
          stroke="#7f1d1d"
          strokeWidth="2"
        />
      </svg>

      <div className="mt-6 grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
            <p className="mt-1 text-xl font-bold text-[#7f1d1d]">
              {item.score}/10
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const buildFallbackSummary = (report) => {
  if (!report) return null;

  const readiness = translateValue(
    report?.inputSummary?.readinessStatus,
    READINESS_LABELS,
  );
  const goal = translateValue(
    report?.inputSummary?.primaryGoal,
    PRIMARY_GOAL_LABELS,
  );
  const overall = translateValue(
    report?.inputSummary?.overallPhysicalLevel,
    PHYSICAL_LEVEL_LABELS,
  );
  const pain = translateValue(report?.inputSummary?.painFlag, PAIN_FLAG_LABELS);
  const phase = report?.recommendations?.recommendedStartPhase || "phase_1";

  const headlineMap = {
    pending_review:
      "Khách hiện chưa phù hợp để vào block huấn luyện chính thức. Cần review thêm yếu tố sức khỏe và an toàn vận động.",
    phase_1:
      "Khách nên bắt đầu từ Cấp độ 1 · Phase 1 - Stabilization Endurance để ưu tiên ổn định, kiểm soát chuyển động và xây nền an toàn.",
    phase_2:
      "Khách có thể bắt đầu ở Cấp độ 2 · Phase 2 - Strength Endurance thay vì chỉ dừng ở stabilization.",
    phase_3:
      "Khách có thể đi vào Cấp độ 2 · Phase 3 - Muscular Development / Hypertrophy vì nền hiện tại phù hợp hơn với block phát triển cơ bắp.",
    phase_4:
      "Khách đủ điều kiện để bắt đầu ở Cấp độ 2 · Phase 4 - Maximal Strength.",
    phase_5: "Khách đủ điều kiện để bắt đầu ở Cấp độ 3 · Phase 5 - Power.",
  };

  return {
    quickOverview: {
      headline: headlineMap[phase] || headlineMap.phase_1,
      coachConclusion: `Mức sẵn sàng hiện tại: ${readiness}. Mục tiêu chính: ${goal}. Mức thể chất tổng thể: ${overall}. Cảnh báo đau: ${pain}.`,
    },
    generalReview: {
      health: [
        `Mức sẵn sàng hiện tại: ${readiness}.`,
        `Cảnh báo đau: ${pain}.`,
      ],
      physical: [
        `Mục tiêu chính hiện tại: ${goal}.`,
        `Mức thể chất tổng thể hiện tại: ${overall}.`,
      ],
      lifestyle: [],
      nutrition: [],
      riskFactors: [],
    },
    physicalChart: {
      posture: 5,
      strength: 5,
      endurance: 5,
      cardio: 5,
    },
    startupPlan: {
      startPhase: phase,
      combinedPlan: report?.recommendations?.trainingNotes || [],
      cautions: [],
    },
  };
};

const F1AiReportPanel = ({ customer, onBack, onGenerated }) => {
  const [report, setReport] = useState(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const loadLatest = async () => {
      if (!customer?._id) return;
      try {
        setLoadingLatest(true);
        const res = await getLatestAiReport(customer._id);
        setReport(res?.data || null);
      } catch (error) {
        console.error("GET LATEST AI REPORT ERROR:", error);
        setReport(null);
      } finally {
        setLoadingLatest(false);
      }
    };

    loadLatest();
  }, [customer?._id]);

  const handleGenerate = async () => {
    if (!customer?._id) return;
    try {
      setGenerating(true);
      const res = await generateAiReport(customer._id);
      setReport(res?.data || null);
      toast.success("Tạo AI Report thành công");
      onGenerated?.(res?.data);
    } catch (error) {
      console.error("GENERATE AI REPORT ERROR:", error);
      toast.error(error?.response?.data?.message || "Tạo AI Report thất bại");
    } finally {
      setGenerating(false);
    }
  };

  const summary = useMemo(
    () => report?.reportSummary || buildFallbackSummary(report),
    [report],
  );

  const physicalChartData = useMemo(() => {
    const chart = summary?.physicalChart || {};
    return [
      { label: "Tư thế", score: Number(chart.posture || 0) },
      { label: "Sức mạnh", score: Number(chart.strength || 0) },
      { label: "Sức bền", score: Number(chart.endurance || 0) },
      { label: "Tim mạch", score: Number(chart.cardio || 0) },
    ];
  }, [summary]);

  const appendix = useMemo(
    () => ({
      strengthFlags: translateArray(
        report?.findings?.strengthFlags || [],
        STRENGTH_FLAG_LABELS,
      ),
      enduranceFlags: translateArray(
        report?.findings?.enduranceFlags || [],
        ENDURANCE_FLAG_LABELS,
      ),
      cardioFlags: translateArray(
        report?.findings?.cardioFlags || [],
        CARDIO_FLAG_LABELS,
      ),
      correctiveFocus: translateArray(
        report?.recommendations?.correctiveFocus || [],
        CORRECTIVE_FOCUS_LABELS,
      ),
      trainingFocus: translateArray(
        report?.recommendations?.trainingFocus || [],
        TRAINING_FOCUS_LABELS,
      ),
      trainingNotes: report?.recommendations?.trainingNotes || [],
      engineVersion: report?.engineVersion || "--",
      coachNote: report?.coachNote || "",
    }),
    [report],
  );

  return (
    <section className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        Quay lại chi tiết khách hàng
      </button>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              AI Report NASM • {customer?.code || "--"}
            </p>
            <h2 className="text-2xl font-bold text-slate-900">
              {customer?.fullName}
            </h2>
            <p className="mt-1 text-slate-500">
              Báo cáo tổng hợp từ intake và đánh giá thể chất, giúp PT nắm nhanh
              tình trạng hiện tại và cách bắt đầu phù hợp.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || loadingLatest}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1C2D42] px-5 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {report ? <RefreshCcw size={18} /> : <Sparkles size={18} />}
            {generating
              ? "Đang tạo AI Report..."
              : report
                ? "Tạo lại AI Report"
                : "Tạo AI Report"}
          </button>
        </div>

        {loadingLatest ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-500">
            Đang tải AI Report...
          </div>
        ) : !report ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="font-semibold text-slate-700">
              Chưa có AI Report cho khách hàng này
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Bấm nút tạo để hệ thống tổng hợp dữ liệu từ intake và đánh giá thể
              chất.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <InfoCard
                label="Mức sẵn sàng tập luyện"
                value={translateValue(
                  report?.inputSummary?.readinessStatus,
                  READINESS_LABELS,
                )}
                icon={ShieldAlert}
              />
              <InfoCard
                label="Mục tiêu chính"
                value={translateValue(
                  report?.inputSummary?.primaryGoal,
                  PRIMARY_GOAL_LABELS,
                )}
                icon={Target}
              />
              <InfoCard
                label="Mức thể chất tổng thể"
                value={translateValue(
                  report?.inputSummary?.overallPhysicalLevel,
                  PHYSICAL_LEVEL_LABELS,
                )}
                icon={Activity}
              />
              <InfoCard
                label="Cảnh báo chấn thương"
                value={translateValue(
                  report?.inputSummary?.painFlag,
                  PAIN_FLAG_LABELS,
                )}
                icon={ClipboardList}
              />
            </div>

            <SectionCard
              title="Nhận xét tổng quát"
              subtitle="AI không chỉ nhắc lại dữ liệu intake, mà diễn giải các yếu tố đầu vào thành nhận định có ý nghĩa để PT hiểu nhanh khách đang ở đâu và cần lưu ý điều gì."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <SummaryCard
                  title="Sức khỏe"
                  items={summary?.generalReview?.health || []}
                  emptyText="Chưa có lưu ý sức khỏe nổi bật"
                />
                <SummaryCard
                  title="Thể chất"
                  items={summary?.generalReview?.physical || []}
                  emptyText="Chưa có lưu ý thể chất nổi bật từ intake"
                />
                <SummaryCard
                  title="Lối sống"
                  items={summary?.generalReview?.lifestyle || []}
                  emptyText="Chưa có lưu ý lifestyle nổi bật"
                />
                <SummaryCard
                  title="Dinh dưỡng"
                  items={summary?.generalReview?.nutrition || []}
                  emptyText="Chưa có lưu ý dinh dưỡng nổi bật"
                />
                <SummaryCard
                  title="Yếu tố rủi ro"
                  items={summary?.generalReview?.riskFactors || []}
                  emptyText="Chưa có yếu tố rủi ro nổi bật từ intake"
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Tổng quan 30 giây"
              subtitle="Phần PT nên đọc đầu tiên để nắm rất nhanh khách đang ở đâu và nên bắt đầu như thế nào."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                    Kết luận AI
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-900">
                    {summary?.quickOverview?.headline ||
                      summary?.headline ||
                      "--"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Kết luận cho PT
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-800">
                    {summary?.quickOverview?.coachConclusion ||
                      summary?.coachConclusion ||
                      "--"}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Biểu đồ thể chất"
              subtitle="Điểm được tổng hợp từ phần đánh giá thể chất, giúp PT nhìn nhanh nền vận động và thể lực hiện tại của khách (thang 1-10)."
            >
              <PhysicalRadarChart data={physicalChartData} />
            </SectionCard>

            <SectionCard
              title="Kế hoạch khởi đầu cho PT"
              subtitle="Gộp chung giai đoạn khởi đầu đề xuất, các ưu tiên đầu tiên và điều cần theo dõi trong giai đoạn đầu."
            >
              <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                    Giai đoạn khởi đầu đề xuất
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {translateValue(
                      summary?.startupPlan?.startPhase,
                      PHASE_LABELS,
                    )}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Đây là giai đoạn nên bắt đầu để vừa an toàn, vừa bám sát mức
                    nền hiện tại của khách.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h4 className="text-base font-bold text-slate-900">
                      Hướng triển khai ban đầu
                    </h4>
                    <div className="mt-3">
                      <BulletList
                        items={
                          summary?.startupPlan?.combinedPlan ||
                          summary?.startupPlan?.topPriorities ||
                          []
                        }
                        emptyText="Chưa có hướng triển khai khởi đầu"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                    <h4 className="text-base font-bold text-orange-700">
                      Điều cần tránh / cần theo dõi
                    </h4>
                    <div className="mt-3">
                      <BulletList
                        items={summary?.startupPlan?.cautions || []}
                        emptyText="Chưa có cảnh báo nổi bật"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Những điểm AI đang lưu ý"
              subtitle="Phần này giúp PT nhìn nhanh những điểm AI đang thấy nổi bật, các ưu tiên nên xử lý trước và những lưu ý cần nhớ khi bắt đầu lên bài cho khách."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <AppendixCard
                  title="Điểm AI đang thấy nổi bật"
                  items={[
                    ...appendix.strengthFlags,
                    ...appendix.enduranceFlags,
                    ...appendix.cardioFlags,
                  ]}
                  tone="blue"
                  emptyText="Hiện chưa có điểm nổi bật nào cần nhấn mạnh thêm."
                />

                <AppendixCard
                  title="Ưu tiên nên xử lý trước"
                  items={[
                    ...appendix.correctiveFocus,
                    ...appendix.trainingFocus,
                  ]}
                  tone="emerald"
                  emptyText="Hiện chưa có ưu tiên nổi bật nào cần tách riêng."
                />
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </section>
  );
};

export default F1AiReportPanel;

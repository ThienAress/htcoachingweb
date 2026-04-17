// F1ResultPredictionPanel.jsx
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  RefreshCcw,
  TrendingUp,
  CalendarDays,
  Image as ImageIcon,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  generateResultPrediction,
  getLatestResultPrediction,
  generateResultPredictionStageImages,
} from "../../services/f1Customer.service";
import { toast } from "react-toastify";

import F1NasmPyramid from "./F1NasmPyramid";

const PHASE_LABELS = {
  phase_1: "Phase 1 - Stabilization Endurance",
  phase_2: "Phase 2 - Strength Endurance",
  phase_3: "Phase 3 - Hypertrophy",
  phase_4: "Phase 4 - Maximal Strength",
  phase_5: "Phase 5 - Power",
};

const GOAL_LABELS = {
  fat_loss: "Giảm mỡ",
  weight_gain: "Tăng cân",
  muscle_gain: "Tăng cơ",
  maintenance: "Duy trì thể trạng",
};

const PHYSICAL_LEVEL_LABELS = {
  low: "Thấp",
  below_average: "Dưới trung bình",
  average: "Trung bình",
  good: "Tốt",
};

const TRAINING_FOCUS_LABELS = {
  energy_expenditure: "Tăng tiêu hao năng lượng",
  cardio_base_building: "Xây nền tim mạch",
  strength_progression: "Tăng sức mạnh theo từng giai đoạn",
  movement_quality_under_load: "Tập nặng hơn nhưng vẫn giữ form chuẩn",
  lower_body_strength: "Tăng sức mạnh thân dưới",
  core_strength: "Tăng sức mạnh core",
  muscular_endurance: "Cải thiện sức bền cơ",
  pattern_retraining: "Chỉnh lại pattern vận động",
  general_foundation: "Xây nền thể lực tổng quát",
  movement_foundation: "Xây nền chuyển động",
  stability_training: "Tăng khả năng ổn định cơ thể",
  core_control: "Cải thiện kiểm soát core",
};

const MAX_ATTEMPTS_FALLBACK = 3;

const translateTrainingFocus = (items = []) =>
  items.map((item) => TRAINING_FOCUS_LABELS[item] || item);
const translateValue = (value, map) => (value ? map[value] || value : "--");

const SectionHeading = ({ title, subtitle, actions = null }) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
    <div>
      <h3 className="text-xl font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions && <div className="shrink-0">{actions}</div>}
  </div>
);

const InfoCard = ({ label, value }) => (
  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-lg font-bold text-slate-800">{value || "--"}</p>
  </div>
);

const BulletList = ({ items = [], emptyText = "Chưa có dữ liệu" }) => {
  if (!items.length)
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm text-slate-700"
        >
          {item}
        </div>
      ))}
    </div>
  );
};

const StageTabs = ({ stages = [], selectedKey, onSelect }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-2">
    <div className="flex flex-wrap gap-2">
      {stages.map((stage) => {
        const active = stage.phaseKey === selectedKey;
        return (
          <button
            key={stage.phaseKey}
            type="button"
            onClick={() => onSelect(stage.phaseKey)}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              active
                ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Phase {stage.stageOrder}: {stage.phaseTitle}
          </button>
        );
      })}
    </div>
  </div>
);

const StageDetailCard = ({ stage }) => {
  if (!stage) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 font-black text-amber-700">
            {stage.stageOrder}
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              Phase {stage.stageOrder}: {stage.phaseTitle}
            </h3>
            <p className="text-sm text-slate-500">{stage.levelTitle}</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          <CalendarDays size={16} />
          {stage.durationWeeks} tuần
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-800">
          {PHASE_LABELS[stage.phaseKey] || stage.phaseTitle}
        </p>
        <p className="mt-2 text-sm text-slate-700">{stage.objective}</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            Trọng tâm chính
          </p>
          <div className="mt-2">
            <BulletList
              items={translateTrainingFocus(stage.keyFocus || [])}
              emptyText="Chưa có dữ liệu"
            />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-500">
            Thay đổi có thể thấy
          </p>
          <div className="mt-2">
            <BulletList
              items={stage.expectedChanges || []}
              emptyText="Chưa có dữ liệu"
            />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-500">
            Khi nào nên chuyển tiếp
          </p>
          <div className="mt-2">
            <BulletList
              items={stage.exitCriteria || []}
              emptyText="Chưa có dữ liệu"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">
          Vì sao lộ trình được xếp như vậy
        </p>
        <p className="mt-2 text-sm text-slate-700">{stage.entryReason}</p>
      </div>
    </div>
  );
};

const OutcomeComparisonTable = ({ outcomeTable }) => {
  const baseline = outcomeTable?.baseline || {};
  const checkpoints = outcomeTable?.phaseCheckpoints || [];
  const columns = [
    { key: "baseline", title: "Ban đầu", data: baseline, isCurrent: true },
    ...checkpoints.map((item) => ({
      key: item.phaseKey,
      title: item.label,
      data: item.projected || {},
      delta: item.deltaFromBaseline || {},
      summary: item.summary || "",
    })),
  ];
  const rows = [
    {
      key: "weightKg",
      label: "Cân nặng",
      subLabel: "Chỉ số cơ thể",
      suffix: "kg",
    },
    {
      key: "bodyFatPercent",
      label: "Tỷ lệ mỡ cơ thể",
      subLabel: "Chỉ số cơ thể",
      suffix: "%",
    },
    { key: "bmi", label: "BMI", subLabel: "Chỉ số cơ thể", suffix: "" },
    {
      key: "waistCm",
      label: "Vòng eo",
      subLabel: "Số đo cơ thể",
      suffix: "cm",
    },
    {
      key: "hipCm",
      label: "Vòng hông",
      subLabel: "Số đo cơ thể",
      suffix: "cm",
    },
    {
      key: "restingHeartRate",
      label: "Nhịp tim nghỉ",
      subLabel: "Tim mạch nền",
      suffix: "bpm",
    },
    {
      key: "overallPhysicalLevel",
      label: "Mức thể chất",
      subLabel: "Đánh giá tổng thể",
      suffix: "",
    },
  ];
  const formatValue = (value, suffix = "", key = "") => {
    if (value === null || value === undefined || value === "") return "—";
    if (key === "overallPhysicalLevel")
      return translateValue(value, PHYSICAL_LEVEL_LABELS);
    return suffix ? `${value} ${suffix}` : value;
  };
  const formatDelta = (value, suffix = "") => {
    if (value === null || value === undefined || value === "") return null;
    const sign = value > 0 ? "+" : "";
    return `${sign}${value}${suffix ? ` ${suffix}` : ""}`;
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <table className="w-full min-w-[800px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="rounded-tl-xl bg-slate-50 px-5 py-4 text-left text-sm font-bold text-slate-700">
              Chỉ số
            </th>
            {columns.map((col, idx) => (
              <th
                key={col.key}
                className={`bg-slate-50 px-5 py-4 text-center text-sm font-semibold text-slate-700 ${
                  idx === columns.length - 1 ? "rounded-tr-xl" : ""
                }`}
              >
                <div className="space-y-1">
                  <p>{col.title}</p>
                  {col.isCurrent && (
                    <span className="inline-flex rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold text-white">
                      Hiện tại
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={row.key}>
              <td
                className={`border-b border-slate-100 px-5 py-4 align-top ${rowIdx === rows.length - 1 ? "rounded-bl-xl" : ""}`}
              >
                <p className="font-bold text-slate-800">{row.label}</p>
                <p className="mt-1 text-xs text-slate-500">{row.subLabel}</p>
              </td>
              {columns.map((col, colIdx) => {
                const rawValue = col.data?.[row.key];
                const rawDelta = col.delta?.[row.key];
                return (
                  <td
                    key={`${col.key}-${row.key}`}
                    className={`border-b border-slate-100 px-5 py-4 text-center align-top ${
                      colIdx === columns.length - 1 &&
                      rowIdx === rows.length - 1
                        ? "rounded-br-xl"
                        : ""
                    }`}
                  >
                    <p className="font-bold text-slate-800">
                      {formatValue(rawValue, row.suffix, row.key)}
                    </p>
                    {!col.isCurrent &&
                      rawDelta !== null &&
                      rawDelta !== undefined && (
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            Number(rawDelta) < 0
                              ? "text-emerald-600"
                              : Number(rawDelta) > 0
                                ? "text-rose-600"
                                : "text-slate-400"
                          }`}
                        >
                          {formatDelta(rawDelta, row.suffix)}
                        </p>
                      )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ImagePreviewCard = ({ title, imageUrl, emptyText }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-sm font-semibold text-slate-800">{title}</p>
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="h-[320px] w-full object-cover"
        />
      ) : (
        <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-sm text-slate-400">
          <ImageIcon size={28} />
          <p>{emptyText}</p>
        </div>
      )}
    </div>
  </div>
);

const VisualComparisonSection = ({
  prediction,
  selectedVisualStage,
  onGenerateImages,
  generatingStageKey,
}) => {
  const beforeImages = prediction?.beforeImages || {};
  const predictionId = prediction?._id || "";
  const selectedPhaseKey = selectedVisualStage?.phaseKey || "";
  const hasBeforeFront = Boolean(beforeImages?.frontUrl);
  const hasBeforeSide = Boolean(beforeImages?.sideUrl);
  const hasAfterFront = Boolean(selectedVisualStage?.images?.frontUrl);
  const hasAfterSide = Boolean(selectedVisualStage?.images?.sideUrl);
  const afterLabel = selectedVisualStage?.label || "Giai đoạn đã chọn";
  const canGenerate = Boolean(
    predictionId && selectedPhaseKey && hasBeforeFront && hasBeforeSide,
  );
  const isGenerating = generatingStageKey === selectedPhaseKey;
  const hasGeneratedImages = hasAfterFront || hasAfterSide;
  const attemptCount = Number(
    selectedVisualStage?.generation?.attemptCount || 0,
  );
  const limitReached = attemptCount >= MAX_ATTEMPTS_FALLBACK;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          label="Ảnh before front"
          value={hasBeforeFront ? "Đã có" : "Chưa có"}
        />
        <InfoCard
          label="Ảnh before side"
          value={hasBeforeSide ? "Đã có" : "Chưa có"}
        />
        <InfoCard
          label="Ảnh after front"
          value={hasAfterFront ? "Đã có" : "Chưa có"}
        />
        <InfoCard
          label="Ảnh after side"
          value={hasAfterSide ? "Đã có" : "Chưa có"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-800">{afterLabel}</p>
          <p className="mt-1 text-sm text-slate-500">
            Mỗi lần tạo hoặc tạo lại ảnh AI đều có thể phát sinh chi phí.
          </p>
          <p className="mt-1 text-xs text-amber-600">
            Đã dùng {attemptCount}/{MAX_ATTEMPTS_FALLBACK} lượt cho phase này.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onGenerateImages(hasGeneratedImages)}
          disabled={!canGenerate || isGenerating || limitReached}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-3 font-bold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
        >
          <Sparkles size={18} />
          {isGenerating
            ? "Đang tạo ảnh AI..."
            : hasGeneratedImages
              ? "Tạo lại ảnh AI"
              : "Tạo ảnh AI"}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-800">Ảnh before</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <ImagePreviewCard
              title="Before • Front"
              imageUrl={beforeImages?.frontUrl || ""}
              emptyText="Chưa có ảnh before front từ intake"
            />
            <ImagePreviewCard
              title="Before • Side"
              imageUrl={beforeImages?.sideUrl || ""}
              emptyText="Chưa có ảnh before side từ intake"
            />
          </div>
        </div>
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-800">{afterLabel}</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <ImagePreviewCard
              title="After • Front"
              imageUrl={selectedVisualStage?.images?.frontUrl || ""}
              emptyText="Chưa có ảnh after front"
            />
            <ImagePreviewCard
              title="After • Side"
              imageUrl={selectedVisualStage?.images?.sideUrl || ""}
              emptyText="Chưa có ảnh after side"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const F1ResultPredictionPanel = ({ customer, onBack, onGenerated }) => {
  const [prediction, setPrediction] = useState(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedStageKey, setSelectedStageKey] = useState("");
  const [generatingStageKey, setGeneratingStageKey] = useState("");

  useEffect(() => {
    const loadLatest = async () => {
      if (!customer?._id) return;
      try {
        setLoadingLatest(true);
        const res = await getLatestResultPrediction(customer._id);
        setPrediction(res?.data || null);
      } catch (error) {
        console.error(error);
        setPrediction(null);
      } finally {
        setLoadingLatest(false);
      }
    };
    loadLatest();
  }, [customer?._id]);

  useEffect(() => {
    const firstStage = prediction?.phaseRoadmap?.[0];
    if (firstStage?.phaseKey) setSelectedStageKey(firstStage.phaseKey);
    else setSelectedStageKey("");
  }, [prediction]);

  const sourceSummary = useMemo(
    () => prediction?.sourceSummary || {},
    [prediction],
  );
  const selectedStage = useMemo(() => {
    const stages = prediction?.phaseRoadmap || [];
    return (
      stages.find((item) => item.phaseKey === selectedStageKey) ||
      stages[0] ||
      null
    );
  }, [prediction, selectedStageKey]);
  const selectedVisualStage = useMemo(() => {
    const stages = prediction?.visualStages || [];
    return (
      stages.find((item) => item.phaseKey === selectedStageKey) ||
      stages[0] ||
      null
    );
  }, [prediction, selectedStageKey]);

  const handleGenerate = async () => {
    if (!customer?._id) return;
    try {
      setGenerating(true);
      const res = await generateResultPrediction(customer._id);
      setPrediction(res?.data || null);
      toast.success("Đã tạo dự đoán kết quả thành công");
      onGenerated?.(res?.data);
    } catch (error) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Tạo dự đoán kết quả thất bại",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateStageImages = async (forceRegenerate = false) => {
    if (!customer?._id || !prediction?._id || !selectedVisualStage?.phaseKey)
      return;
    const phaseKey = selectedVisualStage.phaseKey;
    const attemptCount = Number(
      selectedVisualStage?.generation?.attemptCount || 0,
    );
    if (forceRegenerate) {
      const confirmed = window.confirm(
        `Bạn sắp tạo lại ảnh AI cho ${selectedVisualStage?.label || phaseKey}.\n\nMỗi lần tạo lại sẽ phát sinh chi phí.\nHiện đã dùng ${attemptCount}/${MAX_ATTEMPTS_FALLBACK} lượt.\n\nBạn có chắc muốn tiếp tục không?`,
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(
        `Tạo ảnh AI cho ${selectedVisualStage?.label || phaseKey}?\n\nMỗi lần tạo ảnh sẽ phát sinh chi phí.`,
      );
      if (!confirmed) return;
    }
    try {
      setGeneratingStageKey(phaseKey);
      const res = await generateResultPredictionStageImages(
        customer._id,
        prediction._id,
        phaseKey,
        { forceRegenerate },
      );
      const stagePayload = res?.data;
      if (stagePayload?.phaseKey) {
        setPrediction((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            visualStages: (prev.visualStages || []).map((stage) =>
              stage.phaseKey === stagePayload.phaseKey
                ? {
                    ...stage,
                    imageStatus: stagePayload.imageStatus || stage.imageStatus,
                    images: stagePayload.images || stage.images,
                    generation: stagePayload.generation || stage.generation,
                  }
                : stage,
            ),
          };
        });
      }
      toast.success(
        res?.message ||
          (forceRegenerate
            ? "Đã tạo lại ảnh AI thành công"
            : "Đã tạo ảnh AI thành công"),
      );
    } catch (error) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Tạo ảnh AI cho phase thất bại",
      );
    } finally {
      setGeneratingStageKey("");
    }
  };

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <button
        onClick={onBack}
        className="group inline-flex items-center gap-2 text-slate-500 transition hover:text-amber-600"
      >
        <ArrowLeft
          size={18}
          className="transition-transform group-hover:-translate-x-1"
        />
        Quay lại chi tiết khách hàng
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-6 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">
                Dự đoán kết quả • {customer?.code || "--"}
              </p>
              <h2 className="text-2xl font-extrabold text-slate-800">
                {customer?.fullName}
              </h2>
              <p className="mt-1 text-slate-500">
                Toàn bộ lộ trình tập, kết quả kỳ vọng theo từng giai đoạn và
                phần so sánh before/after
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || loadingLatest}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-3 font-bold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
            >
              {prediction ? <RefreshCcw size={18} /> : <TrendingUp size={18} />}
              {generating
                ? "Đang phân tích..."
                : prediction
                  ? "Cập nhật lại dự đoán"
                  : "Tạo dự đoán"}
            </button>
          </div>
        </div>

        <div className="px-6 py-6 md:px-8">
          {loadingLatest ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
              Đang tải dữ liệu dự đoán...
            </div>
          ) : !prediction ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Layers size={40} className="mx-auto text-slate-400" />
              <p className="mt-3 font-semibold text-slate-700">
                Hiện chưa có bản dự đoán nào cho khách này
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Bấm nút tạo để hệ thống dựng lộ trình giai đoạn, các mốc thay
                đổi kỳ vọng và phần so sánh hình thể trước/sau.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoCard
                  label="Mục tiêu chính"
                  value={translateValue(sourceSummary.primaryGoal, GOAL_LABELS)}
                />
                <InfoCard
                  label="Cân nặng hiện tại"
                  value={
                    sourceSummary.currentWeightKg
                      ? `${sourceSummary.currentWeightKg} kg`
                      : "--"
                  }
                />
                <InfoCard
                  label="Tỷ lệ mỡ cơ thể hiện tại"
                  value={
                    sourceSummary.bodyFatPercent
                      ? `${sourceSummary.bodyFatPercent}%`
                      : "--"
                  }
                />
                <InfoCard
                  label="Mức thể chất hiện tại"
                  value={translateValue(
                    sourceSummary.overallPhysicalLevel,
                    PHYSICAL_LEVEL_LABELS,
                  )}
                />
              </div>

              <div className="space-y-3">
                <SectionHeading
                  title="Khung NASM 3 cấp độ / 5 phase"
                  subtitle="Cấu trúc chuẩn của NASM"
                />
                <F1NasmPyramid />
              </div>

              <div className="space-y-4">
                <SectionHeading
                  title="Lộ trình giai đoạn"
                  subtitle="Chọn từng tab để xem chi tiết"
                />
                <StageTabs
                  stages={prediction.phaseRoadmap || []}
                  selectedKey={selectedStageKey}
                  onSelect={setSelectedStageKey}
                />
                <StageDetailCard stage={selectedStage} />
              </div>

              <div className="space-y-4">
                <SectionHeading
                  title="Bảng kết quả theo từng giai đoạn"
                  subtitle="Mốc ban đầu và thay đổi kỳ vọng"
                />
                <OutcomeComparisonTable
                  outcomeTable={prediction.outcomeTable}
                />
              </div>

              <div className="space-y-4">
                <SectionHeading
                  title="So sánh hình ảnh before / after"
                  subtitle="Ảnh after theo phase đang chọn"
                />
                <VisualComparisonSection
                  prediction={prediction}
                  selectedVisualStage={selectedVisualStage}
                  onGenerateImages={handleGenerateStageImages}
                  generatingStageKey={generatingStageKey}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default F1ResultPredictionPanel;

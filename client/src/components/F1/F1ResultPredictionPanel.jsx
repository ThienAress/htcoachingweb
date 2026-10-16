// F1ResultPredictionPanel.jsx
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  RefreshCcw,
  TrendingUp,
  CalendarDays,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Lock,
  Pencil,
  PencilRuler,
  Plus,
  Trash2,
} from "lucide-react";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import {
  generateResultPrediction,
  getLatestResultPrediction,
  generateResultPredictionStageImages,
  getPhaseReviews,
  previewStageDesign,
  previewNextStageDesign,
  saveNextStageDesign,
  deleteLatestStage,
} from "../../services/f1Customer.service";
import { phaseReviewsQueryKey } from "../../utils/f1PhaseReview";
import { toast } from "react-toastify";
import { resolveMediaUrl } from "../../utils/mediaUrl";

import F1NasmPyramid from "./F1NasmPyramid";
import F1WeeklyScheduleView from "./stageDesign/F1WeeklyScheduleView";
import {
  PHASE_EXPLANATIONS,
  PHASE_NAMES,
  buildStageTabs,
  translateTrainingFocus,
} from "../../constants/f1Phases";

const F1PhaseReviewDialog = lazy(
  () => import("./phaseReview/F1PhaseReviewDialog"),
);
const F1PredictionModeDialog = lazy(
  () => import("./stageDesign/F1PredictionModeDialog"),
);
const F1StageDesignDialog = lazy(
  () => import("./stageDesign/F1StageDesignDialog"),
);
const F1StagePhotoSection = lazy(
  () => import("./phaseReview/F1StagePhotoSection"),
);

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

const MAX_ATTEMPTS_FALLBACK = 3;

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

// Cuối hàng tab luôn có "Thêm giai đoạn" và nút bút để bật chỉnh sửa. Khi chỉnh sửa, chỉ giai đoạn mới nhất
// (từ giai đoạn 2) sửa hoặc xoá được; các giai đoạn trước bị khoá để lộ trình đã đi qua không bị đổi.
const StageTabs = ({
  tabs = [],
  selectedKey,
  onSelect,
  canEdit = false,
  editMode = false,
  editableOrder = 0,
  onToggleEdit,
  onEdit,
  onDelete,
  onAdd,
  addDisabled = false,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-2">
    <div className="flex flex-wrap items-center gap-2" role="tablist">
      {tabs.map((tab) => {
        const active = tab.key === selectedKey;
        const showEdit = editMode && tab.stageOrder >= 2;
        const editable = tab.stageOrder === editableOrder;
        return (
          <div key={tab.key} className="inline-flex items-center gap-1">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(tab.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
            {showEdit &&
              (editable ? (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(tab.stageOrder)}
                    aria-label={`Sửa giai đoạn ${tab.stageOrder}`}
                    title="Sửa kết quả, mục tiêu hoặc nội dung giai đoạn"
                    className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-orange-700 transition-colors hover:bg-orange-100"
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(tab.stageOrder)}
                    aria-label={`Xoá giai đoạn ${tab.stageOrder}`}
                    title="Xoá giai đoạn"
                    className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <span
                  title="Đã khoá vì giai đoạn sau đã mở"
                  className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-400"
                >
                  <Lock size={14} aria-hidden="true" />
                  <span className="sr-only">Đã khoá</span>
                </span>
              ))}
          </div>
        );
      })}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={addDisabled}
          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 transition-colors hover:bg-orange-100 disabled:opacity-60"
        >
          <Plus size={14} aria-hidden="true" />
          Thêm giai đoạn
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={onToggleEdit}
            aria-pressed={editMode}
            aria-label={editMode ? "Xong chỉnh sửa" : "Chỉnh sửa giai đoạn"}
            title={editMode ? "Xong" : "Chỉnh sửa giai đoạn"}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
              editMode
                ? "border-orange-300 bg-orange-50 text-orange-800"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {editMode ? "Xong" : <Pencil size={14} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  </div>
);

const StageDetailCard = ({ stage, onShowFramework }) => {
  if (!stage) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 font-black text-orange-700">
            {stage.stageOrder}
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              Giai đoạn {stage.stageOrder}: {stage.phaseTitle}
            </h3>
            <p className="text-sm text-slate-500">{stage.levelTitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stage.designedByTrainer && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
              <PencilRuler size={14} aria-hidden="true" />
              HLV thiết kế
            </span>
          )}
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            <CalendarDays size={16} />
            {stage.durationWeeks} tuần
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-orange-50 p-4">
        <p className="text-sm font-bold text-orange-800">
          {PHASE_NAMES[stage.phaseKey] || stage.phaseTitle}
        </p>
        {PHASE_EXPLANATIONS[stage.phaseKey] && (
          <p className="mt-2 text-sm text-slate-700">
            {PHASE_EXPLANATIONS[stage.phaseKey]}{" "}
            {onShowFramework && (
              <button
                type="button"
                onClick={onShowFramework}
                className="font-semibold text-orange-700 underline underline-offset-2 hover:text-orange-800"
              >
                Xem vị trí giai đoạn này trong khung NASM ở trên.
              </button>
            )}
          </p>
        )}
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

      {stage.weeklySchedule && (
        <div className="mt-5">
          <F1WeeklyScheduleView schedule={stage.weeklySchedule} />
        </div>
      )}

      <div className="mt-5 rounded-lg bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">
          Vì sao lộ trình được xếp như vậy
        </p>
        <p className="mt-2 text-sm text-slate-700">{stage.entryReason}</p>
      </div>
    </div>
  );
};

const OutcomeComparisonTable = ({ outcomeTable, baselineTitle = "Ban đầu" }) => {
  const baseline = outcomeTable?.baseline || {};
  const checkpoints = outcomeTable?.phaseCheckpoints || [];
  const columns = [
    { key: "baseline", title: baselineTitle, data: baseline, isCurrent: true },
    ...checkpoints.map((item) => ({
      key: item.phaseKey,
      title: item.label,
      data: item.projected || {},
      range: item.projectedRange || {},
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
                    <span className="inline-flex rounded-full bg-orange-600 px-2 py-0.5 text-xs font-bold text-white">
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
                    {!col.isCurrent && col.range?.[row.key] && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        khoảng {col.range[row.key].min} – {col.range[row.key].max}
                        {row.suffix ? ` ${row.suffix}` : ""}
                      </p>
                    )}
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

const GoalProgressCard = ({ goalProgress }) => {
  if (!goalProgress || !goalProgress.summary) return null;
  const percent = goalProgress.achievedPercent;
  const tone =
    goalProgress.fitsTimeframe === false
      ? "border-amber-200 bg-amber-50"
      : "border-emerald-200 bg-emerald-50";
  return (
    <div className={`rounded-xl border p-5 ${tone}`}>
      <p className="text-sm font-bold text-slate-800">
        So với mục tiêu của khách
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <InfoCard
          label="Cân nặng mong muốn"
          value={
            goalProgress.targetWeightKg ? `${goalProgress.targetWeightKg} kg` : "—"
          }
        />
        <InfoCard
          label="Thời gian mong muốn"
          value={goalProgress.timeframeText || "—"}
        />
        <InfoCard
          label="Mức đạt cuối lộ trình"
          value={percent === null || percent === undefined ? "—" : `${percent}%`}
        />
      </div>
      <p className="mt-3 text-sm text-slate-700">{goalProgress.summary}</p>
    </div>
  );
};

const ImagePreviewCard = ({ title, imageUrl, emptyText }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-sm font-semibold text-slate-800">{title}</p>
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
      {imageUrl ? (
        <img
          src={resolveMediaUrl(imageUrl)}
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
          label="Ảnh trước tập (mặt trước)"
          value={hasBeforeFront ? "Đã có" : "Chưa có"}
        />
        <InfoCard
          label="Ảnh trước tập (mặt bên)"
          value={hasBeforeSide ? "Đã có" : "Chưa có"}
        />
        <InfoCard
          label="Ảnh sau tập (mặt trước)"
          value={hasAfterFront ? "Đã có" : "Chưa có"}
        />
        <InfoCard
          label="Ảnh sau tập (mặt bên)"
          value={hasAfterSide ? "Đã có" : "Chưa có"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-800">{afterLabel}</p>
          <p className="mt-1 text-sm text-slate-500">
            Mỗi lần tạo hoặc tạo lại ảnh AI đều có thể phát sinh chi phí.
          </p>
          <p className="mt-1 text-xs text-orange-600">
            Đã dùng {attemptCount}/{MAX_ATTEMPTS_FALLBACK} lượt cho phase này.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onGenerateImages(hasGeneratedImages)}
          disabled={!canGenerate || isGenerating || limitReached}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-3 font-bold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
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
          <h4 className="text-lg font-bold text-slate-800">Ảnh trước tập</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <ImagePreviewCard
              title="Trước tập • Mặt trước"
              imageUrl={beforeImages?.frontUrl || ""}
              emptyText="Chưa có ảnh trước tập (mặt trước) từ khảo sát"
            />
            <ImagePreviewCard
              title="Trước tập • Mặt bên"
              imageUrl={beforeImages?.sideUrl || ""}
              emptyText="Chưa có ảnh trước tập (mặt bên) từ khảo sát"
            />
          </div>
        </div>
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-800">{afterLabel}</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <ImagePreviewCard
              title="Sau tập • Mặt trước"
              imageUrl={selectedVisualStage?.images?.frontUrl || ""}
              emptyText="Chưa có ảnh sau tập (mặt trước)"
            />
            <ImagePreviewCard
              title="Sau tập • Mặt bên"
              imageUrl={selectedVisualStage?.images?.sideUrl || ""}
              emptyText="Chưa có ảnh sau tập (mặt bên)"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const F1ResultPredictionPanel = ({ customer, onBack, onGenerated }) => {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [prediction, setPrediction] = useState(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedStageKey, setSelectedStageKey] = useState("");
  const [generatingStageKey, setGeneratingStageKey] = useState("");
  const predictionRequestIdRef = useRef(crypto.randomUUID());
  const stageRequestIdsRef = useRef(new Map());
  const frameworkRef = useRef(null);
  const [openStage, setOpenStage] = useState(null);
  const [editMode, setEditMode] = useState(false);
  // Hộp chọn cách dựng giai đoạn, bảng HLV thiết kế và giai đoạn chờ thiết kế sau bước cập nhật mục tiêu.
  const [modeDialog, setModeDialog] = useState(null);
  const [designDialog, setDesignDialog] = useState(null);
  const [designAfter, setDesignAfter] = useState(null);
  const [savingDesign, setSavingDesign] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadLatest = async () => {
      if (!customer?._id) return;
      try {
        setLoadingLatest(true);
        const res = await getLatestResultPrediction(customer._id);
        setPrediction(res?.data || null);
      } catch {
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
  const phaseReviewsQuery = useQuery({
    queryKey: phaseReviewsQueryKey(customer?._id),
    queryFn: () => getPhaseReviews(customer._id),
    enabled: Boolean(customer?._id && prediction?._id),
  });
  const phaseReviews = phaseReviewsQuery.data?.data || null;
  const stageTabs = useMemo(
    () =>
      buildStageTabs(prediction?.phaseRoadmap || [], phaseReviews?.reviews || []),
    [prediction, phaseReviews],
  );
  // Giai đoạn 1 xem ngay trong trang; giai đoạn sau mở hộp thoại đánh giá cuối giai đoạn.
  const reviews = (phaseReviews?.reviews || []).filter((item) => item.profileConfirmed);
  const allReviewCount = (phaseReviews?.reviews || []).length;
  // Giai đoạn mở khoá thì xem ngay trong trang; giai đoạn đang khoá mở hộp thoại nhập kết quả.
  const handleSelectStage = (key) => {
    const tab = stageTabs.find((item) => item.key === key);
    if (tab?.locked) setOpenStage(tab.stageOrder);
    else setSelectedStageKey(key);
  };
  const visibleTabs = stageTabs.filter((tab) => !tab.locked);
  const pendingReview = allReviewCount > reviews.length;
  const nextStageOrder = pendingReview ? allReviewCount + 1 : reviews.length + 2;
  const selectedTab = stageTabs.find((tab) => tab.key === selectedStageKey);
  const followUpStage = selectedTab && !selectedTab.locked && selectedTab.stageOrder >= 2 ? selectedTab.stageOrder : 0;
  const followUpReview = followUpStage
    ? reviews.find((item) => item.stageOrder === followUpStage - 1)
    : null;
  const followUp = useMemo(() => {
    const plan = followUpReview?.nextPhasePlan;
    if (!plan) return null;
    return {
      stage: {
        stageOrder: followUpStage,
        phaseKey: plan.phaseKey,
        levelTitle: plan.levelTitle,
        phaseTitle: plan.phaseTitle,
        durationWeeks: plan.durationWeeks,
        objective: plan.objective,
        entryReason: plan.entryReason,
        keyFocus: plan.keyFocus,
        expectedChanges: plan.expectedChanges,
        exitCriteria: plan.exitCriteria,
        weeklySchedule: plan.weeklySchedule,
        designedByTrainer: followUpReview.nextPlanSource === "trainer",
      },
      outcomeTable: {
        baseline: { ...followUpReview.nextOutcome?.baseline, label: "Đầu giai đoạn" },
        phaseCheckpoints: [
          {
            ...followUpReview.nextOutcome?.checkpoint,
            label: `Kết thúc giai đoạn ${followUpStage}`,
          },
        ],
        goalProgress: followUpReview.nextOutcome?.goalProgress,
      },
    };
  }, [followUpReview, followUpStage]);
  const showFramework = () =>
    frameworkRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const selectedVisualStage = useMemo(() => {
    const stages = prediction?.visualStages || [];
    return (
      stages.find((item) => item.phaseKey === selectedStageKey) ||
      stages[0] ||
      null
    );
  }, [prediction, selectedStageKey]);

  const handleAddStage = () => {
    // Đã lưu kết quả cuối giai đoạn nhưng chưa cập nhật mục tiêu: tiếp tục đúng chỗ đang dở.
    if (pendingReview) setOpenStage(nextStageOrder);
    else setModeDialog({ stageOrder: nextStageOrder });
  };

  const handleDeleteStage = async (stageOrder) => {
    const confirmed = await confirm({
      title: `Xoá giai đoạn ${stageOrder}?`,
      message: `Mọi thông tin đã điền cho giai đoạn ${stageOrder} sẽ bị xoá vĩnh viễn.`,
      details: [
        `Kết quả cuối giai đoạn ${stageOrder - 1} và mục tiêu đã cập nhật.`,
        "Nội dung giai đoạn, lịch tập và bảng dự đoán.",
        "Ảnh hiện tại đã tải và ảnh dự đoán của giai đoạn.",
      ],
      confirmLabel: "Xoá giai đoạn",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await deleteLatestStage(customer._id, stageOrder - 1);
      queryClient.setQueryData(phaseReviewsQueryKey(customer._id), res);
      setSelectedStageKey(prediction?.phaseRoadmap?.[0]?.phaseKey || "");
      setEditMode(false);
      toast.success(res?.message || "Đã xoá giai đoạn");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Xoá giai đoạn thất bại");
    }
  };

  const openDesign = (stageOrder) => {
    if (stageOrder === 1) {
      const trainerPlan = prediction?.planSource === "trainer" ? prediction.phaseRoadmap?.[0] : null;
      setDesignDialog({
        stageOrder,
        plan: trainerPlan,
        overrides: trainerPlan ? prediction.outcomeTable?.phaseCheckpoints?.[0]?.overrides : null,
      });
      return;
    }
    const review = (phaseReviews?.reviews || []).find((item) => item.stageOrder === stageOrder - 1);
    setDesignDialog({
      stageOrder,
      plan: review?.nextPhasePlan || null,
      overrides: review?.nextOutcome?.checkpoint?.overrides || null,
    });
  };

  const handleSaveDesign = async (customStage) => {
    const { stageOrder } = designDialog;
    try {
      setSavingDesign(true);
      if (stageOrder === 1) {
        const res = await generateResultPrediction(customer._id, {
          requestId: predictionRequestIdRef.current,
          regenerate: Boolean(prediction),
          customStage,
        });
        predictionRequestIdRef.current = crypto.randomUUID();
        setPrediction(res?.data || null);
        queryClient.invalidateQueries({ queryKey: phaseReviewsQueryKey(customer._id) });
        onGenerated?.(res?.data);
        toast.success("Đã lưu lộ trình giai đoạn 1");
      } else {
        const res = await saveNextStageDesign(customer._id, stageOrder - 1, customStage);
        queryClient.setQueryData(phaseReviewsQueryKey(customer._id), res);
        setSelectedStageKey(`stage_${stageOrder}`);
        toast.success(res?.message || `Đã lưu lộ trình giai đoạn ${stageOrder}`);
      }
      setDesignDialog(null);
      setEditMode(false);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.errors?.[0]?.msg ||
          "Lưu lộ trình thất bại",
      );
    } finally {
      setSavingDesign(false);
    }
  };

  const handleGenerate = async () => {
    if (!customer?._id) return;
    try {
      setGenerating(true);
      const res = await generateResultPrediction(customer._id, {
        requestId: predictionRequestIdRef.current,
        regenerate: Boolean(prediction),
      });
      predictionRequestIdRef.current = crypto.randomUUID();
      setPrediction(res?.data || null);
      queryClient.invalidateQueries({
        queryKey: phaseReviewsQueryKey(customer._id),
      });
      toast.success("Đã tạo dự đoán kết quả thành công");
      setModeDialog(null);
      onGenerated?.(res?.data);
    } catch (error) {
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
    const confirmed = await confirm(
      forceRegenerate
        ? {
            title: "Tạo lại ảnh dự đoán?",
            message: `Bạn sắp tạo lại ảnh cho ${selectedVisualStage?.label || phaseKey}.`,
            details: [
              "Mỗi lần tạo lại sẽ phát sinh chi phí.",
              `Hiện đã dùng ${attemptCount}/${MAX_ATTEMPTS_FALLBACK} lượt.`,
            ],
            confirmLabel: "Tạo lại ảnh",
          }
        : {
            title: "Tạo ảnh dự đoán?",
            message: `Hệ thống sẽ tạo ảnh sau tập cho ${selectedVisualStage?.label || phaseKey}.`,
            details: ["Mỗi lần tạo ảnh sẽ phát sinh chi phí."],
            confirmLabel: "Tạo ảnh",
          },
    );
    if (!confirmed) return;
    try {
      setGeneratingStageKey(phaseKey);
      const requestId =
        stageRequestIdsRef.current.get(phaseKey) || crypto.randomUUID();
      stageRequestIdsRef.current.set(phaseKey, requestId);
      const res = await generateResultPredictionStageImages(
        customer._id,
        prediction._id,
        phaseKey,
        { forceRegenerate, requestId },
      );
      stageRequestIdsRef.current.delete(phaseKey);
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
      toast.error(
        error?.response?.data?.message || "Tạo ảnh AI cho phase thất bại",
      );
    } finally {
      setGeneratingStageKey("");
    }
  };

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      {confirmDialog}
      {modeDialog && (
        <Suspense fallback={null}>
          <F1PredictionModeDialog
            customer={customer}
            stageOrder={modeDialog.stageOrder}
            busy={generating}
            warning={
              modeDialog.stageOrder === 1 && allReviewCount > 0
                ? "Tạo lại giai đoạn 1 sẽ bắt đầu một lộ trình mới; các giai đoạn đã đánh giá sẽ không còn hiển thị."
                : ""
            }
            onClose={() => setModeDialog(null)}
            onSystem={() => {
              if (modeDialog.stageOrder === 1) {
                handleGenerate();
                return;
              }
              setModeDialog(null);
              setOpenStage(modeDialog.stageOrder);
            }}
            onTrainer={() => {
              const order = modeDialog.stageOrder;
              setModeDialog(null);
              if (order === 1) {
                openDesign(1);
                return;
              }
              setDesignAfter(order);
              setOpenStage(order);
            }}
          />
        </Suspense>
      )}
      {designDialog && (
        <Suspense fallback={null}>
          <F1StageDesignDialog
            customer={customer}
            stageOrder={designDialog.stageOrder}
            plan={designDialog.plan}
            overrides={designDialog.overrides}
            previewKey={["f1-stage-preview", customer?._id, designDialog.stageOrder]}
            fetchPreview={(stage) =>
              designDialog.stageOrder === 1
                ? previewStageDesign(customer._id, stage)
                : previewNextStageDesign(customer._id, designDialog.stageOrder - 1, stage)
            }
            saving={savingDesign}
            onSave={handleSaveDesign}
            onClose={() => setDesignDialog(null)}
          />
        </Suspense>
      )}
      {openStage && (
        <Suspense fallback={null}>
          <F1PhaseReviewDialog
            customer={customer}
            stageOrder={openStage}
            data={phaseReviews}
            loading={phaseReviewsQuery.isLoading}
            error={phaseReviewsQuery.isError}
            onClose={() => setOpenStage(null)}
            onProfileSaved={(order) => {
              setOpenStage(null);
              setEditMode(false);
              setSelectedStageKey(`stage_${order}`);
              // HLV chọn tự thiết kế: sau khi cập nhật mục tiêu thì mở bảng thiết kế giai đoạn.
              if (designAfter === order) {
                setDesignAfter(null);
                openDesign(order);
              }
            }}
            onDesign={(order) => {
              setOpenStage(null);
              openDesign(order);
            }}
          />
        </Suspense>
      )}
      <button
        onClick={onBack}
        className="group inline-flex items-center gap-2 text-slate-500 transition hover:text-orange-600"
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
              <h2 className="text-2xl font-extrabold text-slate-800 uppercase">
                {customer?.fullName}
              </h2>
              <p className="mt-1 text-slate-500">
                Toàn bộ lộ trình tập, kết quả kỳ vọng theo từng giai đoạn và
                phần so sánh trước/sau tập
              </p>
            </div>
            <button
              onClick={() => setModeDialog({ stageOrder: 1 })}
              disabled={generating || loadingLatest}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-3 font-bold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
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

              <div ref={frameworkRef} className="scroll-mt-6 space-y-3">
                <SectionHeading
                  title="Khung NASM 3 cấp độ / 5 giai đoạn"
                  subtitle="Cấu trúc chuẩn của NASM"
                />
                <F1NasmPyramid />
              </div>

              <div className="space-y-4">
                <SectionHeading
                  title="Lộ trình giai đoạn"
                  subtitle="Giai đoạn 1 được đề xuất từ kết quả đánh giá ban đầu. Bấm giai đoạn sau để nhập kết quả cuối giai đoạn trước và xem đề xuất tiếp theo."
                />
                <StageTabs
                  tabs={visibleTabs}
                  selectedKey={selectedStageKey}
                  onSelect={handleSelectStage}
                  canEdit={reviews.length > 0}
                  editMode={editMode}
                  editableOrder={pendingReview ? 0 : reviews.length + 1}
                  onToggleEdit={() => setEditMode((value) => !value)}
                  onEdit={setOpenStage}
                  onDelete={handleDeleteStage}
                  onAdd={handleAddStage}
                />
                <StageDetailCard
                  stage={
                    followUp
                      ? followUp.stage
                      : selectedStage && {
                          ...selectedStage,
                          designedByTrainer: prediction?.planSource === "trainer",
                        }
                  }
                  onShowFramework={showFramework}
                />
              </div>

              <div className="space-y-4">
                <SectionHeading
                  title={followUp ? `Bảng kết quả giai đoạn ${followUpStage}` : "Bảng kết quả theo từng giai đoạn"}
                  subtitle={
                    followUp
                      ? "Dự đoán bắt đầu từ số đo thực tế cuối giai đoạn trước"
                      : "Mốc ban đầu và thay đổi kỳ vọng"
                  }
                />
                <GoalProgressCard
                  goalProgress={(followUp || prediction).outcomeTable?.goalProgress}
                />
                <OutcomeComparisonTable
                  outcomeTable={(followUp || prediction).outcomeTable}
                  baselineTitle={followUp ? "Đầu giai đoạn" : "Ban đầu"}
                />
                <p className="text-xs text-slate-500">
                  Đây là ước tính tham khảo dựa trên hồ sơ hiện tại. Kết quả
                  thực tế phụ thuộc vào mức tuân thủ tập luyện, dinh dưỡng, giấc
                  ngủ và cơ địa từng người.
                </p>
              </div>

              <div className="space-y-4">
                <SectionHeading
                  title="So sánh hình ảnh trước / sau tập"
                  subtitle="Ảnh sau tập theo giai đoạn đang chọn"
                />
                {followUp ? (
                  <Suspense fallback={null}>
                    <F1StagePhotoSection
                      customerId={customer._id}
                      stageOrder={followUpStage}
                      visual={followUpReview?.visual || {}}
                      onConfirmGenerate={(force, attempts, maxAttempts) =>
                        confirm(
                          force
                            ? {
                                title: "Tạo lại ảnh dự đoán?",
                                message: `Bạn sắp tạo lại ảnh cho giai đoạn ${followUpStage}.`,
                                details: [
                                  "Mỗi lần tạo lại sẽ phát sinh chi phí.",
                                  `Hiện đã dùng ${attempts}/${maxAttempts} lượt.`,
                                ],
                                confirmLabel: "Tạo lại ảnh",
                              }
                            : {
                                title: "Tạo ảnh dự đoán?",
                                message: `Hệ thống sẽ tạo ảnh sau tập cho giai đoạn ${followUpStage} từ ảnh hiện tại.`,
                                details: ["Mỗi lần tạo ảnh sẽ phát sinh chi phí."],
                                confirmLabel: "Tạo ảnh",
                              },
                        )
                      }
                    />
                  </Suspense>
                ) : (
                  <VisualComparisonSection
                    prediction={prediction}
                    selectedVisualStage={selectedVisualStage}
                    onGenerateImages={handleGenerateStageImages}
                    generatingStageKey={generatingStageKey}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default F1ResultPredictionPanel;

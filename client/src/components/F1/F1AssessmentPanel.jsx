// F1AssessmentPanel.jsx
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Save, AlertTriangle, ClipboardList } from "lucide-react";
import {
  createAssessment,
  getLatestAssessment,
  getAssessmentStarterSuggestions,
  updateAssessment,
} from "../../services/f1Customer.service";
import StaticPostureSection from "./assessment/StaticPostureSection";
import OverheadSquatSection from "./assessment/OverheadSquatSection";
import StrengthAssessmentSection from "./assessment/StrengthAssessmentSection";
import EnduranceAssessmentSection from "./assessment/EnduranceAssessmentSection";
import CardioAssessmentSection from "./assessment/CardioAssessmentSection";

const initialMetricItem = {
  score: "",
  level: "",
  notes: "",
  sets: "",
  reps: "",
  durationSec: "",
  result: "",
  inputMode: "",
  selectedProtocol: null,
};

const createInitialAssessmentForm = () => ({
  postureAssessment: {
    feetAnkles: "",
    knees: "",
    lphc: "",
    shouldersThoracic: "",
    headNeck: "",
  },
  movementAssessment: {
    overheadSquat: { anterior: [], lateral: [], posterior: [] },
  },
  strengthAssessment: {
    upperBodyPush: { ...initialMetricItem },
    upperBodyPull: { ...initialMetricItem },
    lowerBody: { ...initialMetricItem },
    coreStrength: { ...initialMetricItem },
  },
  enduranceAssessment: {
    muscularEndurance: { ...initialMetricItem },
    coreEndurance: { ...initialMetricItem },
  },
  cardioAssessment: {
    cardioCapacity: { ...initialMetricItem },
    recoveryHeartRate: { ...initialMetricItem },
  },
  overallPhysicalLevel: "",
  assessorNotes: "",
});

const withMetricDefaults = (metric = {}) => ({
  ...initialMetricItem,
  ...(metric || {}),
});

const HoldReasonList = ({ items = [] }) => {
  if (!items.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-red-100 bg-white p-3 text-sm shadow-sm"
        >
          <p className="font-medium text-red-700">{item.label}</p>
          {Array.isArray(item.values) && item.values.length > 0 ? (
            <p className="mt-1">{item.values.join(", ")}</p>
          ) : (
            <p className="mt-1">{item.value || "Cần kiểm tra thêm"}</p>
          )}
        </div>
      ))}
    </div>
  );
};

const F1AssessmentPanel = ({ customer, onBack, onSubmitted }) => {
  const [formData, setFormData] = useState(createInitialAssessmentForm());
  const [latestAssessmentId, setLatestAssessmentId] = useState(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [starterSuggestions, setStarterSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    const loadLatest = async () => {
      if (!customer?._id) return;
      try {
        setLoadingLatest(true);
        const res = await getLatestAssessment(customer._id);
        const latest = res?.data;
        if (latest?._id) {
          setLatestAssessmentId(latest._id);
          setFormData({
            postureAssessment: {
              feetAnkles: latest?.postureAssessment?.feetAnkles || "",
              knees: latest?.postureAssessment?.knees || "",
              lphc: latest?.postureAssessment?.lphc || "",
              shouldersThoracic:
                latest?.postureAssessment?.shouldersThoracic || "",
              headNeck: latest?.postureAssessment?.headNeck || "",
            },
            movementAssessment: {
              overheadSquat: {
                anterior:
                  latest?.movementAssessment?.overheadSquat?.anterior || [],
                lateral:
                  latest?.movementAssessment?.overheadSquat?.lateral || [],
                posterior:
                  latest?.movementAssessment?.overheadSquat?.posterior || [],
              },
            },
            strengthAssessment: {
              upperBodyPush: withMetricDefaults(
                latest?.strengthAssessment?.upperBodyPush,
              ),
              upperBodyPull: withMetricDefaults(
                latest?.strengthAssessment?.upperBodyPull,
              ),
              lowerBody: withMetricDefaults(
                latest?.strengthAssessment?.lowerBody,
              ),
              coreStrength: withMetricDefaults(
                latest?.strengthAssessment?.coreStrength,
              ),
            },
            enduranceAssessment: {
              muscularEndurance: withMetricDefaults(
                latest?.enduranceAssessment?.muscularEndurance,
              ),
              coreEndurance: withMetricDefaults(
                latest?.enduranceAssessment?.coreEndurance,
              ),
            },
            cardioAssessment: {
              cardioCapacity: withMetricDefaults(
                latest?.cardioAssessment?.cardioCapacity,
              ),
              recoveryHeartRate: withMetricDefaults(
                latest?.cardioAssessment?.recoveryHeartRate,
              ),
            },
            overallPhysicalLevel: latest?.overallPhysicalLevel || "",
            assessorNotes: latest?.assessorNotes || "",
          });
        } else {
          setLatestAssessmentId(null);
          setFormData(createInitialAssessmentForm());
        }
      } catch (error) {
        console.error(error);
        setLatestAssessmentId(null);
        setFormData(createInitialAssessmentForm());
      } finally {
        setLoadingLatest(false);
      }
    };
    loadLatest();
  }, [customer?._id]);

  useEffect(() => {
    const loadStarterSuggestions = async () => {
      if (!customer?._id) return;
      try {
        setLoadingSuggestions(true);
        const res = await getAssessmentStarterSuggestions(customer._id);
        setStarterSuggestions(res?.data || null);
      } catch (error) {
        console.error(error);
        setStarterSuggestions(null);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    loadStarterSuggestions();
  }, [customer?._id]);

  const updatePosture = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      postureAssessment: { ...prev.postureAssessment, [field]: value },
    }));
  }, []);

  const toggleOhsa = useCallback((view, item) => {
    setFormData((prev) => {
      const current = prev.movementAssessment.overheadSquat[view];
      const next = current.includes(item)
        ? current.filter((x) => x !== item)
        : [...current, item];
      return {
        ...prev,
        movementAssessment: {
          ...prev.movementAssessment,
          overheadSquat: {
            ...prev.movementAssessment.overheadSquat,
            [view]: next,
          },
        },
      };
    });
  }, []);

  const updateStrengthMetric = useCallback((metric, field, value) => {
    setFormData((prev) => ({
      ...prev,
      strengthAssessment: {
        ...prev.strengthAssessment,
        [metric]: { ...prev.strengthAssessment[metric], [field]: value },
      },
    }));
  }, []);

  const updateEnduranceMetric = useCallback((metric, field, value) => {
    setFormData((prev) => ({
      ...prev,
      enduranceAssessment: {
        ...prev.enduranceAssessment,
        [metric]: { ...prev.enduranceAssessment[metric], [field]: value },
      },
    }));
  }, []);

  const updateCardioMetric = useCallback((metric, field, value) => {
    setFormData((prev) => ({
      ...prev,
      cardioAssessment: {
        ...prev.cardioAssessment,
        [metric]: { ...prev.cardioAssessment[metric], [field]: value },
      },
    }));
  }, []);

  const handleSubmit = async () => {
    if (!customer?._id) return;
    try {
      setSubmitting(true);
      const payload = {
        intakeId: customer?.lastIntakeId || customer?.intakeId || null,
        postureAssessment: formData.postureAssessment,
        movementAssessment: formData.movementAssessment,
        strengthAssessment: formData.strengthAssessment,
        enduranceAssessment: formData.enduranceAssessment,
        cardioAssessment: {
          cardioCapacity: formData.cardioAssessment.cardioCapacity,
          recoveryHeartRate: formData.cardioAssessment.recoveryHeartRate,
        },
        assessorNotes: formData.assessorNotes,
      };
      let res;
      if (latestAssessmentId) {
        res = await updateAssessment(customer._id, latestAssessmentId, payload);
        alert("Cập nhật đánh giá thể chất thành công");
      } else {
        res = await createAssessment(customer._id, payload);
        alert("Lưu đánh giá thể chất thành công");
      }
      const saved = res?.data || null;
      if (saved?._id) {
        setLatestAssessmentId(saved._id);
        setFormData((prev) => ({
          ...prev,
          overallPhysicalLevel:
            saved?.overallPhysicalLevel || prev.overallPhysicalLevel,
        }));
      }
      onSubmitted?.(saved);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Lưu đánh giá thể chất thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const strengthSuggestions = starterSuggestions?.sections?.strength || [];
  const enduranceSuggestions = starterSuggestions?.sections?.endurance || [];
  const cardioSuggestions = starterSuggestions?.sections?.cardio || [];

  return (
    <section className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
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
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-600">
              <ClipboardList size={22} />
            </div>
            <div>
              <p className="text-sm text-slate-500">
                Đánh giá thể chất • {customer?.code || "--"}
              </p>
              <h2 className="text-2xl font-extrabold text-slate-800">
                {customer?.fullName}
              </h2>
              <p className="mt-1 text-slate-500">
                Tư thế, chuyển động, sức mạnh, sức bền và tim mạch
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 md:px-8">
          {customer?.testPermission === "hold_test" &&
            (customer?.holdReasons?.length || 0) > 0 && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-700" />
                  <p className="font-bold text-red-700">
                    Hệ thống đang cảnh báo HOLD TEST
                  </p>
                </div>
                <p className="mt-2 text-sm text-red-700">
                  Đây là các field đang làm khách bị hold:
                </p>
                <HoldReasonList items={customer.holdReasons || []} />
              </div>
            )}

          {loadingLatest ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
              Đang tải đánh giá thể chất...
            </div>
          ) : (
            <div className="space-y-8">
              <StaticPostureSection
                value={formData.postureAssessment}
                onChange={updatePosture}
              />
              <OverheadSquatSection
                value={formData.movementAssessment.overheadSquat}
                onToggle={toggleOhsa}
              />
              <StrengthAssessmentSection
                value={formData.strengthAssessment}
                onChange={updateStrengthMetric}
                suggestions={strengthSuggestions}
                loadingSuggestions={loadingSuggestions}
              />
              <EnduranceAssessmentSection
                value={formData.enduranceAssessment}
                onChange={updateEnduranceMetric}
                suggestions={enduranceSuggestions}
                loadingSuggestions={loadingSuggestions}
              />
              <CardioAssessmentSection
                value={formData.cardioAssessment}
                onMetricChange={updateCardioMetric}
                suggestions={cardioSuggestions}
                loadingSuggestions={loadingSuggestions}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-800">
                    Mức thể chất tổng thể
                  </span>
                  <input
                    value={
                      {
                        low: "Thấp",
                        below_average: "Dưới trung bình",
                        average: "Trung bình",
                        good: "Tốt",
                      }[formData.overallPhysicalLevel] || ""
                    }
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-700 outline-none"
                    placeholder="Hệ thống tự tính"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Ghi chú tổng hợp
                </span>
                <textarea
                  rows={5}
                  value={formData.assessorNotes}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      assessorNotes: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="Tổng hợp điểm mạnh, điểm yếu, ưu tiên corrective, hạn chế hiện tại..."
                />
              </label>

              <div className="flex justify-start pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || loadingLatest}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-3 font-bold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
                >
                  <Save size={18} />
                  {submitting
                    ? "Đang lưu..."
                    : latestAssessmentId
                      ? "Cập nhật đánh giá thể chất"
                      : "Lưu đánh giá thể chất"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default F1AssessmentPanel;

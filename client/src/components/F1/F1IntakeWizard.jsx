// F1IntakeWizard.jsx
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Save,
  ClipboardList,
} from "lucide-react";
import {
  createF1Media,
  getLatestIntake,
  saveIntakeDraft,
  submitIntake,
} from "../../services/f1Customer.service";

import StepCustomerInfo from "./intake/StepCustomerInfo";
import StepHealthScreening from "./intake/StepHealthScreening";
import StepLifestyleNutrition from "./intake/StepLifestyleNutrition";
import StepBodyMetrics from "./intake/StepBodyMetrics";
import StepTrainingGoal from "./intake/StepTrainingGoal";
import StepPostureMedia from "./intake/StepPostureMedia";

const intakeSteps = [
  "Thông tin",
  "Sức khỏe",
  "Lifestyle",
  "Chỉ số cơ thể",
  "Tập luyện & mục tiêu",
  "Ảnh posture",
];

const createInitialForm = (customer = {}) => ({
  customerInfo: {
    fullName: customer?.fullName || "",
    age: customer?.age || "",
    gender: customer?.gender || "",
    occupation: customer?.occupation || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
  },
  healthScreening: {
    hasPainNow: false,
    painLocation: "",
    painLevel: 0,
    injuries: "",
    currentConditions: "",
    surgeries: "",
    medications: "",
    doctorRestrictions: "",
    warningSigns: [],
  },
  lifestyleNutrition: {
    mealsPerDay: "",
    usuallyEatOut: false,
    foodAllergies: "",
    drinkEnoughWater: false,
    sleepHours: "",
    stressLevel: "",
    workActivityLevel: "",
  },
  bodyMetrics: {
    heightCm: "",
    weightKg: "",
    bodyFatPercent: "",
    waistCm: "",
    hipCm: "",
    restingHeartRate: "",
  },
  trainingProfileGoal: {
    currentlyTraining: false,
    trainingDaysPerWeek: "",
    sessionDurationMinutes: "",
    sportsHistory: "",
    trainingExperience: "",
    breakDuration: "",
    primaryGoal: "",
    targetWeightKg: "",
    targetDeadline: "",
  },
  postureMedia: {
    frontImage: null,
    backImage: null,
    sideImage: null,
  },
  consent: {
    allowDataStorage: true,
    allowMediaStorage: true,
    allowAiAnalysis: true,
  },
});

const normalizeArrayToText = (value) => {
  if (Array.isArray(value)) return value.join(", ");
  return value || "";
};

const normalizeOptionalHealthText = (value = "") => {
  const normalized = String(value || "").trim();
  const negativeWords = ["không", "khong", "none", "no", "không có"];
  if (negativeWords.includes(normalized.toLowerCase())) return "";
  return normalized;
};

const normalizeHealthScreening = (health = {}) => {
  const hasPainNow = Boolean(health.hasPainNow);
  return {
    ...health,
    hasPainNow,
    painLevel: hasPainNow ? Number(health.painLevel) || 0 : 0,
    painLocation: hasPainNow
      ? health.painLocation
        ? String(health.painLocation)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : []
      : [],
    injuries: normalizeOptionalHealthText(health.injuries),
    currentConditions: normalizeOptionalHealthText(health.currentConditions),
    surgeries: normalizeOptionalHealthText(health.surgeries),
    medications: normalizeOptionalHealthText(health.medications),
    doctorRestrictions: normalizeOptionalHealthText(health.doctorRestrictions),
    warningSigns: Array.isArray(health.warningSigns) ? health.warningSigns : [],
  };
};

const normalizeTrainingProfileGoal = (training = {}) => {
  const currentlyTraining = Boolean(training.currentlyTraining);
  const trainingExperience = String(training.trainingExperience || "").trim();
  const normalizedSportsHistory = training.sportsHistory
    ? String(training.sportsHistory)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const targetWeightKg =
    training.targetWeightKg !== "" &&
    training.targetWeightKg !== null &&
    training.targetWeightKg !== undefined
      ? Number(training.targetWeightKg) || null
      : null;
  const targetDeadline = training.targetDeadline || null;

  if (!currentlyTraining) {
    return {
      currentlyTraining: false,
      trainingDaysPerWeek: 0,
      sessionDurationMinutes: 0,
      trainingExperience,
      breakDuration:
        trainingExperience && trainingExperience !== "none"
          ? String(training.breakDuration || "").trim()
          : "",
      sportsHistory:
        trainingExperience && trainingExperience !== "none"
          ? normalizedSportsHistory
          : [],
      primaryGoal: String(training.primaryGoal || "").trim(),
      targetWeightKg,
      targetDeadline,
    };
  }
  return {
    currentlyTraining: true,
    trainingDaysPerWeek: Number(training.trainingDaysPerWeek) || 0,
    sessionDurationMinutes: Number(training.sessionDurationMinutes) || 0,
    trainingExperience,
    breakDuration: "",
    sportsHistory: normalizedSportsHistory,
    primaryGoal: String(training.primaryGoal || "").trim(),
    targetWeightKg,
    targetDeadline,
  };
};

const validateTrainingGoalStep = (training = {}) => {
  const errors = {};
  const isCurrentlyTraining = Boolean(training.currentlyTraining);
  const trainingExperience = String(training.trainingExperience || "").trim();
  const breakDuration = String(training.breakDuration || "").trim();
  const primaryGoal = String(training.primaryGoal || "").trim();
  const trainingDaysPerWeek = Number(training.trainingDaysPerWeek);
  const sessionDurationMinutes = Number(training.sessionDurationMinutes);

  if (isCurrentlyTraining) {
    if (
      !Number.isInteger(trainingDaysPerWeek) ||
      trainingDaysPerWeek <= 0 ||
      trainingDaysPerWeek > 14
    ) {
      errors.trainingDaysPerWeek =
        "Nếu khách đang tập, số ngày tập/tuần phải từ 1 đến 14";
    }
    if (
      !Number.isInteger(sessionDurationMinutes) ||
      sessionDurationMinutes <= 0 ||
      sessionDurationMinutes > 600
    ) {
      errors.sessionDurationMinutes =
        "Nếu khách đang tập, thời lượng buổi tập phải từ 1 đến 600 phút";
    }
    if (!trainingExperience)
      errors.trainingExperience = "Vui lòng chọn kinh nghiệm tập luyện";
  } else {
    if (!trainingExperience)
      errors.trainingExperience =
        "Vui lòng chọn khách chưa từng tập hay đã từng tập";
    if (trainingExperience !== "none" && !breakDuration)
      errors.breakDuration = "Vui lòng nhập khách đã nghỉ tập bao lâu";
  }
  if (!primaryGoal) errors.primaryGoal = "Vui lòng chọn mục tiêu chính";
  if (
    training.targetWeightKg !== "" &&
    training.targetWeightKg !== null &&
    training.targetWeightKg !== undefined
  ) {
    const targetWeight = Number(training.targetWeightKg);
    if (
      !Number.isFinite(targetWeight) ||
      targetWeight < 10 ||
      targetWeight > 300
    ) {
      errors.targetWeightKg = "Cân nặng mong muốn không hợp lệ";
    }
  }
  if (training.targetDeadline) {
    const date = new Date(training.targetDeadline);
    if (Number.isNaN(date.getTime()))
      errors.targetDeadline = "Thời gian mong muốn không hợp lệ";
  }
  return errors;
};

const mergeLatestIntoForm = (baseForm, latest) => ({
  ...baseForm,
  customerInfo: { ...baseForm.customerInfo, ...(latest?.customerInfo || {}) },
  healthScreening: {
    ...baseForm.healthScreening,
    ...(latest?.healthScreening || {}),
    painLocation: normalizeArrayToText(latest?.healthScreening?.painLocation),
    warningSigns: latest?.healthScreening?.warningSigns || [],
  },
  lifestyleNutrition: {
    ...baseForm.lifestyleNutrition,
    ...(latest?.lifestyleNutrition || {}),
  },
  bodyMetrics: {
    heightCm: latest?.bodyMetrics?.heightCm ?? "",
    weightKg: latest?.bodyMetrics?.weightKg ?? "",
    bodyFatPercent: latest?.bodyMetrics?.bodyFatPercent ?? "",
    waistCm: latest?.bodyMetrics?.waistCm ?? "",
    hipCm: latest?.bodyMetrics?.hipCm ?? "",
    restingHeartRate: latest?.bodyMetrics?.restingHeartRate ?? "",
  },
  trainingProfileGoal: {
    currentlyTraining: Boolean(latest?.trainingProfileGoal?.currentlyTraining),
    trainingDaysPerWeek: latest?.trainingProfileGoal?.trainingDaysPerWeek ?? "",
    sessionDurationMinutes:
      latest?.trainingProfileGoal?.sessionDurationMinutes ?? "",
    sportsHistory: normalizeArrayToText(
      latest?.trainingProfileGoal?.sportsHistory,
    ),
    trainingExperience: latest?.trainingProfileGoal?.trainingExperience || "",
    breakDuration: latest?.trainingProfileGoal?.breakDuration || "",
    primaryGoal: latest?.trainingProfileGoal?.primaryGoal || "",
    targetWeightKg: latest?.trainingProfileGoal?.targetWeightKg ?? "",
    targetDeadline: latest?.trainingProfileGoal?.targetDeadline
      ? String(latest.trainingProfileGoal.targetDeadline).slice(0, 10)
      : "",
  },
  consent: { ...baseForm.consent, ...(latest?.consent || {}) },
});

const isBrowserFile = (value) =>
  typeof File !== "undefined" && value instanceof File;

const F1IntakeWizard = ({ customer, onBack, onSubmitted }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(createInitialForm(customer));
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [stepErrors, setStepErrors] = useState({});

  useEffect(() => {
    setFormData(createInitialForm(customer));
    setCurrentStep(1);
    setStepErrors({});
  }, [customer?._id]);

  useEffect(() => {
    const loadLatest = async () => {
      if (!customer?._id) return;
      try {
        setLoadingLatest(true);
        const res = await getLatestIntake(customer._id);
        const latest = res?.data;
        if (latest) {
          const baseForm = createInitialForm(customer);
          const merged = mergeLatestIntoForm(baseForm, latest);
          setFormData(merged);
          setCurrentStep(latest?.draftStep || 1);
        } else {
          setFormData(createInitialForm(customer));
          setCurrentStep(1);
        }
      } catch (error) {
        console.error(error);
        setFormData(createInitialForm(customer));
        setCurrentStep(1);
      } finally {
        setLoadingLatest(false);
      }
    };
    loadLatest();
  }, [customer?._id]);

  useEffect(() => {
    if (currentStep !== 5 && Object.keys(stepErrors).length > 0)
      setStepErrors({});
  }, [currentStep, stepErrors]);

  const bmi = useMemo(() => {
    const h = Number(formData.bodyMetrics.heightCm);
    const w = Number(formData.bodyMetrics.weightKg);
    if (!h || !w) return "";
    const heightM = h / 100;
    return (w / (heightM * heightM)).toFixed(1);
  }, [formData.bodyMetrics.heightCm, formData.bodyMetrics.weightKg]);

  const waistHipRatio = useMemo(() => {
    const waist = Number(formData.bodyMetrics.waistCm);
    const hip = Number(formData.bodyMetrics.hipCm);
    if (!waist || !hip) return "";
    return (waist / hip).toFixed(2);
  }, [formData.bodyMetrics.waistCm, formData.bodyMetrics.hipCm]);

  const clearTrainingGoalError = (field) => {
    setStepErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const updateSection = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
    if (section === "trainingProfileGoal") {
      clearTrainingGoalError(field);
      if (field === "currentlyTraining") {
        clearTrainingGoalError("trainingDaysPerWeek");
        clearTrainingGoalError("sessionDurationMinutes");
        clearTrainingGoalError("trainingExperience");
        clearTrainingGoalError("breakDuration");
      }
      if (field === "trainingExperience")
        clearTrainingGoalError("breakDuration");
    }
  };

  const toggleWarningSign = (value) => {
    setFormData((prev) => {
      const exists = prev.healthScreening.warningSigns.includes(value);
      return {
        ...prev,
        healthScreening: {
          ...prev.healthScreening,
          warningSigns: exists
            ? prev.healthScreening.warningSigns.filter((item) => item !== value)
            : [...prev.healthScreening.warningSigns, value],
        },
      };
    });
  };

  const updatePostureMedia = (field, file) => {
    setFormData((prev) => ({
      ...prev,
      postureMedia: { ...prev.postureMedia, [field]: file },
    }));
  };

  const getStepPayload = (step) => {
    switch (step) {
      case 1:
        return { customerInfo: formData.customerInfo };
      case 2:
        return {
          healthScreening: normalizeHealthScreening(formData.healthScreening),
        };
      case 3:
        return { lifestyleNutrition: formData.lifestyleNutrition };
      case 4:
        return {
          bodyMetrics: {
            heightCm:
              formData.bodyMetrics.heightCm !== ""
                ? Number(formData.bodyMetrics.heightCm) || null
                : null,
            weightKg:
              formData.bodyMetrics.weightKg !== ""
                ? Number(formData.bodyMetrics.weightKg) || null
                : null,
            bodyFatPercent:
              formData.bodyMetrics.bodyFatPercent !== ""
                ? Number(formData.bodyMetrics.bodyFatPercent) || null
                : null,
            waistCm:
              formData.bodyMetrics.waistCm !== ""
                ? Number(formData.bodyMetrics.waistCm) || null
                : null,
            hipCm:
              formData.bodyMetrics.hipCm !== ""
                ? Number(formData.bodyMetrics.hipCm) || null
                : null,
            restingHeartRate:
              formData.bodyMetrics.restingHeartRate !== ""
                ? Number(formData.bodyMetrics.restingHeartRate) || null
                : null,
            bmi: bmi || null,
            waistHipRatio: waistHipRatio || null,
          },
        };
      case 5:
        return {
          trainingProfileGoal: normalizeTrainingProfileGoal(
            formData.trainingProfileGoal,
          ),
        };
      case 6:
        return {
          postureMediaSummary: {
            frontImageUploaded: !!formData.postureMedia.frontImage,
            backImageUploaded: !!formData.postureMedia.backImage,
            sideImageUploaded: !!formData.postureMedia.sideImage,
          },
          consent: formData.consent,
        };
      default:
        return {};
    }
  };

  const validateCurrentStep = () => {
    if (currentStep === 1) {
      if (!formData.customerInfo.fullName.trim()) {
        alert("Vui lòng nhập họ và tên");
        return false;
      }
      if (!formData.customerInfo.age) {
        alert("Vui lòng nhập tuổi");
        return false;
      }
      if (!formData.customerInfo.gender) {
        alert("Vui lòng chọn giới tính");
        return false;
      }
    }
    if (currentStep === 4) {
      if (!formData.bodyMetrics.heightCm || !formData.bodyMetrics.weightKg) {
        alert("Vui lòng nhập chiều cao và cân nặng");
        return false;
      }
    }
    if (currentStep === 5) {
      const nextErrors = validateTrainingGoalStep(formData.trainingProfileGoal);
      setStepErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    }
    if (currentStep === 6) {
      if (
        !formData.consent.allowDataStorage ||
        !formData.consent.allowAiAnalysis
      ) {
        alert("Vui lòng đồng ý lưu dữ liệu và AI hỗ trợ phân tích");
        return false;
      }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!customer?._id) return;
    try {
      setSavingDraft(true);
      await saveIntakeDraft(customer._id, {
        step: currentStep,
        data: getStepPayload(currentStep),
      });
      alert("Đã lưu nháp");
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Lưu nháp thất bại");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleNextStep = () => {
    if (!validateCurrentStep()) return;
    if (currentStep >= intakeSteps.length) return;
    setCurrentStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    if (currentStep <= 1) return;
    setCurrentStep((prev) => prev - 1);
  };

  const uploadMediaFile = async ({ file, type, intakeId }) => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    if (intakeId) form.append("intakeId", intakeId);
    return createF1Media(customer._id, form);
  };

  const handleSubmit = async () => {
    if (!customer?._id) return;
    if (!validateCurrentStep()) return;
    try {
      setSubmitting(true);
      let intakeId = customer?.lastIntakeId || null;
      const hasSelectedPostureFiles =
        isBrowserFile(formData.postureMedia.frontImage) ||
        isBrowserFile(formData.postureMedia.backImage) ||
        isBrowserFile(formData.postureMedia.sideImage);
      if (hasSelectedPostureFiles) {
        const draftRes = await saveIntakeDraft(customer._id, {
          step: 6,
          data: getStepPayload(6),
        });
        intakeId = draftRes?.data?._id || intakeId;
        const uploadTasks = [];
        if (isBrowserFile(formData.postureMedia.frontImage)) {
          uploadTasks.push(
            uploadMediaFile({
              file: formData.postureMedia.frontImage,
              type: "posture_front",
              intakeId,
            }),
          );
          uploadTasks.push(
            uploadMediaFile({
              file: formData.postureMedia.frontImage,
              type: "before_front",
              intakeId,
            }),
          );
        }
        if (isBrowserFile(formData.postureMedia.backImage)) {
          uploadTasks.push(
            uploadMediaFile({
              file: formData.postureMedia.backImage,
              type: "posture_back",
              intakeId,
            }),
          );
        }
        if (isBrowserFile(formData.postureMedia.sideImage)) {
          uploadTasks.push(
            uploadMediaFile({
              file: formData.postureMedia.sideImage,
              type: "posture_side",
              intakeId,
            }),
          );
          uploadTasks.push(
            uploadMediaFile({
              file: formData.postureMedia.sideImage,
              type: "before_side",
              intakeId,
            }),
          );
        }
        if (uploadTasks.length > 0) await Promise.all(uploadTasks);
      }
      const payload = {
        customerInfo: {
          ...formData.customerInfo,
          age: Number(formData.customerInfo.age) || null,
        },
        healthScreening: normalizeHealthScreening(formData.healthScreening),
        lifestyleNutrition: {
          ...formData.lifestyleNutrition,
          mealsPerDay: Number(formData.lifestyleNutrition.mealsPerDay) || null,
          sleepHours: Number(formData.lifestyleNutrition.sleepHours) || null,
        },
        bodyMetrics: {
          heightCm:
            formData.bodyMetrics.heightCm !== ""
              ? Number(formData.bodyMetrics.heightCm) || null
              : null,
          weightKg:
            formData.bodyMetrics.weightKg !== ""
              ? Number(formData.bodyMetrics.weightKg) || null
              : null,
          bodyFatPercent:
            formData.bodyMetrics.bodyFatPercent !== ""
              ? Number(formData.bodyMetrics.bodyFatPercent) || null
              : null,
          waistCm:
            formData.bodyMetrics.waistCm !== ""
              ? Number(formData.bodyMetrics.waistCm) || null
              : null,
          hipCm:
            formData.bodyMetrics.hipCm !== ""
              ? Number(formData.bodyMetrics.hipCm) || null
              : null,
          restingHeartRate:
            formData.bodyMetrics.restingHeartRate !== ""
              ? Number(formData.bodyMetrics.restingHeartRate) || null
              : null,
          bmi: bmi || null,
          waistHipRatio: waistHipRatio || null,
        },
        trainingProfileGoal: normalizeTrainingProfileGoal(
          formData.trainingProfileGoal,
        ),
        postureMediaSummary: {
          frontImageUploaded: !!formData.postureMedia.frontImage,
          backImageUploaded: !!formData.postureMedia.backImage,
          sideImageUploaded: !!formData.postureMedia.sideImage,
        },
        consent: formData.consent,
      };
      const res = await submitIntake(customer._id, payload);
      alert("Hoàn tất intake thành công");
      onSubmitted?.({ ...res?.data, customerId: customer._id });
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Submit intake thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepCustomerInfo
            value={formData.customerInfo}
            onChange={(field, value) =>
              updateSection("customerInfo", field, value)
            }
          />
        );
      case 2:
        return (
          <StepHealthScreening
            value={formData.healthScreening}
            onChange={(field, value) =>
              updateSection("healthScreening", field, value)
            }
            onToggleWarningSign={toggleWarningSign}
          />
        );
      case 3:
        return (
          <StepLifestyleNutrition
            value={formData.lifestyleNutrition}
            onChange={(field, value) =>
              updateSection("lifestyleNutrition", field, value)
            }
          />
        );
      case 4:
        return (
          <StepBodyMetrics
            value={formData.bodyMetrics}
            bmi={bmi}
            waistHipRatio={waistHipRatio}
            onChange={(field, value) =>
              updateSection("bodyMetrics", field, value)
            }
          />
        );
      case 5:
        return (
          <StepTrainingGoal
            value={formData.trainingProfileGoal}
            onChange={(field, value) =>
              updateSection("trainingProfileGoal", field, value)
            }
            errors={stepErrors}
          />
        );
      case 6:
        return (
          <StepPostureMedia
            value={formData.postureMedia}
            consent={formData.consent}
            onMediaChange={updatePostureMedia}
            onConsentChange={(field, value) =>
              updateSection("consent", field, value)
            }
          />
        );
      default:
        return null;
    }
  };

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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">
                Intake NASM • {customer?.code || "--"}
              </p>
              <h2 className="text-2xl font-extrabold text-slate-800">
                {customer?.fullName}
              </h2>
              <p className="mt-1 text-slate-500">
                Bước {currentStep}/{intakeSteps.length} •{" "}
                {intakeSteps[currentStep - 1]}
              </p>
            </div>
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft || loadingLatest}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Save size={18} />
              {savingDraft ? "Đang lưu..." : "Lưu nháp"}
            </button>
          </div>
        </div>

        <div className="px-6 py-6 md:px-8">
          <div className="mb-8 grid grid-cols-2 gap-2 md:grid-cols-6">
            {intakeSteps.map((item, index) => {
              const stepNumber = index + 1;
              const active = currentStep === stepNumber;
              const done = currentStep > stepNumber;
              return (
                <div
                  key={item}
                  className={`rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md"
                      : done
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-50 text-slate-500"
                  }`}
                >
                  {item}
                </div>
              );
            })}
          </div>

          {loadingLatest ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
              Đang tải dữ liệu intake...
            </div>
          ) : (
            renderStep()
          )}

          <div className="mt-8 flex flex-wrap justify-between gap-3">
            <button
              onClick={handlePrevStep}
              disabled={currentStep === 1 || loadingLatest}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft size={18} />
              Quay lại
            </button>
            {currentStep < intakeSteps.length ? (
              <button
                onClick={handleNextStep}
                disabled={loadingLatest}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-3 font-bold text-white shadow-md transition hover:shadow-lg"
              >
                Tiếp theo
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || loadingLatest}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3 font-bold text-white shadow-md transition hover:shadow-lg"
              >
                {submitting ? "Đang submit..." : "Hoàn tất intake"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default F1IntakeWizard;

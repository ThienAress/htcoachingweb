import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ChevronLeft, ChevronRight, Save, ClipboardList } from "lucide-react";

import { intakeSchema } from "./intake/schema";
import { useLatestIntake, useSaveIntakeDraft, useSubmitIntake, useUploadF1Media } from "./intake/useIntake";

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

const isBrowserFile = (value) => typeof File !== "undefined" && value instanceof File;

const F1IntakeWizard = ({ customer, onBack, onSubmitted }) => {
  const [currentStep, setCurrentStep] = useState(1);

  // TanStack Query Hooks
  const { data: latestIntake, isLoading: loadingLatest } = useLatestIntake(customer?._id);
  const saveDraftMutation = useSaveIntakeDraft();
  const submitMutation = useSubmitIntake();
  const uploadMediaMutation = useUploadF1Media();

  // React Hook Form
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    reset,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
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
    }
  });

  // Sync latest draft data into form
  useEffect(() => {
    if (latestIntake) {
      const merged = {
        customerInfo: { ...latestIntake.customerInfo, fullName: latestIntake.customerInfo?.fullName || customer?.fullName || "", age: latestIntake.customerInfo?.age || customer?.age || "" },
        healthScreening: {
          ...latestIntake.healthScreening,
          painLocation: Array.isArray(latestIntake.healthScreening?.painLocation) ? latestIntake.healthScreening.painLocation.join(", ") : (latestIntake.healthScreening?.painLocation || ""),
          warningSigns: latestIntake.healthScreening?.warningSigns || [],
        },
        lifestyleNutrition: {
          ...latestIntake.lifestyleNutrition,
          mealsPerDay: latestIntake.lifestyleNutrition?.mealsPerDay ?? "",
          sleepHours: latestIntake.lifestyleNutrition?.sleepHours ?? "",
        },
        bodyMetrics: {
          heightCm: latestIntake.bodyMetrics?.heightCm ?? "",
          weightKg: latestIntake.bodyMetrics?.weightKg ?? "",
          bodyFatPercent: latestIntake.bodyMetrics?.bodyFatPercent ?? "",
          waistCm: latestIntake.bodyMetrics?.waistCm ?? "",
          hipCm: latestIntake.bodyMetrics?.hipCm ?? "",
          restingHeartRate: latestIntake.bodyMetrics?.restingHeartRate ?? "",
        },
        trainingProfileGoal: {
          currentlyTraining: Boolean(latestIntake.trainingProfileGoal?.currentlyTraining),
          trainingDaysPerWeek: latestIntake.trainingProfileGoal?.trainingDaysPerWeek ?? "",
          sessionDurationMinutes: latestIntake.trainingProfileGoal?.sessionDurationMinutes ?? "",
          sportsHistory: Array.isArray(latestIntake.trainingProfileGoal?.sportsHistory) ? latestIntake.trainingProfileGoal.sportsHistory.join(", ") : (latestIntake.trainingProfileGoal?.sportsHistory || ""),
          trainingExperience: latestIntake.trainingProfileGoal?.trainingExperience || "",
          breakDuration: latestIntake.trainingProfileGoal?.breakDuration || "",
          primaryGoal: latestIntake.trainingProfileGoal?.primaryGoal || "",
          targetWeightKg: latestIntake.trainingProfileGoal?.targetWeightKg ?? "",
          targetDeadline: latestIntake.trainingProfileGoal?.targetDeadline ? String(latestIntake.trainingProfileGoal.targetDeadline).slice(0, 10) : "",
        },
        consent: latestIntake.consent || { allowDataStorage: true, allowMediaStorage: true, allowAiAnalysis: true },
        postureMedia: { frontImage: null, backImage: null, sideImage: null } // We do not have files from backend
      };
      reset(merged);
      setCurrentStep(latestIntake.draftStep || 1);
    }
  }, [latestIntake, customer, reset]);

  // Derived values for BMI
  const heightCm = watch("bodyMetrics.heightCm");
  const weightKg = watch("bodyMetrics.weightKg");
  const waistCm = watch("bodyMetrics.waistCm");
  const hipCm = watch("bodyMetrics.hipCm");
  
  const bmi = useMemo(() => {
    const h = Number(heightCm);
    const w = Number(weightKg);
    if (!h || !w) return "";
    const heightM = h / 100;
    return (w / (heightM * heightM)).toFixed(1);
  }, [heightCm, weightKg]);

  const waistHipRatio = useMemo(() => {
    const waist = Number(waistCm);
    const hip = Number(hipCm);
    if (!waist || !hip) return "";
    return (waist / hip).toFixed(2);
  }, [waistCm, hipCm]);

  const handleNextStep = async () => {
    // Validate current step
    let isValid = false;
    if (currentStep === 1) isValid = await trigger("customerInfo");
    else if (currentStep === 2) isValid = await trigger("healthScreening");
    else if (currentStep === 3) isValid = await trigger("lifestyleNutrition");
    else if (currentStep === 4) isValid = await trigger("bodyMetrics");
    else if (currentStep === 5) isValid = await trigger("trainingProfileGoal");
    else if (currentStep === 6) isValid = await trigger("consent");

    if (isValid && currentStep < intakeSteps.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep <= 1) return;
    setCurrentStep((prev) => prev - 1);
  };

  const handleSaveDraft = () => {
    if (!customer?._id) return;
    const values = watch();
    let stepData = {};
    if (currentStep === 1) stepData = { customerInfo: values.customerInfo };
    if (currentStep === 2) stepData = { healthScreening: values.healthScreening };
    if (currentStep === 3) stepData = { lifestyleNutrition: values.lifestyleNutrition };
    if (currentStep === 4) stepData = { bodyMetrics: { ...values.bodyMetrics, bmi: bmi ? Number(bmi) : null, waistHipRatio: waistHipRatio ? Number(waistHipRatio) : null } };
    if (currentStep === 5) stepData = { trainingProfileGoal: values.trainingProfileGoal };
    if (currentStep === 6) stepData = { consent: values.consent };

    saveDraftMutation.mutate(
      { customerId: customer._id, step: currentStep, data: stepData },
      {
        onSuccess: () => alert("Đã lưu nháp"),
        onError: (err) => alert(err?.response?.data?.message || "Lưu nháp thất bại")
      }
    );
  };

  const onSubmit = async (data) => {
    if (!customer?._id) return;
    
    // Normalize data before submit (specifically comma separated arrays)
    const normalizedData = {
      ...data,
      bodyMetrics: {
        ...data.bodyMetrics,
        bmi: bmi ? Number(bmi) : null,
        waistHipRatio: waistHipRatio ? Number(waistHipRatio) : null
      },
      healthScreening: {
        ...data.healthScreening,
        painLocation: typeof data.healthScreening.painLocation === "string" ? data.healthScreening.painLocation.split(",").map(i => i.trim()).filter(Boolean) : []
      },
      trainingProfileGoal: {
        ...data.trainingProfileGoal,
        sportsHistory: typeof data.trainingProfileGoal.sportsHistory === "string" ? data.trainingProfileGoal.sportsHistory.split(",").map(i => i.trim()).filter(Boolean) : []
      },
      postureMediaSummary: {
        frontImageUploaded: !!data.postureMedia.frontImage,
        backImageUploaded: !!data.postureMedia.backImage,
        sideImageUploaded: !!data.postureMedia.sideImage,
      }
    };

    try {
      // 1. Upload files first if they are new File objects
      let intakeId = customer?.lastIntakeId || (latestIntake?._id) || null;
      
      const uploadTasks = [];
      if (isBrowserFile(data.postureMedia.frontImage)) {
        uploadTasks.push(uploadMediaMutation.mutateAsync({ customerId: customer._id, file: data.postureMedia.frontImage, type: "posture_front", intakeId }));
        uploadTasks.push(uploadMediaMutation.mutateAsync({ customerId: customer._id, file: data.postureMedia.frontImage, type: "before_front", intakeId }));
      }
      if (isBrowserFile(data.postureMedia.backImage)) {
        uploadTasks.push(uploadMediaMutation.mutateAsync({ customerId: customer._id, file: data.postureMedia.backImage, type: "posture_back", intakeId }));
      }
      if (isBrowserFile(data.postureMedia.sideImage)) {
        uploadTasks.push(uploadMediaMutation.mutateAsync({ customerId: customer._id, file: data.postureMedia.sideImage, type: "posture_side", intakeId }));
        uploadTasks.push(uploadMediaMutation.mutateAsync({ customerId: customer._id, file: data.postureMedia.sideImage, type: "before_side", intakeId }));
      }
      if (uploadTasks.length > 0) await Promise.all(uploadTasks);

      // 2. Submit the intake form
      delete normalizedData.postureMedia;
      await submitMutation.mutateAsync({ customerId: customer._id, data: normalizedData });
      alert("Hoàn tất intake thành công");
      onSubmitted?.({ customerId: customer._id });
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Submit intake thất bại");
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepCustomerInfo register={register} errors={errors} />;
      case 2:
        return <StepHealthScreening register={register} watch={watch} setValue={setValue} errors={errors} />;
      case 3:
        return <StepLifestyleNutrition register={register} watch={watch} setValue={setValue} errors={errors} />;
      case 4:
        return <StepBodyMetrics register={register} errors={errors} bmi={bmi} waistHipRatio={waistHipRatio} />;
      case 5:
        return <StepTrainingGoal register={register} watch={watch} setValue={setValue} errors={errors} />;
      case 6:
        return <StepPostureMedia watch={watch} setValue={setValue} />;
      default:
        return null;
    }
  };

  return (
    <section className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
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
                Khảo sát NASM • {customer?.code || "--"}
              </p>
              <h2 className="text-2xl font-extrabold text-slate-800 uppercase">
                {customer?.fullName}
              </h2>
              <p className="mt-1 text-slate-500">
                Bước {currentStep}/{intakeSteps.length} •{" "}
                {intakeSteps[currentStep - 1]}
              </p>
            </div>
            <button
              onClick={handleSaveDraft}
              disabled={saveDraftMutation.isPending || loadingLatest}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Save size={18} />
              {saveDraftMutation.isPending ? "Đang lưu..." : "Lưu nháp"}
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
                  className={`flex h-full items-center justify-center rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-md"
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
            <form onSubmit={handleSubmit(onSubmit)}>
              {renderStep()}

              <div className="mt-8 flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={currentStep === 1 || loadingLatest}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronLeft size={18} />
                  Quay lại
                </button>
                {currentStep < intakeSteps.length ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={loadingLatest}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-3 font-bold text-white shadow-md transition hover:shadow-lg"
                  >
                    Tiếp theo
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitMutation.isPending || uploadMediaMutation.isPending || loadingLatest}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-3 font-bold text-white shadow-md transition hover:shadow-lg"
                  >
                    {submitMutation.isPending || uploadMediaMutation.isPending ? "Đang gửi..." : "Hoàn tất khảo sát"}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default F1IntakeWizard;

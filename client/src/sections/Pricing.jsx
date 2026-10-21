import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { X, Sparkles, LogIn, ArrowRight, Wallet, CheckCircle, AlertTriangle, CalendarCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { purchaseTrainerPlan } from "../services/trainerSubscription.service";
import { useTrainerPlanCatalog } from "../hooks/useTrainerPlanCatalog";
import { createTrainerPlanPurchasePayload } from "../utils/trainerPlanCatalog";
import { TodayProgressPrompt } from "../components/TodayProgressPrompt";
import { TODAY_PLATFORM_ENABLED } from "../config/featureFlags";
import { getTodayProgressPromptEligibility } from "../services/todayDashboard.service";
import {
  loadPricingViewMode,
  persistPricingViewMode,
} from "../utils/publicJourney";
import {
  mySubscriptionQueryOptions,
  selectMySubscriptionSnapshot,
  trainerPurchaseQuoteQueryOptions,
} from "../queries/subscription.queries";
import {
  applyTrainerPlanPurchaseResponse,
  walletBalanceQueryOptions,
} from "../queries/walletAccount.queries";
import { splitTrainerPlanBenefits } from "../utils/trainerPlanBenefits";
import FitnessPlusPlans from "../components/Pricing/FitnessPlusPlans";
import CoachingPlans from "../components/Pricing/CoachingPlans";
import TrainerPlans from "../components/Pricing/TrainerPlans";
import PricingSegmentedControl from "../components/Pricing/PricingSegmentedControl";
import PlanUpgradeBreakdown from "../components/Pricing/PlanUpgradeBreakdown";
import { PLAN_STATE_HINT_KEYS, PLAN_STATE_LABEL_KEYS, getPlanCtaState } from "../utils/planStatus";
import { useModalScrollLock } from "../hooks/useModalScrollLock";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { resolvePricingGifts } from "../utils/pricingGifts";
import { buildDefaultPricingContent, resolvePricingContent } from "../utils/pricingContent";
import { useLoginPromo } from "../hooks/useLoginPromo";
import { getUserErrorMessage } from "../utils/errorMessages";

const TODAY_PROGRESS_PROMPT_DISMISSED_KEY =
  "ht_today_progress_prompt_dismissed";

const Pricing = ({ isHeroAnimDone = false }) => {
  const { t } = useTranslation("home");
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // View mode: "customer" | "trainer"
  const [viewMode, setViewMode] = useState(loadPricingViewMode);
  const [progressPromptDismissed, setProgressPromptDismissed] = useState(
    () => {
      try {
        return (
          globalThis.sessionStorage?.getItem(
            TODAY_PROGRESS_PROMPT_DISMISSED_KEY,
          ) === "true"
        );
      } catch {
        return false;
      }
    },
  );

  const dismissProgressPrompt = useCallback(() => {
    try {
      globalThis.sessionStorage?.setItem(
        TODAY_PROGRESS_PROMPT_DISMISSED_KEY,
        "true",
      );
    } catch {
      // Dismiss in memory when browser storage is unavailable.
    }
    setProgressPromptDismissed(true);
  }, []);

  const handleSelectMode = (mode) => {
    setViewMode(mode);
    persistPricingViewMode(mode);
    dismissProgressPrompt();
  };

  const handleOpenTodayDashboard = () => {
    handleSelectMode("customer");
    navigate("/dashboard");
  };

  const isTrainer = viewMode === "trainer";

  // Liên kết từ dashboard (/?plan=fitness-plus#pricing) mở sẵn tab HT Fitness+
  const [mode, setMode] = useState(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("plan") === "fitness-plus"
      ? "fitness-plus"
      : "1-1",
  );
  const [billingCycle, setBillingCycle] = useState("month");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [pendingMode, setPendingMode] = useState(null);

  // Checkout modal states
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [showTrainerLoginPrompt, setShowTrainerLoginPrompt] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null); // { success, message, data }
  const [countdown, setCountdown] = useState(null);
  const {
    data: trainerCatalogData,
    isLoading: trainerCatalogLoading,
    isError: trainerCatalogError,
    refetch: refetchTrainerCatalog,
  } = useTrainerPlanCatalog();
  const [showFreeTrialNotice, setShowFreeTrialNotice] = useState(false);
  const purchaseRequestIdRef = useRef(null);


  const userId = user?._id;
  const progressPromptEligibilityQuery = useQuery({
    queryKey: ["today-dashboard", "prompt-eligibility", userId],
    queryFn: () =>
      getTodayProgressPromptEligibility().then(
        (response) => response.data.data,
      ),
    enabled: Boolean(
      TODAY_PLATFORM_ENABLED &&
      userId &&
      isHeroAnimDone &&
      viewMode === "customer" &&
      !progressPromptDismissed,
    ),
    staleTime: 60_000,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });
  const showProgressPrompt =
    isHeroAnimDone &&
    viewMode === "customer" &&
    !progressPromptDismissed &&
    progressPromptEligibilityQuery.data?.eligible === true;
  const walletQuery = useQuery(
    walletBalanceQueryOptions({ userId }),
  );
  const {
    data: subscriptionSnapshot,
    isPending: subscriptionPending,
    isError: subscriptionError,
    refetch: refetchSubscription,
  } = useQuery(
    mySubscriptionQueryOptions({
      userId,
      select: selectMySubscriptionSnapshot,
    }),
  );
  const purchaseMutation = useMutation({
    mutationFn: purchaseTrainerPlan,
    onSuccess: (response) =>
      userId
        ? applyTrainerPlanPurchaseResponse({
            queryClient,
            userId,
            response,
          })
        : undefined,
  });
  // Báo giá do server tính: đã trừ phần gói tháng chưa dùng khi nâng cấp lên gói năm.
  const trainerQuoteQuery = useQuery(
    trainerPurchaseQuoteQueryOptions({
      userId,
      planCode: checkoutPlan?.code,
      billingCycle,
      enabled: Boolean(checkoutPlan && !checkoutPlan.isFree),
    }),
  );
  const walletBalance = walletQuery.data?.balance ?? null;
  const walletLoading = Boolean(user && walletQuery.isFetching);
  const walletError = walletQuery.isError;
  const checkoutLoading = purchaseMutation.isPending;
  const activeSubscription = subscriptionSnapshot?.subscription ?? null;
  const freeTrialStatus = !user || subscriptionPending
    ? "unknown"
    : subscriptionError
      ? "error"
      : subscriptionSnapshot?.freeTrial?.status || "unknown";
  useModalScrollLock(Boolean(checkoutPlan));

  // Đếm ngược và reload sau thanh toán thành công
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        window.location.reload();
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const { data: siteSettingsResponse } = useSiteSettings();
  const giftOverrides = siteSettingsResponse?.data?.pricingGifts;
  const giftsFor = (key, defaults = []) => resolvePricingGifts(giftOverrides, key, defaults);
  const contentOverrides = siteSettingsResponse?.data?.pricingContent;
  const defaultContent = buildDefaultPricingContent(t);
  const loginPromo = useLoginPromo();

  // Gói ONLINE
  const onlinePlans = [
    {
      title: t("pricing.names.basic"),
      durationText: t("pricing.weeks", { count: 8 }),
      features: [
        t("pricing.features.online"),
        t("pricing.features.personalized_plan"),
        t("pricing.features.diet_consultation"),
        t("pricing.features.weekly_progress"),
        t("pricing.features.notion_tracking"),
        t("pricing.features.stretching_recovery"),
        t("pricing.features.commitment"),
      ],
      systemFeatures: [
        t("pricing.system_features.exercise_library"),
        t("pricing.system_features.ai_mealplan"),
        t("pricing.system_features.online_booking"),
        t("pricing.system_features.personal_schedule"),
        t("pricing.system_features.checkin_history"),
      ],
      gifts: giftsFor("online-basic"),
      totalSessions: 24,
    },
    {
      title: t("pricing.names.advanced"),
      durationText: t("pricing.weeks", { count: 16 }),
      features: [
        t("pricing.features.online"),
        t("pricing.features.personalized_plan"),
        t("pricing.features.diet_consultation"),
        t("pricing.features.weekly_progress"),
        t("pricing.features.notion_tracking"),
        t("pricing.features.stretching_recovery"),
        t("pricing.features.commitment"),
      ],
      systemFeatures: [
        t("pricing.system_features.exercise_library"),
        t("pricing.system_features.ai_mealplan"),
        t("pricing.system_features.online_booking"),
        t("pricing.system_features.personal_schedule"),
        t("pricing.system_features.checkin_history"),
      ],
      gifts: giftsFor("online-advanced"),
      featured: true,
      totalSessions: 48,
    },
    {
      title: t("pricing.names.vip"),
      durationText: t("pricing.weeks", { count: 24 }),
      features: [
        t("pricing.features.online"),
        t("pricing.features.personalized_plan"),
        t("pricing.features.diet_consultation"),
        t("pricing.features.weekly_progress"),
        t("pricing.features.notion_tracking"),
        t("pricing.features.stretching_recovery"),
        t("pricing.features.commitment"),
      ],
      systemFeatures: [
        t("pricing.system_features.exercise_library"),
        t("pricing.system_features.ai_mealplan"),
        t("pricing.system_features.online_booking"),
        t("pricing.system_features.personal_schedule"),
        t("pricing.system_features.checkin_history"),
      ],
      gifts: giftsFor("online-vip"),
      totalSessions: 72,
    },
  ];

  // Gói 1-1
  const oneOnOnePlans = [
    {
      title: t("pricing.names.basic"),
      durationText: t("pricing.weeks", { count: 8 }),
      features: [
        t("pricing.features.one_on_one"),
        t("pricing.features.personalized_plan"),
        t("pricing.features.diet_consultation"),
        t("pricing.features.weekly_progress"),
        t("pricing.features.notion_tracking"),
        t("pricing.features.stretching_recovery"),
        t("pricing.features.commitment"),
      ],
      systemFeatures: [
        t("pricing.system_features.exercise_library"),
        t("pricing.system_features.ai_mealplan"),
        t("pricing.system_features.online_booking"),
        t("pricing.system_features.personal_schedule"),
        t("pricing.system_features.checkin_history"),
      ],
      gifts: giftsFor("1-1-basic", [t("pricing.gifts.shaker")]),
      weeks: 8,
      totalSessions: 24,
    },
    {
      title: t("pricing.names.advanced"),
      durationText: t("pricing.weeks", { count: 16 }),
      features: [
        t("pricing.features.one_on_one"),
        t("pricing.features.personalized_plan"),
        t("pricing.features.diet_consultation"),
        t("pricing.features.weekly_progress"),
        t("pricing.features.notion_tracking"),
        t("pricing.features.stretching_recovery"),
        t("pricing.features.commitment"),
      ],
      systemFeatures: [
        t("pricing.system_features.exercise_library"),
        t("pricing.system_features.ai_mealplan"),
        t("pricing.system_features.online_booking"),
        t("pricing.system_features.personal_schedule"),
        t("pricing.system_features.checkin_history"),
      ],
      gifts: giftsFor("1-1-advanced", [t("pricing.gifts.shaker"), t("pricing.gifts.biscotti")]),
      featured: true,
      weeks: 16,
      totalSessions: 48,
    },
    {
      title: t("pricing.names.vip"),
      durationText: t("pricing.weeks", { count: 24 }),
      features: [
        t("pricing.features.one_on_one"),
        t("pricing.features.personalized_plan"),
        t("pricing.features.diet_consultation"),
        t("pricing.features.weekly_progress"),
        t("pricing.features.notion_tracking"),
        t("pricing.features.stretching_recovery"),
        t("pricing.features.commitment"),
      ],
      systemFeatures: [
        t("pricing.system_features.exercise_library"),
        t("pricing.system_features.ai_mealplan"),
        t("pricing.system_features.online_booking"),
        t("pricing.system_features.personal_schedule"),
        t("pricing.system_features.checkin_history"),
      ],
      gifts: giftsFor("1-1-vip", [
        t("pricing.gifts.backpack"),
        t("pricing.gifts.shaker"),
        t("pricing.gifts.biscotti"),
      ]),
      weeks: 24,
      totalSessions: 72,
    },
  ];

  const trialPlan = {
    title: t("pricing.names.trial"),
    durationText: t("pricing.weeks", { count: 4 }),
    features: [
      t("pricing.features.one_on_one"),
      t("pricing.features.personalized_plan"),
      t("pricing.features.diet_consultation"),
      t("pricing.features.weekly_progress"),
      t("pricing.features.notion_tracking"),
      t("pricing.features.stretching_recovery"),
      t("pricing.features.commitment"),
    ],
    systemFeatures: [
      t("pricing.system_features.exercise_library"),
      t("pricing.system_features.ai_mealplan"),
      t("pricing.system_features.online_booking"),
      t("pricing.system_features.personal_schedule"),
      t("pricing.system_features.checkin_history"),
    ],
    gifts: giftsFor("trial"),
    totalSessions: 12,
  };

  // ===== GÓI DỊCH VỤ DÀNH CHO TRAINER =====
  const trainerPlanCardMeta = {
    free: {
      titleKey: "free",
      subtitleKey: "free_sub",
      icon: "🎁",
      isFree: true,
    },
    standard: { titleKey: "basic", subtitleKey: "basic_sub", icon: "🔥" },
    professional: {
      titleKey: "advanced",
      subtitleKey: "advanced_sub",
      icon: "💎",
      featured: true,
    },
    premium: { titleKey: "vip", subtitleKey: "vip_sub", icon: "👑" },
  };
  const trainerPlans = (trainerCatalogData?.plans || []).map((plan) => {
    const card = trainerPlanCardMeta[plan.code];
    const isFree = card.isFree === true;
    return {
      ...plan,
      ...card,
      title: t(`pricing.trainer_plans.${card.titleKey}`),
      subtitle: t(`pricing.trainer_plans.${card.subtitleKey}`, {
        count: plan.durationDays,
      }),
      priceMonth: isFree ? plan.prices.trial : plan.prices.month,
      priceYear: isFree ? plan.prices.trial : plan.prices.year,
    };
  });
  const trainerBenefits = splitTrainerPlanBenefits({
    plans: trainerPlans,
    benefits: trainerCatalogData?.benefits,
    t,
  });

  const plans = mode === "online" ? onlinePlans : oneOnOnePlans;

  const handleRegister = (plan, planMode) => {
    if (!user && !loginPromo.enabled) {
      navigate("/register", {
        state: {
          selectedPackage: {
            title: plan.title,
            durationText: plan.durationText,
            totalSessions: plan.totalSessions,
          },
          planMode,
          gifts: plan.gifts || [],
        },
      });
      return;
    }
    if (!user) {
      setPendingPlan(plan);
      setPendingMode(planMode);
      setShowLoginPrompt(true);
      return;
    }
    navigate("/register", {
      state: {
        selectedPackage: {
          title: plan.title,
          durationText: plan.durationText,
          totalSessions: plan.totalSessions,
        },
        planMode,
        gifts: plan.gifts || [],
      },
    });
  };

  const handleContinueWithoutLogin = () => {
    setShowLoginPrompt(false);
    navigate("/register", {
      state: {
        selectedPackage: {
          title: pendingPlan.title,
          durationText: pendingPlan.durationText,
          totalSessions: pendingPlan.totalSessions,
        },
        planMode: pendingMode,
        gifts: pendingPlan.gifts || [],
      },
    });
  };

  const handleLoginRedirect = () => {
    setShowLoginPrompt(false);
    navigate("/login", { state: { from: "/#pricing" } });
  };

  return (
    <section id="pricing" className="py-16 bg-[#262626]">
      {TODAY_PLATFORM_ENABLED && showProgressPrompt && (
        <TodayProgressPrompt
          onDismiss={dismissProgressPrompt}
          onOpen={handleOpenTodayDashboard}
        />
      )}
      <div className="container-custom mx-auto px-4">
        <div
          aria-label={t("pricing.audience_label")}
          className="mx-auto mb-5 flex w-full max-w-sm rounded-xl border border-gray-700 bg-[#1a1a1a] p-1"
          role="group"
        >
          {["customer", "trainer"].map((audience) => {
            const isActive = viewMode === audience;
            return (
              <button
                aria-pressed={isActive}
                className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
                key={audience}
                onClick={() => handleSelectMode(audience)}
                type="button"
              >
                {t(`pricing.audience_${audience}`)}
              </button>
            );
          })}
        </div>
        <h2 className="text-center text-primary uppercase">
          {isTrainer ? t("pricing.title_trainer") : t("pricing.title_customer")}
        </h2>


        {!isTrainer && (
          <div className="mt-8 mb-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <PricingSegmentedControl
              ariaLabel={t("pricing.title_customer")}
              className="w-full max-w-md"
              onChange={setMode}
              options={[
                { value: "1-1", label: "1-1" },
                { value: "online", label: "ONLINE" },
                { value: "trial", label: t("pricing.trial") },
              ]}
              value={mode}
            />
            <button
              aria-pressed={mode === "fitness-plus"}
              onClick={() => setMode("fitness-plus")}
              className={`group relative isolate h-12 w-full overflow-hidden rounded-full bg-[#222] px-6 text-base font-semibold shadow-lg transition-[color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 motion-reduce:transition-none sm:w-auto ${
                mode === "fitness-plus" ? "text-white" : "text-gray-400 hover:text-white"
              }`}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`absolute inset-1 z-0 rounded-full bg-primary shadow-md shadow-black/20 transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                  mode === "fitness-plus" ? "opacity-100" : "opacity-0"
                }`}
              />
              <span className="relative z-10">
                {t("pricing.fitness_plus.title_short")}
              </span>
            </button>
          </div>
        )}

        {isTrainer && (
          <div className="mt-8 mb-10 flex items-center justify-center">
            <PricingSegmentedControl
              ariaLabel={`${t("pricing.month")} / ${t("pricing.year")}`}
              className="w-full max-w-64"
              onChange={setBillingCycle}
              options={[
                { value: "month", label: t("pricing.month") },
                { value: "year", label: t("pricing.year") },
              ]}
              value={billingCycle}
            />
          </div>
        )}

        {isTrainer && trainerCatalogLoading && (
          <div className="mx-auto mb-6 max-w-xl rounded-xl border border-gray-700 bg-[#1a1a1a] p-6 text-center text-gray-300">
            {t("pricing.trainer_plans.checking_trial")}
          </div>
        )}
        {isTrainer && trainerCatalogError && (
          <div className="mx-auto mb-6 max-w-xl rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center">
            <p className="text-red-300">
              {t("pricing.trainer_plans.retry_trial_check")}
            </p>
            <button
              type="button"
              onClick={() => refetchTrainerCatalog()}
              className="mt-4 min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            >
              {t("pricing.trainer_plans.retry_trial_check")}
            </button>
          </div>
        )}

        <div
          className="pricing-panel-enter"
          key={isTrainer ? "trainer" : `customer-${mode}`}
        >
          {!isTrainer && mode === "fitness-plus" ? (
            <FitnessPlusPlans
              billingCycle={billingCycle}
              onBillingCycleChange={setBillingCycle}
            />
          ) : !isTrainer ? (
            <CoachingPlans
              plans={mode === "trial" ? [trialPlan] : plans}
              sharedFeatures={resolvePricingContent(contentOverrides, `${mode}-customer`, defaultContent[`${mode}-customer`])}
              systemFeatures={resolvePricingContent(contentOverrides, `${mode}-system`, defaultContent[`${mode}-system`])}
              onRegister={(plan) => handleRegister(plan, mode)}
            />
          ) : (
            <TrainerPlans
              plans={trainerPlans}
              shared={trainerBenefits.shared}
              perPlan={trainerBenefits.perPlan}
              billingCycle={billingCycle}
              showTrial={!user || !["used", "ineligible", "unknown"].includes(freeTrialStatus)}
              renderAction={(plan) => {
                const cta = plan.isFree
                  ? null
                  : getPlanCtaState({
                      family: "trainer",
                      current: activeSubscription
                        ? { planCode: activeSubscription.planCode, billingCycle: activeSubscription.billingCycle }
                        : null,
                      planCode: plan.code,
                      billingCycle,
                    });
                return (
                  <>
                    <button
                      disabled={
                        (plan.isFree && Boolean(user) && freeTrialStatus === "unknown") ||
                        Boolean(user && cta?.disabled)
                      }
                      onClick={() => {
                        if (!user) {
                          setShowTrainerLoginPrompt(true);
                          return;
                        }
                        if (plan.isFree && freeTrialStatus === "error") {
                          void refetchSubscription();
                          return;
                        }
                        if (
                          plan.isFree &&
                          ["used", "ineligible"].includes(freeTrialStatus)
                        ) {
                          setShowFreeTrialNotice(true);
                          return;
                        }
                        purchaseRequestIdRef.current =
                          globalThis.crypto.randomUUID();
                        setCheckoutPlan(plan);
                        setCheckoutResult(null);
                        if (!plan.isFree) {
                          void walletQuery.refetch();
                        }
                      }}
                      className="w-full rounded-lg bg-primary py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-all duration-300 hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {plan.isFree && user && freeTrialStatus === "unknown"
                        ? t("pricing.trainer_plans.checking_trial")
                        : plan.isFree && user && freeTrialStatus === "error"
                          ? t("pricing.trainer_plans.retry_trial_check")
                          : plan.isFree && freeTrialStatus === "ineligible"
                            ? t("pricing.trainer_plans.ineligible_cta")
                            : plan.isFree && freeTrialStatus === "used"
                              ? t("pricing.trainer_plans.upgrade_cta")
                              : plan.isFree
                                ? t("pricing.trainer_plans.start_free")
                                : user && cta && cta.kind !== "buy"
                                  ? t(PLAN_STATE_LABEL_KEYS[cta.kind])
                                  : t("pricing.buy")}
                    </button>
                    {user && cta?.kind === "blocked" && (
                      <p className="mt-2 text-center text-xs leading-5 text-gray-400">
                        {t(PLAN_STATE_HINT_KEYS[cta.reason])}
                      </p>
                    )}
                  </>
                );
              }}
            />
          )}
        </div>

        {showLoginPrompt && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowLoginPrompt(false)}
          >
            <div
              className="bg-[#1a1a1a] border-2 border-primary rounded-2xl max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b border-primary/30">
                <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                  <Sparkles className="w-6 h-6" /> {t("pricing.login_promo_title")}
                </h3>
                <button aria-label={t("common:a11y.close")}
                  onClick={() => setShowLoginPrompt(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-300 text-center text-lg">
                  {t("pricing.login_promo_text")}{" "}
                  <strong className="text-primary">{t("pricing.login_promo_discount", { percent: loginPromo.percent })}</strong> {t("pricing.login_promo_suffix")}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <button
                    onClick={handleLoginRedirect}
                    className="flex-1 py-3 bg-gradient-to-r from-primary to-primary-dark text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:scale-105 transition"
                  >
                    <LogIn size={18} /> {t("pricing.login_now")}
                  </button>
                  <button
                    onClick={handleContinueWithoutLogin}
                    className="flex-1 py-3 bg-gray-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-gray-600 transition"
                  >
                    {t("pricing.continue_register")} <ArrowRight size={18} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  {t("pricing.login_promo_note")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== MODAL ĐĂNG NHẬP CHO HLV ===== */}
        {showTrainerLoginPrompt && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowTrainerLoginPrompt(false)}
          >
            <div
              className="bg-[#1a1a1a] border-2 border-primary rounded-2xl max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end p-3 pb-0">
                <button aria-label={t("common:a11y.close")}
                  onClick={() => setShowTrainerLoginPrompt(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 pb-6 space-y-4 text-center">
                <div>
                  <h3 className="text-base font-bold text-white mb-1">ĐĂNG NHẬP ĐỂ TIẾP TỤC</h3>
                  <p className="text-gray-400 text-sm">Vui lòng đăng nhập để mua gói dịch vụ</p>
                </div>
                <button
                  onClick={() => {
                    setShowTrainerLoginPrompt(false);
                    navigate("/login", { state: { from: "/#pricing" } });
                  }}
                  className="w-full py-3 bg-gradient-to-r from-primary to-primary-dark text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:scale-105 transition"
                >
                  <LogIn size={18} /> Đăng nhập ngay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== MODAL TRẠNG THÁI GÓI FREE ===== */}
        {showFreeTrialNotice && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowFreeTrialNotice(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="free-trial-notice-title"
              className="w-full max-w-sm rounded-2xl border border-slate-600 bg-[#1a1a1a] p-6 text-center shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
                <AlertTriangle className="h-7 w-7 text-amber-400" aria-hidden="true" />
              </div>
              <h3 id="free-trial-notice-title" className="text-lg font-bold text-white">
                {t(
                  freeTrialStatus === "ineligible"
                    ? "pricing.trainer_plans.order_exists_title"
                    : "pricing.trainer_plans.trial_ended_title",
                )}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                {t(
                  freeTrialStatus === "ineligible"
                    ? "pricing.trainer_plans.order_exists_message"
                    : "pricing.trainer_plans.trial_ended_message",
                )}
              </p>
              <button
                type="button"
                onClick={() => setShowFreeTrialNotice(false)}
                className="mt-5 w-full rounded-lg bg-primary px-4 py-3 font-bold text-white transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                {t("pricing.trainer_plans.choose_paid_plan")}
              </button>
            </div>
          </div>
        )}

        {/* ===== DRAWER CHECKOUT GÓI HLV (trượt từ phải) ===== */}
        {checkoutPlan && (() => {
          const isFreeCheckout = checkoutPlan.isFree;
          const selectedBillingCycle = isFreeCheckout ? "trial" : billingCycle;
          const listPrice = isFreeCheckout
            ? 0
            : billingCycle === "year" ? checkoutPlan.priceYear : checkoutPlan.priceMonth;
          const quote = trainerQuoteQuery.data;
          const quoteBlocked = !isFreeCheckout && quote?.eligible === false;
          const quoteReady =
            isFreeCheckout || (quote?.eligible === true && Number.isSafeInteger(quote.amount));
          // Số tiền thanh toán lấy từ báo giá của server (đã trừ phần gói tháng chưa dùng khi nâng cấp).
          const price = isFreeCheckout ? 0 : quoteReady ? quote.amount : listPrice;
          const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
          const isWalletVerified =
            isFreeCheckout ||
            (!walletError && !walletLoading && walletBalance !== null);
          const isEnough =
            isFreeCheckout || (isWalletVerified && walletBalance >= price);
          const shortage = walletBalance !== null ? price - walletBalance : 0;

          const handlePurchase = async () => {
            try {
              if (!purchaseRequestIdRef.current) {
                purchaseRequestIdRef.current =
                  globalThis.crypto.randomUUID();
              }
              const payload = createTrainerPlanPurchasePayload({
                catalog: trainerCatalogData,
                planCode: checkoutPlan.code,
                billingCycle: selectedBillingCycle,
                requestId: purchaseRequestIdRef.current,
                quotedAmount: isFreeCheckout ? undefined : quote?.amount,
              });
              const res = await purchaseMutation.mutateAsync(payload);
              setCheckoutResult({
                success: true,
                message: res.data.message,
                data: res.data.data,
              });
              toast.success(res.data.message || "Đã kích hoạt gói HLV");
              setCountdown(5);
            } catch (err) {
              if (err.response?.data?.code === "CATALOG_CHANGED") {
                purchaseRequestIdRef.current = null;
                await Promise.all([refetchTrainerCatalog(), trainerQuoteQuery.refetch()]);
              }
              setCheckoutResult({
                success: false,
                message: err.response?.data?.message || "Có lỗi xảy ra",
                code: err.response?.data?.code,
              });
              toast.error(
                getUserErrorMessage(err, "Không thể kích hoạt gói HLV"),
              );
            }
          };

          const handleClose = () => {
            if (!checkoutLoading) {
              setCheckoutPlan(null);
              setCheckoutResult(null);
              purchaseRequestIdRef.current = null;
            }
          };

          return (
            <div
              className="fixed inset-0 z-50"
              onClick={handleClose}
            >
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

              {/* Drawer */}
              <div
                className="pricing-checkout-drawer absolute top-0 right-0 h-full w-full max-w-md overflow-y-auto overscroll-contain border-l border-gray-700 bg-[#1a1a1a] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Nút đóng */}
                <button aria-label={t("common:a11y.close")}
                  onClick={handleClose}
                  className="absolute top-4 left-4 w-9 h-9 flex items-center justify-center rounded-full bg-[#222] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Header gói */}
                <div className="pt-16 px-6 pb-5 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{checkoutPlan.icon}</span>
                    <div>
                      <h3 className="text-xl font-bold text-white">{checkoutPlan.title}</h3>
                      <p className="text-gray-400 text-sm">{checkoutPlan.subtitle}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-3xl font-bold text-white">{formattedPrice}</span>
                    <span className="text-gray-400 mb-1">/{isFreeCheckout ? t("pricing.trainer_plans.days", { count: checkoutPlan.durationDays }) : billingCycle === "year" ? t("pricing.year") : t("pricing.month")}</span>
                  </div>
                </div>

                {/* Kết quả thanh toán */}
                {checkoutResult ? (
                  <div className="px-6 py-10 space-y-5">
                    <div className="flex flex-col items-center text-center space-y-4">
                      {checkoutResult.success ? (
                        <>
                          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-green-400" />
                          </div>
                          <h4 className="text-xl font-bold text-green-400">Kích hoạt thành công!</h4>
                          <p className="text-gray-400 text-sm">{checkoutResult.message}</p>
                          {checkoutResult.data?.newBalance !== null && checkoutResult.data?.newBalance !== undefined && (
                            <div className="bg-[#222] rounded-xl p-4 w-full text-sm">
                              <div className="flex justify-between text-gray-400">
                                <span>Số dư còn lại</span>
                                <span className="text-white font-semibold">
                                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(checkoutResult.data.newBalance)}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-10 h-10 text-red-400" />
                          </div>
                          <h4 className="text-xl font-bold text-red-400">Thanh toán thất bại</h4>
                          <p className="text-gray-400 text-sm">{checkoutResult.message}</p>
                        </>
                      )}
                    </div>
                    {checkoutResult.success ? (
                      <div className="text-center space-y-2">
                        <p className="text-gray-400 text-sm">
                          Đang kích hoạt tài khoản... Tự động chuyển sau <span className="text-primary font-bold text-lg">{countdown || 0}s</span>
                        </p>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-primary to-orange-500 h-full rounded-full transition-all duration-1000 ease-linear"
                            style={{ width: `${((5 - (countdown || 0)) / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className={`grid gap-3 ${checkoutResult.code === "CATALOG_CHANGED" ? "grid-cols-1" : "grid-cols-2"}`}>
                        <button
                          onClick={handleClose}
                          className="py-3 bg-gray-700 text-white font-semibold rounded-xl hover:bg-gray-600 transition"
                        >
                          Đóng
                        </button>
                        {checkoutResult.code !== "CATALOG_CHANGED" && (
                        <button
                          onClick={handlePurchase}
                          disabled={checkoutLoading}
                          className="py-3 bg-primary text-white font-semibold rounded-xl hover:bg-orange-500 transition disabled:opacity-50"
                        >
                          {checkoutLoading ? "Đang thử lại..." : "Thử lại"}
                        </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-6 py-6 space-y-6">
                    {/* Phương thức thanh toán */}
                    {!isFreeCheckout && (
                    <div>
                      <p className="text-sm text-gray-400 mb-3 font-medium">Phương thức thanh toán</p>
                      <div className="bg-[#222] border-2 border-primary/50 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                              <Wallet className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">Ví cá nhân</p>
                              {walletLoading ? (
                                <p role="status" className="text-gray-500 text-xs">
                                  Đang xác minh số dư...
                                </p>
                              ) : walletError || walletBalance === null ? (
                                <div role="alert" className="text-xs text-red-400">
                                  <p>Số dư: —</p>
                                  <button
                                    type="button"
                                    onClick={() => walletQuery.refetch()}
                                    disabled={walletQuery.isFetching}
                                    className="mt-1 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-wait disabled:opacity-50"
                                  >
                                    {walletQuery.isFetching
                                      ? "Đang tải lại..."
                                      : "Không tải được · Thử lại"}
                                  </button>
                                </div>
                              ) : (
                                <p
                                  className={
                                    isEnough
                                      ? "text-xs font-medium text-green-400"
                                      : "text-xs font-medium text-red-400"
                                  }
                                >
                                  Số dư: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(walletBalance)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Chi tiết thanh toán */}
                    <PlanUpgradeBreakdown
                      quote={isFreeCheckout ? null : quote}
                      loading={!isFreeCheckout && trainerQuoteQuery.isPending}
                      error={!isFreeCheckout && trainerQuoteQuery.isError}
                      onRetry={() => trainerQuoteQuery.refetch()}
                      fallbackAmount={price}
                    />
                    {quoteBlocked && (
                      <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400" role="alert">
                        {quote.message}
                      </p>
                    )}

                    {/* Thiếu tiền warning */}
                    {!isFreeCheckout && !walletLoading && !isEnough && isWalletVerified && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center space-y-2">
                        <p className="text-red-400 text-sm font-medium">
                          ⚠️ Số dư không đủ (thiếu {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(shortage)})
                        </p>
                        <button
                          onClick={() => {
                            purchaseRequestIdRef.current = null;
                            setCheckoutPlan(null);
                            navigate('/wallet');
                          }}
                          className="text-primary text-sm font-semibold hover:underline flex items-center justify-center gap-1 mx-auto"
                        >
                          Nạp tiền vào ví <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Nút thanh toán */}
                    <button
                      onClick={handlePurchase}
                      disabled={checkoutLoading || walletLoading || !isEnough || !quoteReady}
                      className="w-full py-4 bg-gradient-to-r from-primary to-orange-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      {checkoutLoading
                        ? "Đang xử lý..."
                        : isFreeCheckout
                          ? "KÍCH HOẠT MIỄN PHÍ"
                          : "THANH TOÁN"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </section>
  );
};

export default Pricing;

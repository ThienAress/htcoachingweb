import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowRight, CheckCircle, Wallet, X } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { purchaseFitnessPlusPlan } from "../../services/fitnessPlus.service";
import { walletBalanceQueryOptions } from "../../queries/walletAccount.queries";
import { applyFitnessPlusPurchaseResponse, fitnessPlusCatalogQueryOptions, myFitnessPlusSubscriptionQueryOptions } from "../../queries/fitnessPlus.queries";
import { createFitnessPlusPurchasePayload } from "../../utils/fitnessPlusCatalog";

const formatPrice = (value, language) =>
  new Intl.NumberFormat(String(language || "vi").startsWith("vi") ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

export default function FitnessPlusPlans({ billingCycle, onBillingCycleChange }) {
  const { t, i18n } = useTranslation("home");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const requestIdRef = useRef(null);
  const closeButtonRef = useRef(null);
  const userId = user?._id;
  const isEnglish =
    i18n.resolvedLanguage?.startsWith("en") || i18n.language?.startsWith("en");

  const catalogQuery = useQuery(fitnessPlusCatalogQueryOptions());
  const walletQuery = useQuery(walletBalanceQueryOptions({ userId, enabled: Boolean(checkoutPlan) }));
  const subscriptionQuery = useQuery(myFitnessPlusSubscriptionQueryOptions({ userId }));
  const purchaseMutation = useMutation({
    mutationFn: purchaseFitnessPlusPlan,
    onSuccess: (response) => applyFitnessPlusPurchaseResponse({ queryClient, userId, response }),
  });

  useEffect(() => {
    if (!checkoutPlan) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !purchaseMutation.isPending) {
        setCheckoutPlan(null);
        setCheckoutResult(null);
        requestIdRef.current = null;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [checkoutPlan, purchaseMutation.isPending]);

  const closeCheckout = () => {
    if (purchaseMutation.isPending) return;
    setCheckoutPlan(null);
    setCheckoutResult(null);
    requestIdRef.current = null;
  };

  const submitPurchase = async () => {
    if (!checkoutPlan || !catalogQuery.data || !userId) return;
    try {
      requestIdRef.current ||= globalThis.crypto.randomUUID();
      const payload = createFitnessPlusPurchasePayload({
        catalog: catalogQuery.data,
        planCode: checkoutPlan.code,
        billingCycle,
        requestId: requestIdRef.current,
      });
      const response = await purchaseMutation.mutateAsync(payload);
      setCheckoutResult({ success: true, message: response.data.message });
    } catch (error) {
      setCheckoutResult({
        success: false,
        code: error.response?.data?.code,
        message:
          error.response?.data?.message ||
          t("pricing.fitness_plus.checkout_failed"),
      });
    }
  };

  if (catalogQuery.isPending) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-gray-700 bg-[#1a1a1a] p-8 text-center text-gray-300" role="status">
        {t("pricing.fitness_plus.loading")}
      </div>
    );
  }

  if (catalogQuery.isError) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-red-500/40 bg-red-500/10 p-8 text-center" role="alert">
        <p className="text-red-300">{t("pricing.fitness_plus.load_failed")}</p>
        <button
          type="button"
          onClick={() => catalogQuery.refetch()}
          className="mt-4 min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          {t("pricing.fitness_plus.retry")}
        </button>
      </div>
    );
  }

  const activePlanCode = subscriptionQuery.data?.planCode;
  const plans = catalogQuery.data?.plans || [];
  const checkoutAmount = checkoutPlan?.prices?.[billingCycle] || 0;
  const walletBalance = walletQuery.data?.balance;
  const walletReady = Number.isSafeInteger(walletBalance);
  const walletInsufficient =
    walletReady && walletBalance < checkoutAmount;

  return (
    <>
      <div className="mx-auto mb-10 flex w-fit items-center gap-2 rounded-full bg-[#222] p-1 shadow-lg">
        {["month", "year"].map((cycle) => (
          <button
            type="button"
            key={cycle}
            onClick={() => onBillingCycleChange(cycle)}
            className={`min-h-11 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${billingCycle === cycle ? "bg-gradient-to-r from-primary to-primary-dark text-white" : "text-gray-400 hover:text-white"}`}
          >
            {t(`pricing.${cycle}`)}
          </button>
        ))}
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-[0.95fr_1.1fr_0.95fr] md:items-start">
        {plans.map((plan) => {
          const isActive = activePlanCode === plan.code;
          const price = plan.prices[billingCycle];
          const planTitle = isEnglish ? plan.titleEn : plan.title;
          const planSubtitle = isEnglish ? plan.subtitleEn : plan.subtitle;
          return (
            <article
              key={plan.code}
              className={`relative flex w-full flex-col rounded-xl border-2 bg-[#1a1a1a] p-7 ${plan.featured ? "border-primary bg-[#222] md:-translate-y-3 md:py-9" : "border-gray-800"}`}
            >
              {plan.featured && (
                <div className="absolute -right-3 -top-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow-md">
                  {t("pricing.popular")}
                </div>
              )}
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white">
                  {planTitle}
                </h3>
                <p className="mt-2 min-h-10 text-sm text-gray-400">
                  {planSubtitle}
                </p>
                <div className="mt-5 flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold text-white">{formatPrice(price, i18n.language)}</span>
                  <span className="text-sm text-gray-400">/{t(`pricing.${billingCycle}`)}</span>
                </div>
              </div>

              <div className="mt-6 flex-1 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  {t("pricing.fitness_plus.quota_title")}
                </p>
                <p className="text-sm text-gray-300">
                  ✓ {t("pricing.fitness_plus.ai_chat_quota", { count: plan.quotas.aiChat.limit })}
                </p>
                <p className="text-sm text-gray-300">
                  ✓ {t("pricing.fitness_plus.meal_scan_quota", { count: plan.quotas.mealScan.limit })}
                </p>
                {plan.features.map((feature) => (
                  <p className="text-sm text-gray-300" key={feature}>
                    ✓ {t(`pricing.fitness_plus.features.${feature}`)}
                  </p>
                  ))}
              </div>

              <button
                type="button"
                disabled={isActive}
                onClick={() => {
                  if (!user) {
                    navigate("/login", { state: { from: "/pricing" } });
                    return;
                  }
                  setCheckoutPlan(plan);
                  setCheckoutResult(null);
                  void walletQuery.refetch();
                }}
                className="mt-7 w-full rounded-lg bg-primary py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isActive ? t("pricing.fitness_plus.current") : t("pricing.buy")}
              </button>
            </article>
          );
        })}
      </div>

      {checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="fitness-plus-checkout-title">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-gray-700 bg-[#1a1a1a] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="fitness-plus-checkout-title" className="text-xl font-bold text-white">
                  {t("pricing.fitness_plus.checkout_title")}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  {isEnglish ? checkoutPlan.titleEn : checkoutPlan.title} · {formatPrice(checkoutPlan.prices[billingCycle], i18n.language)}/{t(`pricing.${billingCycle}`)}
                </p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={closeCheckout} className="flex size-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" aria-label={t("pricing.fitness_plus.close")}>
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {checkoutResult ? (
              <div className="mt-8 text-center">
                {checkoutResult.success ? (
                  <CheckCircle className="mx-auto size-14 text-green-400" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="mx-auto size-14 text-red-400" aria-hidden="true" />
                )}
                <p className={`mt-4 text-sm ${checkoutResult.success ? "text-green-300" : "text-red-300"}`} role={checkoutResult.success ? "status" : "alert"}>
                  {checkoutResult.success ? t("pricing.fitness_plus.checkout_success") : checkoutResult.message}
                </p>
                <button type="button" onClick={closeCheckout} className="mt-6 w-full rounded-lg bg-primary py-3 font-bold text-white transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
                  {t("pricing.fitness_plus.close")}
                </button>
              </div>
            ) : (
              <div className="mt-7 space-y-5">
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                  <div className="flex items-center gap-3">
                    <Wallet className="size-5 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-white">{t("pricing.fitness_plus.wallet")}</p>
                      <p className="text-xs text-gray-400">
                        {walletQuery.isPending || walletQuery.isFetching
                          ? t("pricing.fitness_plus.wallet_loading")
                          : walletQuery.isError
                            ? t("pricing.fitness_plus.wallet_error")
                            : formatPrice(walletQuery.data?.balance || 0, i18n.language)}
                      </p>
                      {walletQuery.isError && (
                        <button
                          type="button"
                          onClick={() => walletQuery.refetch()}
                          disabled={walletQuery.isFetching}
                          className="mt-1 text-xs font-semibold text-red-300 underline transition-colors hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-wait disabled:opacity-50"
                        >
                          {t("pricing.fitness_plus.wallet_retry")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {walletInsufficient && (
                  <div className="space-y-2 text-center" role="alert">
                    <p className="text-sm text-red-300">
                      {t("pricing.fitness_plus.wallet_insufficient", {
                        amount: formatPrice(checkoutAmount - walletBalance, i18n.language),
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        closeCheckout();
                        navigate("/wallet");
                      }}
                      className="mx-auto inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                    >
                      {t("pricing.fitness_plus.add_funds")}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void submitPurchase()}
                  disabled={purchaseMutation.isPending || !walletReady || walletQuery.isError || walletInsufficient}
                  className="w-full rounded-lg bg-primary py-3 font-bold text-white transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {purchaseMutation.isPending ? t("pricing.fitness_plus.processing") : t("pricing.fitness_plus.confirm")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

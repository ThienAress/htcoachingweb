import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { AlertTriangle, ArrowRight, CheckCircle, Sparkles, Wallet, X } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { purchaseFitnessPlusPlan } from "../../services/fitnessPlus.service";
import { walletBalanceQueryOptions } from "../../queries/walletAccount.queries";
import { applyFitnessPlusPurchaseResponse, fitnessPlusCatalogQueryOptions, myFitnessPlusSubscriptionQueryOptions } from "../../queries/fitnessPlus.queries";
import { createFitnessPlusPurchasePayload } from "../../utils/fitnessPlusCatalog";
import PricingSegmentedControl from "./PricingSegmentedControl";
import { useModalScrollLock } from "../../hooks/useModalScrollLock";

const FITNESS_PLUS_CATALOG_CHANGED_CODE = "FITNESS_PLUS_CATALOG_CHANGED";

const getQuotaWindowLimit = (policy, key) =>
  policy?.windows?.find((window) => window.key === key)?.limit ?? null;

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
  useModalScrollLock(Boolean(checkoutPlan));

  useEffect(() => {
    if (!checkoutPlan) return undefined;
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
      setCheckoutResult({
        success: true,
        message: response.data.message,
        data: response.data.data,
      });
      toast.success(response.data.message || "Đã kích hoạt gói HT Fitness+");
    } catch (error) {
      const errorCode = error.response?.data?.code;
      setCheckoutResult({
        success: false,
        code: errorCode,
        message:
          error.response?.data?.message ||
          t("pricing.fitness_plus.checkout_failed"),
      });
      toast.error(
        error.response?.data?.message ||
          t("pricing.fitness_plus.checkout_failed"),
      );
      if (errorCode === FITNESS_PLUS_CATALOG_CHANGED_CODE) {
        requestIdRef.current = null;
        await catalogQuery.refetch();
      }
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
  const checkoutPlanTitle = checkoutPlan
    ? isEnglish
      ? checkoutPlan.titleEn
      : checkoutPlan.title
    : "";
  const checkoutPlanSubtitle = checkoutPlan
    ? isEnglish
      ? checkoutPlan.subtitleEn
      : checkoutPlan.subtitle
    : "";
  const checkoutFormattedPrice = formatPrice(checkoutAmount, i18n.language);

  return (
    <>
      <PricingSegmentedControl
        ariaLabel={`${t("pricing.month")} / ${t("pricing.year")}`}
        className="mx-auto mb-10 w-full max-w-64"
        onChange={onBillingCycleChange}
        options={[
          { value: "month", label: t("pricing.month") },
          { value: "year", label: t("pricing.year") },
        ]}
        value={billingCycle}
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch">
        {plans.map((plan) => {
          const isActive = activePlanCode === plan.code;
          const price = plan.prices[billingCycle];
          const planTitle = isEnglish ? plan.titleEn : plan.title;
          const planSubtitle = isEnglish ? plan.subtitleEn : plan.subtitle;
          return (
            <article
              key={plan.code}
              className={`fitness-plus-plan-card relative flex w-full flex-col rounded-xl border-2 bg-[#1a1a1a] p-8 ${plan.featured ? "border-primary bg-[#222]" : "border-gray-800"}`}
            >
              {plan.featured && (
                <div className="absolute -right-3 -top-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow-md">
                  {t("pricing.popular")}
                </div>
              )}
              <div className="text-center">
                <h3 className="text-fluid-2xl font-bold uppercase text-white">
                  {planTitle}
                </h3>
                <p className="mt-1 min-h-12 text-fluid-sm leading-relaxed text-gray-400">
                  {planSubtitle}
                </p>
                <div className="mt-5 flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold leading-tight text-white xl:text-4xl">{formatPrice(price, i18n.language)}</span>
                  <span className="text-sm text-gray-400">/{t(`pricing.${billingCycle}`)}</span>
                </div>
              </div>

              <div className="mt-6 flex-1">
                <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
                  {t("pricing.fitness_plus.quota_title")}
                </h4>
                <ul className="mb-4 space-y-2 text-fluid-base text-gray-200">
                  <li className="flex items-start gap-2 border-b border-gray-700 pb-1">
                    <span className="text-primary">{"\u2713"}</span>
                    <span>
                      {t("pricing.fitness_plus.ai_chat_quota", {
                        burst: getQuotaWindowLimit(plan.quotas.aiChat, "burst"),
                        monthly: getQuotaWindowLimit(
                          plan.quotas.aiChat,
                          "monthly",
                        ),
                      })}
                    </span>
                  </li>
                  <li className="flex items-start gap-2 border-b border-gray-700 pb-1">
                    <span className="text-primary">{"\u2713"}</span>
                    <span>
                      {t("pricing.fitness_plus.meal_scan_quota", {
                        daily: getQuotaWindowLimit(plan.quotas.mealScan, "daily"),
                        monthly: getQuotaWindowLimit(
                          plan.quotas.mealScan,
                          "monthly",
                        ),
                      })}
                    </span>
                  </li>
                </ul>

                <div className="mt-4 mb-4">
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
                    {t("pricing.system_benefits")}
                  </h4>
                  <ul className="space-y-1.5">
                    {plan.features.map((feature) => (
                      <li className="flex items-start gap-2 text-fluid-sm text-gray-300" key={feature}>
                        <span className="mt-0.5 text-blue-400">{"\u2713"}</span>
                        <span>{t(`pricing.fitness_plus.features.${feature}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
                className="mt-7 w-full rounded-lg bg-primary py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-[background-color,box-shadow] duration-200 hover:bg-orange-500 hover:shadow-orange-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {isActive ? t("pricing.fitness_plus.current") : t("pricing.buy")}
              </button>
            </article>
          );
        })}
      </div>

      {checkoutPlan && createPortal((
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fitness-plus-checkout-title"
          onClick={closeCheckout}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" aria-hidden="true" />
          <div
            className="pricing-checkout-drawer absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto overscroll-contain border-l border-gray-700 bg-[#1a1a1a] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeCheckout}
              disabled={purchaseMutation.isPending}
              className="absolute left-4 top-4 z-10 flex size-11 items-center justify-center rounded-full border border-gray-700 bg-[#222] text-gray-400 transition-[color,border-color,background-color] duration-200 hover:border-gray-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none"
              aria-label={t("pricing.fitness_plus.close")}
            >
              <X className="size-5" aria-hidden="true" />
            </button>

            <div className="border-b border-gray-800 px-6 pb-5 pt-16">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Sparkles className="size-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 id="fitness-plus-checkout-title" className="text-xl font-bold text-white">
                    {checkoutPlanTitle}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-gray-400">
                    {checkoutPlanSubtitle}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-3xl font-bold text-white">{checkoutFormattedPrice}</span>
                <span className="mb-1 text-gray-400">/{t(`pricing.${billingCycle}`)}</span>
              </div>
            </div>

            {checkoutResult ? (
              <div className="space-y-5 px-6 py-10">
                <div className="flex flex-col items-center space-y-4 text-center">
                  {checkoutResult.success ? (
                    <>
                      <div className="flex size-20 items-center justify-center rounded-full bg-green-500/20">
                        <CheckCircle className="size-10 text-green-400" aria-hidden="true" />
                      </div>
                      <h4 className="text-xl font-bold text-green-400">
                        {t("pricing.fitness_plus.success_title")}
                      </h4>
                      <p className="text-sm text-gray-400" role="status">
                        {checkoutResult.message || t("pricing.fitness_plus.checkout_success")}
                      </p>
                      {Number.isSafeInteger(checkoutResult.data?.newBalance) && (
                        <div className="w-full rounded-xl bg-[#222] p-4 text-sm">
                          <div className="flex justify-between gap-4 text-gray-400">
                            <span>{t("pricing.fitness_plus.remaining_balance")}</span>
                            <span className="font-semibold text-white">
                              {formatPrice(checkoutResult.data.newBalance, i18n.language)}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex size-20 items-center justify-center rounded-full bg-red-500/20">
                        <AlertTriangle className="size-10 text-red-400" aria-hidden="true" />
                      </div>
                      <h4 className="text-xl font-bold text-red-400">
                        {t("pricing.fitness_plus.failure_title")}
                      </h4>
                      <p className="text-sm text-gray-400" role="alert">
                        {checkoutResult.message}
                      </p>
                    </>
                  )}
                </div>

                <div className={`grid gap-3 ${checkoutResult.success || checkoutResult.code === FITNESS_PLUS_CATALOG_CHANGED_CODE ? "grid-cols-1" : "grid-cols-2"}`}>
                  <button
                    type="button"
                    onClick={closeCheckout}
                    className="min-h-11 rounded-xl bg-gray-700 px-4 py-3 font-semibold text-white transition-colors hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 motion-reduce:transition-none"
                  >
                    {t("pricing.fitness_plus.close")}
                  </button>
                  {!checkoutResult.success && checkoutResult.code !== FITNESS_PLUS_CATALOG_CHANGED_CODE && (
                    <button
                      type="button"
                      onClick={() => void submitPurchase()}
                      disabled={purchaseMutation.isPending}
                      className="min-h-11 rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none"
                    >
                      {purchaseMutation.isPending
                        ? t("pricing.fitness_plus.processing")
                        : t("pricing.fitness_plus.try_again")}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6 px-6 py-6">
                <div>
                  <p className="mb-3 text-sm font-medium text-gray-400">
                    {t("pricing.fitness_plus.payment_method")}
                  </p>
                  <div className="rounded-xl border-2 border-primary/50 bg-[#222] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                          <Wallet className="size-5 text-primary" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {t("pricing.fitness_plus.wallet")}
                          </p>
                          {walletQuery.isPending || walletQuery.isFetching ? (
                            <p className="text-xs text-gray-500" role="status">
                              {t("pricing.fitness_plus.wallet_loading")}
                            </p>
                          ) : walletQuery.isError || !walletReady ? (
                            <div className="text-xs text-red-400" role="alert">
                              <p>{t("pricing.fitness_plus.wallet_error")}</p>
                              <button
                                type="button"
                                onClick={() => walletQuery.refetch()}
                                disabled={walletQuery.isFetching}
                                className="mt-1 font-semibold underline transition-colors hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none"
                              >
                                {t("pricing.fitness_plus.wallet_retry")}
                              </button>
                            </div>
                          ) : (
                            <p className={`text-xs font-medium ${walletInsufficient ? "text-red-400" : "text-green-400"}`}>
                              {t("pricing.fitness_plus.balance_label")}: {formatPrice(walletBalance, i18n.language)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary" aria-hidden="true">
                        <div className="size-2.5 rounded-full bg-primary" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl bg-[#222] p-4">
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-gray-400">{t("pricing.fitness_plus.plan_price")}</span>
                    <span className="font-medium text-white">{checkoutFormattedPrice}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-gray-700 pt-3">
                    <span className="font-bold text-white">{t("pricing.fitness_plus.total")}</span>
                    <span className="text-2xl font-bold text-primary">{checkoutFormattedPrice}</span>
                  </div>
                </div>

                {walletInsufficient && (
                  <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center" role="alert">
                    <p className="text-sm font-medium text-red-400">
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
                      className="mx-auto inline-flex min-h-11 items-center justify-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 motion-reduce:transition-none"
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
                  className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-white shadow-lg shadow-orange-500/20 transition-[background-color,box-shadow] duration-200 hover:bg-orange-500 hover:shadow-orange-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none motion-reduce:transition-none"
                >
                  {purchaseMutation.isPending
                    ? t("pricing.fitness_plus.processing")
                    : t("pricing.fitness_plus.confirm")}
                </button>
              </div>
            )}
          </div>
        </div>
      ), document.body)}
    </>
  );
}

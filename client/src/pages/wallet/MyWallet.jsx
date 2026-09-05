import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Landmark,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/AuthContext";
import { useDepositPolicy } from "../../hooks/useDepositPolicy";
import { useModalScrollLock } from "../../hooks/useModalScrollLock";
import {
  getDepositSettlementSignal,
  invalidateDepositHistory,
  walletBalanceQueryOptions,
  walletDepositsQueryOptions,
} from "../../queries/walletAccount.queries";
import { createDeposit } from "../../services/wallet.service";
import { calculateDepositPreview } from "../../utils/depositPolicy";

const EMPTY_DEPOSITS = [];
const QUICK_AMOUNTS = [10_000, 50_000, 100_000, 200_000, 500_000, 1_000_000];
const DEPOSIT_GUIDE_STEPS = [
  "choose_tier",
  "enter_amount",
  "create_invoice",
  "transfer",
  "wallet_credit",
];

const formatVND = (amount, language = "vi") =>
  new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number.isSafeInteger(amount) ? amount : 0);

const parseAmount = (value) => {
  if (!/^\d+$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : null;
};

const parseQrPayload = (payload) => {
  try {
    const value = JSON.parse(payload || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
};

const snapshotFields = (deposit) => ({
  bonusRate: deposit.bonusRate ?? 0,
  bonusAmount: deposit.bonusAmount ?? 0,
  creditedAmount: deposit.creditedAmount ?? deposit.amount,
  bonusTierKey: deposit.bonusTierKey ?? null,
  policyVersion: deposit.policyVersion ?? null,
});

const toActiveDeposit = (deposit) =>
  deposit
    ? {
        depositRequestId: deposit.depositRequestId || deposit._id,
        amount: deposit.amount,
        depositCode: deposit.depositCode,
        qrPayload: deposit.qrPayload,
        expiresAt: deposit.expiresAt,
        status: deposit.status,
        ...snapshotFields(deposit),
      }
    : null;

const statusMap = {
  pending: {
    key: "status.pending",
    icon: Clock3,
    classes: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  success: {
    key: "status.success",
    icon: CheckCircle2,
    classes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  expired: {
    key: "status.expired",
    icon: XCircle,
    classes: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  },
  rejected: {
    key: "status.rejected",
    icon: XCircle,
    classes: "bg-red-50 text-red-700 ring-red-200",
  },
  needs_review: {
    key: "status.needs_review",
    icon: AlertTriangle,
    classes: "bg-orange-50 text-orange-700 ring-orange-200",
  },
  reversed: {
    key: "status.reversal",
    icon: RefreshCw,
    classes: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  },
};

const StatusBadge = ({ status, t }) => {
  const item = statusMap[status] || statusMap.pending;
  const Icon = item.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${item.classes}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {t(item.key, { defaultValue: status })}
    </span>
  );
};

const Countdown = ({ expiresAt, onExpired, t }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const calculate = () => {
      const seconds = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
      );
      setTimeLeft(seconds);
      if (seconds === 0) onExpired?.();
    };
    calculate();
    const timer = window.setInterval(calculate, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, onExpired]);

  if (timeLeft <= 0) {
    return <span className="font-semibold text-red-600">{t("wallet.expired_label")}</span>;
  }
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  return (
    <span className="font-mono font-bold tabular-nums text-zinc-900">
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
};

const DepositGuide = ({ t }) => (
  <section
    aria-labelledby="deposit-guide-heading"
    className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6"
  >
    <div className="max-w-2xl">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-800">
        {t("wallet.deposit_guide.eyebrow")}
      </p>
      <h3 id="deposit-guide-heading" className="mt-2 text-lg font-black text-zinc-900">
        {t("wallet.deposit_guide.title")}
      </h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        {t("wallet.deposit_guide.subtitle")}
      </p>
    </div>

    <ol className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
      {DEPOSIT_GUIDE_STEPS.map((step, index) => (
        <li key={step} className="flex gap-3 xl:block">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-orange-800 ring-1 ring-inset ring-primary/25"
          >
            {index + 1}
          </span>
          <div className="min-w-0 xl:mt-3">
            <h4 className="text-sm font-bold text-zinc-900">
              {t(`wallet.deposit_guide.steps.${step}.title`)}
            </h4>
            <p className="mt-1 text-xs leading-5 text-zinc-600">
              {t(`wallet.deposit_guide.steps.${step}.description`)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  </section>
);

const TierCard = ({ tier, active, maxAmount, language, t }) => {
  return (
    <article
      aria-current={active ? "true" : undefined}
      className={`relative rounded-2xl border p-5 transition-[border-color,box-shadow,transform] duration-200 ${
        active
          ? "-translate-y-1 border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100"
          : "border-zinc-200 bg-white shadow-sm"
      }`}
    >
      {active && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t("wallet.tier_applied")}
        </span>
      )}
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary-dark">
        <Landmark className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 max-w-[15rem] text-base font-bold text-zinc-900">
        {t("wallet.tpbank_name")}
      </h3>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {t(`wallet.tiers.${tier.key}`)}
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">{t("wallet.minimum")}</dt>
          <dd className="font-semibold text-zinc-900">
            {formatVND(tier.minAmount, language)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">{t("wallet.maximum")}</dt>
          <dd className="font-semibold text-zinc-900">
            {formatVND(maxAmount, language)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-zinc-200 pt-4">
        <p className="text-xs text-zinc-500">{t("wallet.bonus_rate")}</p>
        <p className="text-3xl font-black text-emerald-700">+{tier.bonusRate}%</p>
      </div>
    </article>
  );
};

const MyWallet = () => {
  const { t, i18n } = useTranslation("account");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?._id;
  const language = i18n.language;
  const [depositAmount, setDepositAmount] = useState("");
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [qrFailed, setQrFailed] = useState(false);
  const previousSettlementSignal = useRef(null);
  const dialogRef = useRef(null);
  const closeDialogButtonRef = useRef(null);

  const {
    data: depositPolicy,
    isLoading: policyLoading,
    isError: policyError,
    refetch: refetchPolicy,
  } = useDepositPolicy();
  const walletQuery = useQuery(walletBalanceQueryOptions({ userId }));
  const depositsQuery = useQuery(walletDepositsQueryOptions({ userId }));
  const deposits = depositsQuery.data || EMPTY_DEPOSITS;
  const settlementSignal = getDepositSettlementSignal(deposits);

  useEffect(() => {
    if (!depositsQuery.data) return;
    if (
      previousSettlementSignal.current !== null &&
      previousSettlementSignal.current !== settlementSignal
    ) {
      void walletQuery.refetch();
    }
    previousSettlementSignal.current = settlementSignal;
  }, [depositsQuery.data, settlementSignal, walletQuery]);

  const refreshedSelectedDeposit = selectedDeposit?.depositRequestId
    ? deposits.find(
        (deposit) => deposit._id === selectedDeposit.depositRequestId,
      )
    : null;
  const activeDeposit = toActiveDeposit(refreshedSelectedDeposit || selectedDeposit);
  const qrOpen = activeDeposit?.status === "pending";
  useModalScrollLock(qrOpen);

  useEffect(() => {
    if (!qrOpen) return undefined;
    const previouslyFocused = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedDeposit(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const focusTimer = window.requestAnimationFrame(() =>
      closeDialogButtonRef.current?.focus(),
    );
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [qrOpen]);

  const createDepositMutation = useMutation({
    mutationFn: createDeposit,
    onSuccess: () => invalidateDepositHistory(queryClient, userId),
    onError: (error) =>
      error?.response?.status === 409
        ? invalidateDepositHistory(queryClient, userId)
        : undefined,
  });

  const numericAmount = parseAmount(depositAmount);
  const preview = useMemo(
    () =>
      depositPolicy
        ? calculateDepositPreview(depositPolicy, numericAmount ?? 0)
        : null,
    [depositPolicy, numericAmount],
  );
  const hasNeedsReview = deposits.some((deposit) => deposit.status === "needs_review");
  const hasPendingDeposit = deposits.some((deposit) => deposit.status === "pending");
  const hasOpenDeposit = hasNeedsReview || hasPendingDeposit;
  const validAmount = Boolean(
    depositPolicy &&
      numericAmount !== null &&
      numericAmount >= depositPolicy.minAmount &&
      numericAmount <= depositPolicy.maxAmount,
  );

  const handleCreateDeposit = async () => {
    if (!depositPolicy) {
      toast.error(t("wallet.errors.policy_unavailable"));
      return;
    }
    if (!validAmount) {
      toast.error(
        numericAmount !== null && numericAmount > depositPolicy.maxAmount
          ? t("wallet.errors.max_limit")
          : t("wallet.errors.min_limit"),
      );
      return;
    }
    try {
      const response = await createDepositMutation.mutateAsync(numericAmount);
      setQrFailed(false);
      setSelectedDeposit(toActiveDeposit(response.data.data));
      setDepositAmount("");
      toast.success(t("wallet.errors.create_success"));
    } catch (error) {
      toast.error(error.response?.data?.message || t("wallet.errors.create_failed"));
    }
  };

  const handleCheckStatus = async () => {
    await Promise.all([walletQuery.refetch(), depositsQuery.refetch()]);
    toast.info(t("wallet.check_status_done"));
  };

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("wallet.errors.copy_success", { label }));
    } catch {
      toast.error(t("wallet.errors.copy_failed"));
    }
  };

  const qr = parseQrPayload(activeDeposit?.qrPayload);
  const qrSource = qr.accountNumber
    ? `https://img.vietqr.io/image/${qr.bankCode || "TPB"}-${qr.accountNumber}-compact.png?amount=${qr.amount}&addInfo=${encodeURIComponent(qr.content || "")}&accountName=${encodeURIComponent(qr.accountHolder || "")}`
    : "";
  const loading = walletQuery.isPending || depositsQuery.isPending;

  return (
    <phantom-ui loading={loading || undefined}>
      <div className="min-h-screen bg-zinc-50 text-zinc-900">
        <SEO title={t("wallet.title")} noindex />

        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-zinc-600 transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("wallet.back")}
              </button>
              <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
                  <Wallet className="h-6 w-6" aria-hidden="true" />
                </span>
                {t("wallet.title")}
              </h1>
              <p className="mt-2 text-sm text-zinc-600">
                {t("wallet.welcome")}, {user?.name || user?.email}
              </p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-4 lg:min-w-72 lg:text-right">
              <p className="text-sm font-medium text-zinc-700">{t("wallet.balance")}</p>
              {walletQuery.isError ? (
                <button
                  type="button"
                  onClick={() => walletQuery.refetch()}
                  disabled={walletQuery.isFetching}
                  className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-700 transition-colors duration-200 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-wait disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {t("wallet.retry_balance")}
                </button>
              ) : (
                <p className="mt-1 text-3xl font-black text-primary-dark">
                  {walletQuery.data?.balance === undefined
                    ? "—"
                    : formatVND(walletQuery.data.balance, language)}
                </p>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
          {hasOpenDeposit && (
            <section
              role="status"
              className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                <div>
                  <h2 className="font-bold text-amber-900">
                    {hasNeedsReview
                      ? t("wallet.needs_review_warning")
                      : t("wallet.pending_warning")}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-800">
                    {hasNeedsReview
                      ? t("wallet.needs_review_desc")
                      : t("wallet.pending_desc")}
                  </p>
                </div>
              </div>
              {hasPendingDeposit && (
                <button
                  type="button"
                  onClick={() => {
                    setQrFailed(false);
                    setSelectedDeposit(
                      toActiveDeposit(
                        deposits.find((deposit) => deposit.status === "pending"),
                      ),
                    );
                  }}
                  className="min-h-11 shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                >
                  {t("wallet.view_transfer")}
                </button>
              )}
            </section>
          )}

          <section aria-labelledby="deposit-heading" className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-3 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="deposit-heading" className="text-xl font-black text-zinc-900">
                  {t("wallet.create_invoice")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                  {t("wallet.bonus_intro")}
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700">
                <ShieldCheck className="h-4 w-4 text-primary-dark" aria-hidden="true" />
                {t("wallet.secure_transfer")}
              </span>
            </div>

            <DepositGuide t={t} />

            {policyError ? (
              <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                <p>{t("wallet.errors.policy_unavailable")}</p>
                <button
                  type="button"
                  onClick={() => refetchPolicy()}
                  className="mt-3 min-h-11 rounded-lg border border-red-300 px-4 font-bold transition-colors duration-200 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  {t("wallet.retry")}
                </button>
              </div>
            ) : policyLoading || !depositPolicy ? (
              <div className="mt-6 flex min-h-40 items-center justify-center text-zinc-500" role="status">
                <LoaderCircle className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {t("wallet.loading_policy")}
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  {depositPolicy.tiers.map((tier) => (
                    <TierCard
                      key={tier.key}
                      tier={tier}
                      active={preview?.bonusTierKey === tier.key}
                      maxAmount={depositPolicy.maxAmount}
                      language={language}
                      t={t}
                    />
                  ))}
                </div>

                <div className="mt-7 grid gap-6 border-t border-zinc-200 pt-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
                  <div>
                    <label htmlFor="deposit-amount" className="text-sm font-bold text-zinc-800">
                      {t("wallet.enter_amount")}
                    </label>
                    <div className="mt-2 flex rounded-xl border border-zinc-300 bg-zinc-50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                      <input
                        id="deposit-amount"
                        name="depositAmount"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={depositAmount}
                        onChange={(event) => {
                          if (/^\d*$/.test(event.target.value)) {
                            setDepositAmount(event.target.value);
                          }
                        }}
                        disabled={hasOpenDeposit || createDepositMutation.isPending}
                        aria-describedby="deposit-range"
                        placeholder={t("wallet.amount_placeholder")}
                        className="min-h-14 w-full rounded-l-xl bg-transparent px-4 text-lg font-bold text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <span className="flex items-center border-l border-zinc-200 px-4 font-bold text-zinc-600">VND</span>
                    </div>
                    <p id="deposit-range" className="mt-2 text-xs text-zinc-500">
                      {t("wallet.amount_range", {
                        min: formatVND(depositPolicy.minAmount, language),
                        max: formatVND(depositPolicy.maxAmount, language),
                      })}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2" aria-label={t("wallet.quick_amount")}>
                      {QUICK_AMOUNTS.filter(
                        (amount) => amount <= depositPolicy.maxAmount,
                      ).map((amount) => (
                        <button
                          type="button"
                          key={amount}
                          onClick={() => setDepositAmount(String(amount))}
                          disabled={hasOpenDeposit || createDepositMutation.isPending}
                          className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${
                            numericAmount === amount
                              ? "border-primary bg-primary/10 text-orange-800"
                              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                          }`}
                        >
                          {formatVND(amount, language)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <aside className="rounded-2xl bg-zinc-900 p-5 text-white" aria-live="polite">
                    <div className="flex items-center gap-2 text-primary-light">
                      <Sparkles className="h-5 w-5" aria-hidden="true" />
                      <h3 className="font-bold">{t("wallet.deposit_preview")}</h3>
                    </div>
                    <dl className="mt-5 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-zinc-400">{t("wallet.transfer_amount")}</dt>
                        <dd className="font-semibold">{formatVND(preview?.amount || 0, language)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-zinc-400">
                          {t("wallet.bonus_with_rate", { rate: preview?.bonusRate || 0 })}
                        </dt>
                        <dd className="font-semibold text-amber-300">
                          +{formatVND(preview?.bonusAmount || 0, language)}
                        </dd>
                      </div>
                      <div className="flex items-end justify-between gap-4 border-t border-zinc-700 pt-4">
                        <dt className="font-bold text-zinc-200">{t("wallet.credited_amount")}</dt>
                        <dd className="text-2xl font-black text-emerald-300">
                          {formatVND(preview?.creditedAmount || 0, language)}
                        </dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      onClick={handleCreateDeposit}
                      disabled={
                        hasOpenDeposit ||
                        !validAmount ||
                        createDepositMutation.isPending
                      }
                      className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-black text-zinc-950 transition-[background-color,box-shadow] duration-200 hover:bg-primary-dark hover:shadow-lg hover:shadow-orange-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 disabled:shadow-none"
                    >
                      {createDepositMutation.isPending ? (
                        <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        <Landmark className="h-5 w-5" aria-hidden="true" />
                      )}
                      {createDepositMutation.isPending
                        ? t("wallet.confirm_loading")
                        : t("wallet.create_invoice_action")}
                    </button>
                  </aside>
                </div>
              </>
            )}
          </section>

          <section aria-labelledby="history-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="history-heading" className="flex items-center gap-2 text-xl font-black text-zinc-900">
                  <Clock3 className="h-5 w-5 text-zinc-500" aria-hidden="true" />
                  {t("wallet.history_title")}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">{t("wallet.history_desc")}</p>
              </div>
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={walletQuery.isFetching || depositsQuery.isFetching}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-700 transition-colors duration-200 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t("wallet.check_status")}
              </button>
            </div>

            {depositsQuery.isError && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {t("wallet.errors.history_failed")}
              </div>
            )}
            {deposits.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white py-12 text-center text-zinc-500">
                {t("history.no_txs")}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <table className="min-w-[760px] w-full border-collapse text-left text-sm">
                  <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-600">
                    <tr>
                      <th className="px-5 py-4">{t("wallet.request_code")}</th>
                      <th className="px-5 py-4">{t("wallet.transfer_amount")}</th>
                      <th className="px-5 py-4">{t("wallet.bonus")}</th>
                      <th className="px-5 py-4">{t("wallet.credited_amount")}</th>
                      <th className="px-5 py-4">{t("history.status")}</th>
                      <th className="px-5 py-4">{t("history.date")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {deposits.map((deposit) => {
                      const snapshot = snapshotFields(deposit);
                      return (
                        <tr
                          key={deposit._id}
                          className="transition-colors duration-200 hover:bg-zinc-50"
                        >
                          <td className="px-5 py-4 font-mono font-semibold text-zinc-800">
                            {deposit.depositCode}
                            {deposit.status === "pending" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setQrFailed(false);
                                  setSelectedDeposit(toActiveDeposit(deposit));
                                }}
                                className="ml-3 rounded-md px-2 py-1 font-sans text-xs font-bold text-orange-800 transition-colors duration-200 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                {t("wallet.view")}
                              </button>
                            )}
                          </td>
                          <td className="px-5 py-4 font-semibold text-zinc-800">
                            {formatVND(deposit.amount, language)}
                          </td>
                          <td className="px-5 py-4 font-semibold text-amber-700">
                            +{formatVND(snapshot.bonusAmount, language)}
                            {snapshot.bonusRate > 0 && (
                              <span className="ml-1 text-xs">({snapshot.bonusRate}%)</span>
                            )}
                          </td>
                          <td className="px-5 py-4 font-bold text-emerald-700">
                            {formatVND(snapshot.creditedAmount, language)}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={deposit.status} t={t} />
                          </td>
                          <td className="px-5 py-4 text-zinc-600">
                            {new Date(deposit.createdAt).toLocaleString(
                              language === "vi" ? "vi-VN" : "en-US",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              },
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>

        {qrOpen && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/65 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedDeposit(null);
            }}
          >
            <section
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="deposit-payment-title"
              className="z-50 max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-3xl bg-white shadow-2xl"
            >
              <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-4 sm:px-7">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="deposit-payment-title" className="text-xl font-black text-zinc-900">
                      {t("wallet.payment_invoice")}
                    </h2>
                    <StatusBadge status="pending" t={t} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {t("wallet.request_code")}: {activeDeposit.depositCode}
                  </p>
                </div>
                <button
                  ref={closeDialogButtonRef}
                  type="button"
                  onClick={() => setSelectedDeposit(null)}
                  aria-label={t("wallet.close_payment")}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </header>

              <div className="p-5 sm:p-7">
                <div className="rounded-3xl bg-zinc-100 p-5 text-center sm:p-7">
                  <div className="mx-auto flex h-64 w-64 max-w-full items-center justify-center rounded-2xl bg-white p-3 shadow-sm">
                    {qrSource && !qrFailed ? (
                      <img
                        src={qrSource}
                        alt={t("wallet.qr_alt")}
                        className="h-full w-full object-contain"
                        onError={() => setQrFailed(true)}
                      />
                    ) : (
                      <div role="alert" className="max-w-48 text-sm leading-6 text-red-700">
                        {t("wallet.errors.qr_failed")}
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-sm italic text-zinc-600">{t("wallet.scan_qr")}</p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    {t("wallet.expires_at")}:
                    <Countdown
                      expiresAt={activeDeposit.expiresAt}
                      onExpired={() => {
                        setSelectedDeposit(null);
                        void depositsQuery.refetch();
                      }}
                      t={t}
                    />
                  </div>
                </div>

                <h3 className="mt-7 text-sm font-black uppercase tracking-wide text-zinc-500">
                  {t("wallet.payment_details")}
                </h3>
                <dl className="mt-3 divide-y divide-zinc-200 text-sm">
                  {[
                    [t("wallet.bank"), qr.bankName],
                    [t("wallet.account_holder"), qr.accountHolder],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-5 py-3">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className="text-right font-bold text-zinc-900">{value || "—"}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-5 py-3">
                    <dt className="text-zinc-500">{t("wallet.account_number")}</dt>
                    <dd className="flex items-center gap-2 font-bold text-zinc-900">
                      {qr.accountNumber || "—"}
                      {qr.accountNumber && (
                        <button
                          type="button"
                          onClick={() => handleCopy(qr.accountNumber, t("wallet.account_number"))}
                          aria-label={t("wallet.copy_field", { field: t("wallet.account_number") })}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-dark transition-colors duration-200 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-5 py-3">
                    <dt className="text-zinc-500">{t("wallet.content")}</dt>
                    <dd className="flex items-center gap-2 font-black text-amber-700">
                      {qr.content || activeDeposit.depositCode}
                      <button
                        type="button"
                        onClick={() => handleCopy(qr.content || activeDeposit.depositCode, t("wallet.content"))}
                        aria-label={t("wallet.copy_field", { field: t("wallet.content") })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-dark transition-colors duration-200 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </dd>
                  </div>
                </dl>

                <dl className="mt-4 rounded-2xl bg-zinc-50 p-5">
                  <div className="flex justify-between gap-4 text-sm">
                    <dt className="text-zinc-600">{t("wallet.transfer_amount")}</dt>
                    <dd className="font-bold text-zinc-900">{formatVND(activeDeposit.amount, language)}</dd>
                  </div>
                  <div className="mt-3 flex justify-between gap-4 text-sm">
                    <dt className="text-zinc-600">
                      {t("wallet.bonus_with_rate", { rate: activeDeposit.bonusRate })}
                    </dt>
                    <dd className="font-bold text-amber-700">
                      +{formatVND(activeDeposit.bonusAmount, language)}
                    </dd>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-4 border-t border-zinc-200 pt-4">
                    <dt className="font-bold text-zinc-800">{t("wallet.credited_amount")}</dt>
                    <dd className="text-2xl font-black text-emerald-700">
                      +{formatVND(activeDeposit.creditedAmount, language)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <p>{t("wallet.warning_alert")}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={walletQuery.isFetching || depositsQuery.isFetching}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 font-bold text-white transition-colors duration-200 hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-50"
                >
                  <RefreshCw className="h-5 w-5" aria-hidden="true" />
                  {t("wallet.check_status")}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </phantom-ui>
  );
};

export default MyWallet;

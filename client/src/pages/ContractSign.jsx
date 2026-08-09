import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FileText,
  Loader2,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import SEO from "../components/SEO";
import SignatureCanvas from "../components/SignatureCanvas";
import {
  getContractById,
  markAsViewed,
  signContract,
} from "../services/contract.service";

const ContractSign = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation("coaching");
  const documentRef = useRef(null);
  const endRef = useRef(null);
  const markRequestedRef = useRef(false);

  const [agreed, setAgreed] = useState(false);
  const [signatureImage, setSignatureImage] = useState("");
  const [hasReadAll, setHasReadAll] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [readError, setReadError] = useState("");

  const {
    data: contractData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["contract", id],
    queryFn: () => getContractById(id),
  });
  const contract = contractData?.data?.data;
  const sections = contract?.customSections || [];

  const readComplete = hasReadAll || Boolean(contract && contract.status !== "sent");
  const displayedProgress = readComplete ? 100 : readProgress;

  useEffect(() => {
    const updateProgress = () => {
      const element = documentRef.current;
      if (!element || readComplete) return;
      const rect = element.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight * 0.5);
      const travelled = Math.min(distance, Math.max(0, -rect.top + 120));
      setReadProgress(Math.round((travelled / distance) * 100));
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [readComplete]);

  const markViewedMutation = useMutation({
    mutationFn: () => markAsViewed(id),
    onSuccess: () => {
      setHasReadAll(true);
      setReadProgress(100);
      setReadError("");
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
    },
    onError: (requestError) => {
      markRequestedRef.current = false;
      setReadError(
        requestError.response?.data?.message || t("contract.read_confirm_error"),
      );
    },
  });

  const confirmRead = useCallback(() => {
    if (
      contract?.status === "sent" &&
      !markRequestedRef.current &&
      !markViewedMutation.isPending
    ) {
      markRequestedRef.current = true;
      markViewedMutation.mutate();
    }
  }, [contract?.status, markViewedMutation]);

  useEffect(() => {
    const target = endRef.current;
    if (!target || readComplete) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) confirmRead();
      },
      { threshold: 0.8 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [confirmRead, readComplete]);

  const signMutation = useMutation({
    mutationFn: () =>
      signContract(id, {
        signatureImage,
        acceptedTerms: agreed,
      }),
    onSuccess: () => {
      toast.success(t("contract.toasts.success"));
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      queryClient.invalidateQueries({ queryKey: ["account", "contracts"] });
      setSignatureImage("");
    },
    onError: (requestError) => {
      toast.error(requestError.response?.data?.message || t("contract.toasts.error"));
    },
  });

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString(
          i18n.language === "vi" ? "vi-VN" : "en-US",
        )
      : "…";
  const formatCurrency = (value) =>
    value
      ? `${Number(value).toLocaleString(
          i18n.language === "vi" ? "vi-VN" : "en-US",
        )} VND`
      : "…";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4">
        <FileText className="mb-4 h-12 w-12 text-zinc-300" />
        <p className="text-center text-zinc-600">{t("contract.not_exist")}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 min-h-11 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          ← {t("common.back")}
        </button>
      </div>
    );
  }

  const isSigned = contract.status === "signed";
  const isExpired = contract.status === "expired";
  const isCancelled = contract.status === "cancelled";
  const canSign =
    readComplete &&
    agreed &&
    Boolean(signatureImage) &&
    contract.status === "viewed" &&
    !isSigned &&
    !isExpired &&
    !isCancelled &&
    !signMutation.isPending;

  return (
    <div className="min-h-screen bg-zinc-100 pb-8 text-zinc-900">
      <SEO title={t("seo_contract")} noindex />
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{t("contract.viewer_title")}</p>
            <p className="text-xs text-zinc-500">
              {readComplete
                ? t("contract.read_complete")
                : t("contract.read_progress", { progress: displayedProgress })}
            </p>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
        </div>
        <progress
          value={displayedProgress}
          max="100"
          aria-label={t("contract.read_progress_label")}
          className="block h-1 w-full accent-emerald-700"
        />
      </header>

      <main className="mx-auto max-w-4xl px-3 pt-5 sm:px-6">
        <article
          ref={documentRef}
          className="overflow-hidden rounded-xl border border-zinc-300 bg-zinc-50 shadow-sm"
        >
          <div className="bg-emerald-800 px-6 py-4 text-emerald-50 sm:px-10">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold tracking-wide">HTCOACHING</p>
              <p className="text-xs text-emerald-100/80">
                {t("contract.contract_code", { code: contract._id })}
              </p>
            </div>
          </div>

          <div className="space-y-8 px-5 py-8 sm:px-10 sm:py-10">
            <div className="text-center">
              <p className="text-xs tracking-[0.16em] text-zinc-500">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </p>
              <p className="mt-1 text-xs text-zinc-500">{t("contract.sub_header")}</p>
              <h1 className="mt-6 text-balance text-xl font-bold uppercase sm:text-2xl">
                {t("contract.title")}
              </h1>
            </div>

            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase">{t("contract.party_a")}</h2>
              <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-zinc-500">{t("contract.fullname")}</dt><dd className="font-medium">{contract.trainerInfo?.name || "…"}</dd></div>
                <div><dt className="text-zinc-500">{t("contract.birthyear")}</dt><dd>{contract.trainerInfo?.birthYear || "…"}</dd></div>
                <div><dt className="text-zinc-500">{t("contract.phone")}</dt><dd>{contract.trainerInfo?.phone || "…"}</dd></div>
                <div><dt className="text-zinc-500">Email</dt><dd>{contract.trainerInfo?.email || "…"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-zinc-500">{t("contract.address")}</dt><dd>{contract.trainerInfo?.address || "…"}</dd></div>
              </dl>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase">{t("contract.party_b")}</h2>
              <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-zinc-500">{t("contract.fullname")}</dt><dd className="font-medium">{contract.clientInfo?.name || "…"}</dd></div>
                <div><dt className="text-zinc-500">{t("contract.phone")}</dt><dd>{contract.clientInfo?.phone || "…"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-zinc-500">Email</dt><dd>{contract.clientInfo?.email || "…"}</dd></div>
              </dl>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase">{t("contract.package_info")}</h2>
              <div className="overflow-x-auto border-y border-zinc-200">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t("contract.col_sessions")}</th>
                      <th className="px-4 py-3 font-medium">{t("contract.col_price")}</th>
                      <th className="px-4 py-3 text-right font-medium">{t("contract.col_total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 font-semibold">{contract.packageDetails?.sessions || "…"}</td>
                      <td className="px-4 py-3">{formatCurrency(contract.packageDetails?.pricePerSession)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(contract.packageDetails?.totalAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-zinc-600">
                {formatDate(contract.packageDetails?.startDate)} – {formatDate(contract.packageDetails?.endDate)}
              </p>
            </section>

            {sections.length > 0 && (
              <section className="space-y-5">
                <h2 className="text-sm font-bold uppercase">{t("contract.policies")}</h2>
                {sections.map((section, index) => (
                  <div key={`${section.title}-${index}`} className="space-y-2">
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    {section.content && <p className="max-w-prose text-sm leading-6 text-zinc-700">{section.content}</p>}
                    {section.items?.length > 0 && (
                      <ol className="list-decimal space-y-1 pl-6 text-sm leading-6 text-zinc-700">
                        {section.items.map((item, itemIndex) => (
                          <li key={`${item}-${itemIndex}`}>{item}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </section>
            )}

            <section className="border-t border-zinc-200 pt-6">
              <div className="flex gap-3">
                <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold">{t("contract.issuer_confirmation")}</h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{t("contract.issuer_confirmation_copy")}</p>
                  {contract.trainerSignature && (
                    <div className="mt-4 max-w-xs rounded-lg border border-emerald-200 bg-white p-3">
                      <img
                        src={contract.trainerSignature}
                        alt={t("contract.signature_a")}
                        className="h-20 w-full object-contain"
                      />
                      <p className="mt-2 text-xs font-medium text-zinc-700">
                        {contract.trainerInfo?.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <div ref={endRef} className="h-1" aria-hidden="true" />
          </div>
        </article>

        {readError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>{readError}</p>
            <button type="button" onClick={confirmRead} className="mt-2 inline-flex min-h-11 items-center font-semibold underline focus-visible:outline-2 focus-visible:outline-red-700">
              {t("contract.retry_read_confirm")}
            </button>
          </div>
        )}

        {(isExpired || isCancelled) && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-center font-semibold text-red-700">
            {isExpired ? t("contract.status_expired") : t("contract.status_cancelled")}
          </div>
        )}

        {isSigned && (
          <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5" aria-live="polite">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-700" />
              <div>
                <h2 className="font-semibold text-emerald-950">{t("contract.signed_btn")}</h2>
                <p className="mt-1 text-sm text-emerald-900">{t("contract.status_signed", { date: formatDate(contract.signedAt) })}</p>
                <p className="mt-1 text-sm text-emerald-900">
                  {t("contract.signed_with_handwritten")}
                </p>
                {contract.signatureImage && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-3">
                    <img
                      src={contract.signatureImage}
                      alt={t("contract.signature_b")}
                      className="h-20 w-full max-w-xs object-contain"
                    />
                    <p className="mt-2 text-xs font-medium text-zinc-700">
                      {contract.clientInfo?.name}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {!isSigned && !isExpired && !isCancelled && (
          <section className="mt-5 space-y-5 rounded-xl border border-zinc-300 bg-zinc-50 p-4 shadow-sm sm:p-6">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <PenLine className="h-5 w-5" aria-hidden="true" />
                <h2 className="font-semibold">{t("contract.sign_title")}</h2>
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {t("contract.handwritten_instruction")}
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                disabled={!readComplete || signMutation.isPending}
                className="mt-1 h-5 w-5 shrink-0 accent-emerald-700"
              />
              <span className="text-sm leading-6 text-zinc-700">
                {readComplete ? t("contract.agree_terms") : t("contract.read_all_hint")}
              </span>
            </label>

            <div>
              <p className="mb-2 text-sm font-semibold text-zinc-800">
                {t("contract.signature_b")}
              </p>
              <SignatureCanvas
                onSignatureChange={setSignatureImage}
                label={t("contract.signature_canvas_label")}
                disabled={!readComplete || !agreed || signMutation.isPending}
              />
            </div>

            <div className="sticky bottom-3 z-10 rounded-xl bg-zinc-50/95 pt-1 backdrop-blur sm:static">
              <button
                type="button"
                onClick={() => signMutation.mutate()}
                disabled={!canSign}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-emerald-50 hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {signMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
                {signMutation.isPending
                  ? t("contract.signing")
                  : t("contract.confirm_btn")}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default ContractSign;

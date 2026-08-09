import { useEffect, useRef } from "react";
import { ExternalLink, ShieldCheck, X } from "lucide-react";

import {
  formatRadarDate,
  formatLicense,
  getDriftMeta,
  getLifecycleMeta,
} from "./skillRadarPresentation";

const Detail = ({ label, children }) => (
  <div className="border-t border-zinc-200 py-3 first:border-t-0 first:pt-0">
    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</dt>
    <dd className="mt-1 text-sm leading-6 text-zinc-800">{children}</dd>
  </div>
);

export default function SkillRadarDetailDrawer({ item, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!item) return undefined;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const panel = panelRef.current;
    document.body.style.overflow = "hidden";
    panel?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
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
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [item, onClose]);

  if (!item) return null;
  const drift = getDriftMeta(item.drift);
  const lifecycle = getLifecycleMeta(item.lifecycle);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="skill-radar-detail-title">
      <button type="button" className="absolute inset-0 bg-zinc-950/45 transition hover:bg-zinc-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white" onClick={onClose} aria-label="Đóng chi tiết Radar công nghệ" />
      <aside ref={panelRef} tabIndex={-1} className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-zinc-50 p-5 shadow-2xl outline-none sm:p-6">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-5">
          <div>
            <p className="text-sm font-semibold text-emerald-800">{item.sourceRepo}</p>
            <h2 id="skill-radar-detail-title" className="mt-1 text-xl font-bold tracking-tight text-zinc-950">{item.name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{item.summary}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label="Đóng"><X className="size-5" aria-hidden="true" /></button>
        </header>

        <div className="mt-5 flex flex-wrap gap-2"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${drift.className}`}>{drift.label}</span><span className={`rounded-md px-2 py-1 text-xs font-semibold ${lifecycle.className}`}>{lifecycle.label}</span><span className="rounded-md bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-800">{item.trustTier}</span></div>

        <dl className="mt-6">
          <Detail label="Ảnh hưởng local"><div className="flex flex-wrap gap-1">{item.localTargets.map((target) => <span key={target} className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium">{target}</span>)}</div></Detail>
          <Detail label="License">{formatLicense(item.license)}{formatLicense(item.license) === "Chưa xác minh" ? " — cần review trước khi adopt" : ""}</Detail>
          <Detail label="Upstream commit">{item.upstreamCommit || "Chưa có"}{item.lastUpstreamCommitAt ? ` · ${formatRadarDate(item.lastUpstreamCommitAt)}` : ""}</Detail>
          <Detail label="Content hash"><code className="break-all text-xs">{item.contentHash || "Chưa có baseline"}</code></Detail>
          <Detail label="Lần kiểm tra">{formatRadarDate(item.lastCheckedAt)}</Detail>
          <Detail label="Lần review">{formatRadarDate(item.lastReviewedAt)}</Detail>
          <Detail label="Quyết định"><span className="font-semibold uppercase">{item.decision}</span>{item.decisionReason ? <p className="mt-1 text-zinc-600">{item.decisionReason}</p> : null}</Detail>
          <Detail label="Báo cáo gần nhất"><code className="break-all text-xs">{item.reportPath || "Chưa có"}</code></Detail>
        </dl>

        <section className="mt-6 border-t border-zinc-200 pt-5" aria-labelledby="audit-heading">
          <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-800" aria-hidden="true" /><h3 id="audit-heading" className="font-bold text-zinc-950">Security audits</h3></div>
          {item.auditSummary.length > 0 ? <ul className="mt-3 divide-y divide-zinc-200">{item.auditSummary.map((audit) => <li key={`${audit.provider}-${audit.auditedAt}`} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-medium text-zinc-800">{audit.provider || "Provider"}</span><span className="text-zinc-600">{audit.status || "unknown"}{audit.riskLevel ? ` · ${audit.riskLevel}` : ""}</span></li>)}</ul> : <p className="mt-3 text-sm text-zinc-600">Snapshot chưa có audit result. Mở skills.sh để xem kết quả mới nhất.</p>}
        </section>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-200 pt-5"><a href={item.skillsShUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">Mở trên skills.sh <ExternalLink className="size-4" aria-hidden="true" /></a><a href={item.repoUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-500 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">Mở GitHub <ExternalLink className="size-4" aria-hidden="true" /></a></div>
      </aside>
    </div>
  );
}

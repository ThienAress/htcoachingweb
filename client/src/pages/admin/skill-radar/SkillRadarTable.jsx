import { ExternalLink, Info } from "lucide-react";

import {
  formatRadarDate,
  formatRadarRunDate,
  getDriftMeta,
  getLifecycleMeta,
} from "./skillRadarPresentation";

const Badge = ({ meta }) => (
  <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${meta.className}`}>
    {meta.label}
  </span>
);

const SourceLinks = ({ item }) => (
  <div className="flex items-center gap-2">
    <a href={item.skillsShUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-emerald-800 underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label={`Mở ${item.name} trên skills.sh`}>
      skills.sh <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
    <a href={item.repoUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-zinc-700 underline-offset-4 transition hover:text-zinc-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label={`Mở repository ${item.sourceRepo}`}>
      GitHub <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  </div>
);

export default function SkillRadarTable({ items, nextRunAt, onSelect }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white" aria-labelledby="radar-table-heading">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 id="radar-table-heading" className="font-bold text-zinc-950">Nguồn đang theo dõi</h2>
        <p className="mt-1 text-sm text-zinc-600">Mở chi tiết để xem hash, license, audit và quyết định gần nhất.</p>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Skill / repository</th>
              <th className="px-4 py-3 font-semibold">Lĩnh vực</th>
              <th className="px-4 py-3 font-semibold">Ảnh hưởng local</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 font-semibold">Cập nhật / review</th>
              <th className="px-4 py-3 font-semibold">Lần quét dự kiến</th>
              <th className="px-4 py-3 font-semibold">Nguồn</th>
              <th className="px-4 py-3"><span className="sr-only">Chi tiết</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {items.map((item) => (
              <tr key={item.id} className="align-top transition-colors hover:bg-zinc-50">
                <td className="px-4 py-4"><strong className="block text-zinc-950">{item.name}</strong><span className="mt-1 block text-xs text-zinc-500">{item.sourceRepo}</span></td>
                <td className="max-w-64 px-4 py-4"><span className="font-semibold text-zinc-800">{item.domain}</span><p className="mt-1 text-xs leading-5 text-zinc-600">{item.summary}</p></td>
                <td className="px-4 py-4"><div className="flex max-w-56 flex-wrap gap-1">{item.localTargets.map((target) => <span key={target} className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">{target}</span>)}</div></td>
                <td className="px-4 py-4"><div className="flex flex-col items-start gap-2"><Badge meta={getDriftMeta(item.drift)} /><Badge meta={getLifecycleMeta(item.lifecycle)} /><span className="text-xs font-medium text-zinc-500">{item.trustTier === "official" ? "Nguồn official" : "Nguồn chuyên gia"}{item.auditSummary.length > 0 ? ` · ${item.auditSummary.length} audit` : " · xem audit trên skills.sh"}</span></div></td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-zinc-600"><span className="block">Upstream: {formatRadarDate(item.lastUpstreamCommitAt)}</span><span className="mt-2 block">Review: {formatRadarDate(item.lastReviewedAt)}</span></td>
                <td className="whitespace-nowrap px-4 py-4 font-semibold text-zinc-800">{formatRadarRunDate(item.nextCheckAt || nextRunAt)}</td>
                <td className="px-4 py-4"><SourceLinks item={item} /></td>
                <td className="px-4 py-4"><button type="button" onClick={() => onSelect(item)} className="inline-flex size-11 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label={`Xem chi tiết ${item.name}`}><Info className="size-5" aria-hidden="true" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-zinc-200 md:hidden">
        {items.map((item) => (
          <li key={item.id} className="p-4">
            <div className="flex items-start justify-between gap-3"><div><strong className="text-zinc-950">{item.name}</strong><p className="mt-1 text-xs text-zinc-500">{item.sourceRepo}</p></div><button type="button" onClick={() => onSelect(item)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label={`Xem chi tiết ${item.name}`}><Info className="size-5" aria-hidden="true" /></button></div>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{item.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2"><Badge meta={getDriftMeta(item.drift)} /><Badge meta={getLifecycleMeta(item.lifecycle)} /></div>
            <p className="mt-3 text-sm font-semibold text-zinc-800">Lần quét dự kiến: {formatRadarRunDate(item.nextCheckAt || nextRunAt)}</p>
            <SourceLinks item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

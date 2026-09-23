import { ExternalLink } from "lucide-react";

export default function CitationChip({ source }) {
  return (
    <a
      aria-label={`Mở nguồn: ${source.title}`}
      className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 align-baseline text-xs font-medium no-underline transition-[border-color,color,background-color] hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:hover:border-emerald-300 dark:hover:bg-emerald-400/10"
      href={source.uri}
      rel="noopener noreferrer"
      target="_blank"
      title={source.title}
    >
      <span aria-hidden="true" className="grid h-4 min-w-4 place-items-center rounded bg-cyan-100 px-0.5 text-[10px] text-cyan-800 dark:bg-cyan-300/20 dark:text-cyan-100">{source.monogram}</span>
      <span className="max-w-40 truncate">{source.title}</span>
      <ExternalLink aria-hidden="true" size={11} strokeWidth={2} />
    </a>
  );
}

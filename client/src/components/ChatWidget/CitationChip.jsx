import { ExternalLink } from "lucide-react";
import SourceAvatar from "./SourceAvatar";

export default function CitationChip({ source }) {
  return (
    <a
      aria-label={`Mở nguồn ${source.title} từ ${source.publisher} trong thẻ mới`}
      className="mx-0.5 inline-flex min-h-7 max-w-full items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 align-baseline text-xs font-medium no-underline transition-[border-color,color,background-color] hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 max-sm:min-h-11 max-sm:min-w-11 max-sm:px-2 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:hover:border-emerald-300 dark:hover:bg-emerald-400/10"
      href={source.uri}
      rel="noopener noreferrer"
      target="_blank"
      title={source.title}
    >
      <SourceAvatar source={source} />
      <span className="max-w-28 truncate">{source.publisher}</span>
      <ExternalLink aria-hidden="true" size={11} strokeWidth={2} />
    </a>
  );
}

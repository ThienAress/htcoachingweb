import { ExternalLink } from "lucide-react";
import { getSafeCitationSources } from "../citation";
import SourceAvatar from "../SourceAvatar";

const MAX_SOURCES = 3;

const getSafeSources = (sources) => getSafeCitationSources(sources, MAX_SOURCES);

const formatSearchedAt = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tra cứu gần đây";

  const formatOptions = { timeZone: "Asia/Ho_Chi_Minh" };
  const time = new Intl.DateTimeFormat("vi-VN", {
    ...formatOptions,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const day = new Intl.DateTimeFormat("vi-VN", {
    ...formatOptions,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  return `Tra cứu lúc ${time} · ${day}`;
};

export default function WebSourcesCard({ data }) {
  const sources = getSafeSources(data?.sources);
  if (sources.length === 0) return null;

  return (
    <details className="w-full border-t border-slate-200 pt-2 text-slate-800 dark:border-white/10 dark:text-zinc-200">
      <summary className="flex min-h-11 min-w-0 cursor-pointer list-none items-center gap-2 px-1 py-1 text-sm font-medium marker:content-none focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-inset">
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-cyan-100 text-xs text-cyan-800 dark:bg-cyan-300/15 dark:text-cyan-100">{sources.length}</span>
        <span className="min-w-0 flex-1 truncate">Nguồn tham khảo</span>
        <span className="ml-auto hidden shrink-0 text-right text-xs font-normal text-slate-500 dark:text-zinc-400 sm:inline">{formatSearchedAt(data?.searchedAt)}</span>
      </summary>
      <ul className="mt-1 border-t border-slate-200 py-2 dark:border-white/10">
          {sources.map((source) => (
              <li
              className="py-2 first:pt-0 last:pb-0"
              key={source.uri}
            >
              <a
                className="group flex min-h-14 items-center gap-3 focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                href={source.uri}
                rel="noopener noreferrer"
                target="_blank"
              >
                <SourceAvatar source={source} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5 text-slate-900 transition-colors duration-200 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-300 motion-reduce:transition-none">
                    {source.publisher}
                  </p>
                  <p className="truncate text-xs leading-5 text-slate-500 dark:text-zinc-400" title={source.title}>
                    {source.title}
                  </p>
                </div>
                <ExternalLink
                  aria-hidden="true"
                  className="shrink-0 text-slate-400 transition-colors duration-200 group-hover:text-emerald-600 dark:text-zinc-500 dark:group-hover:text-emerald-300 motion-reduce:transition-none"
                  size={17}
                  strokeWidth={1.8}
                />
                <span className="sr-only">Mở nguồn trong thẻ mới</span>
              </a>
            </li>
          ))}
      </ul>
    </details>
  );
}

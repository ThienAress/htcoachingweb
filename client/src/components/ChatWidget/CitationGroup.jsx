import { useId, useState } from "react";
import { ExternalLink } from "lucide-react";
import SourceAvatar from "./SourceAvatar";

export default function CitationGroup({ sources }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [first, ...rest] = sources;
  return (
    <span
      className="relative mx-0.5 inline-block align-baseline"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-controls={listId}
        aria-expanded={open}
        aria-label={`Xem ${sources.length} nguồn`}
        className="inline-flex min-h-7 items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-xs font-medium transition-[border-color,background-color] hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 max-sm:min-h-11 max-sm:min-w-11 max-sm:px-2 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:hover:border-emerald-300 dark:hover:bg-emerald-400/10"
        onBlur={(event) => {
          if (!event.currentTarget.parentElement.contains(event.relatedTarget)) setOpen(false);
        }}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
      >
        <SourceAvatar source={first} />
        <span className="max-w-28 truncate">{first.publisher}</span>
        <span className="text-gray-500 dark:text-gray-400">+{rest.length}</span>
      </button>
      {open ? (
        <ul
          id={listId}
          className="absolute left-0 top-full z-20 mt-1 w-72 max-w-[85vw] space-y-1 rounded-xl border border-gray-200 bg-white p-2 text-left shadow-lg dark:border-white/10 dark:bg-gray-900"
        >
          {sources.map((source) => (
            <li key={source.uri}>
              <a
                className="flex items-start gap-2 rounded-lg p-1.5 text-xs no-underline hover:bg-emerald-50 dark:hover:bg-emerald-400/10"
                href={source.uri}
                rel="noopener noreferrer"
                target="_blank"
              >
                <SourceAvatar source={source} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900 dark:text-white">{source.publisher}</span>
                  <span className="block line-clamp-2 text-gray-600 dark:text-gray-300">{source.title}</span>
                </span>
                <ExternalLink aria-hidden="true" className="mt-0.5 shrink-0" size={11} strokeWidth={2} />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  );
}

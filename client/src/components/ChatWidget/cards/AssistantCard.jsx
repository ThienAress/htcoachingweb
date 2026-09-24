import { useId } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const ICON_TONES = {
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  cyan: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300",
  amber:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
};

const NOTICE_TONES = {
  cyan: "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-100",
  amber:
    "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
};

export const cardLinkClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 transition-[border-color,color,background-color] duration-200 hover:border-emerald-500 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-400 dark:hover:text-emerald-300 dark:focus-visible:ring-offset-zinc-900 motion-reduce:transition-none";

const primaryActionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-3 py-2 text-[13px] font-medium text-white transition-[background-color,border-color] duration-200 hover:border-emerald-800 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-300 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:border-emerald-200 dark:hover:bg-emerald-200 dark:focus-visible:ring-offset-zinc-900 motion-reduce:transition-none";

export default function AssistantCard({
  icon: Icon,
  iconTone = "emerald",
  eyebrow,
  title,
  subtitle,
  value,
  valueNote,
  children,
  footer,
}) {
  const titleId = useId();

  return (
    <article
      aria-labelledby={titleId}
      className="product-surface w-full overflow-hidden break-words rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_12px_34px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-black/20"
    >
      <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              ICON_TONES[iconTone] || ICON_TONES.emerald
            }`}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium tracking-wide text-emerald-700 dark:text-emerald-300">
              {eyebrow}
            </p>
            <h3
              id={titleId}
              className="text-balance font-sans text-lg font-medium normal-case leading-tight text-slate-900 dark:text-zinc-50"
            >
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 text-pretty text-[13px] leading-5 text-slate-600 dark:text-zinc-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {value != null && value !== "" && (
          <div className="shrink-0 text-left text-[13px] font-medium text-cyan-700 dark:text-cyan-300 sm:text-right">
            {value}
            {valueNote && (
              <small className="mt-1 block text-xs font-normal text-slate-500 dark:text-zinc-400">
                {valueNote}
              </small>
            )}
          </div>
        )}
      </header>

      <div className="px-4">{children}</div>
      {footer}
    </article>
  );
}

export function CardSection({ children, className = "" }) {
  return (
    <section
      className={`py-4 [&+section]:border-t [&+section]:border-slate-200 [&+section]:dark:border-white/10 ${className}`}
    >
      {children}
    </section>
  );
}

export function CardSectionLabel({ children }) {
  return (
    <p className="mb-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
      {children}
    </p>
  );
}

export function CardNotice({ icon: Icon, tone = "cyan", children, ...props }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl px-3 py-3 text-[13px] leading-5 ${
        NOTICE_TONES[tone] || NOTICE_TONES.cyan
      }`}
      {...props}
    >
      {Icon && (
        <Icon
          aria-hidden="true"
          className="mt-0.5 shrink-0"
          size={16}
          strokeWidth={1.8}
        />
      )}
      <div className="min-w-0 text-pretty">{children}</div>
    </div>
  );
}

export function CardFooter({
  note,
  action,
  to,
  href,
  icon: Icon = ArrowUpRight,
  onClick,
  disabled = false,
  primary = false,
}) {
  const actionContent = action ? (
    <>
      <Icon aria-hidden="true" size={15} strokeWidth={1.8} />
      {action}
    </>
  ) : null;

  let actionElement = null;
  if (action && to) {
    actionElement = (
      <Link className={cardLinkClass} to={to}>
        {actionContent}
      </Link>
    );
  } else if (action && href) {
    actionElement = (
      <a
        className={cardLinkClass}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {actionContent}
      </a>
    );
  } else if (action && onClick) {
    actionElement = (
      <button
        className={primary ? primaryActionClass : `${cardLinkClass} disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {actionContent}
      </button>
    );
  }

  return (
    <footer className="flex flex-col items-start gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-zinc-950/40 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
        {note}
      </span>
      {actionElement}
    </footer>
  );
}

export function CardList({ children }) {
  return (
    <ul className="divide-y divide-slate-200 dark:divide-white/10">{children}</ul>
  );
}

export function IndexBadge({ children, tone = "emerald" }) {
  const toneClass =
    tone === "cyan"
      ? ICON_TONES.cyan
      : tone === "amber"
        ? ICON_TONES.amber
        : ICON_TONES.emerald;

  return (
    <span
      className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-lg px-1.5 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}

export function Tag({ children, accent = false }) {
  return (
    <span
      className={`max-w-full break-words rounded-lg px-2 py-1 text-xs ${
        accent
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
          : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-300"
      }`}
    >
      {children}
    </span>
  );
}

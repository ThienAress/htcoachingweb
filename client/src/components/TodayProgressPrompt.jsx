import { ArrowRight, CalendarCheck2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export const TodayProgressPrompt = ({ onDismiss, onOpen }) => {
  const { t } = useTranslation("home");

  return (
    <aside
      aria-labelledby="today-progress-prompt-title"
      className="fixed left-4 right-4 top-[89px] z-40 overflow-hidden rounded-2xl border border-primary/30 bg-[#171717]/95 text-white shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-md sm:left-auto sm:right-5 sm:w-[360px] 2xl:top-24"
      data-testid="today-progress-prompt"
    >
      <div className="flex items-start gap-3 p-4 pr-12 sm:p-5 sm:pr-12">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <CalendarCheck2 aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            {t("progress_entry.eyebrow")}
          </p>
          <h2
            className="text-base font-bold leading-snug text-white"
            id="today-progress-prompt-title"
          >
            {t("progress_entry.title")}
          </h2>
          <p className="mt-1 text-sm leading-5 text-gray-300">
            {t("progress_entry.description")}
          </p>
        </div>
      </div>

      <button
        aria-label={t("progress_entry.dismiss")}
        className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={onDismiss}
        type="button"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>

      <button
        className="group flex min-h-12 w-full items-center justify-between border-t border-white/10 bg-primary px-5 py-3 text-left text-sm font-bold text-[#1a0800] transition-colors hover:bg-[#ff713d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        onClick={onOpen}
        type="button"
      >
        <span>{t("progress_entry.cta")}</span>
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
        />
      </button>
    </aside>
  );
};

import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import UpdatingText from "../UpdatingText";

const StoryImage = ({ src, alt, label, side }) => (
  <div
    className={
      side === "after"
        ? "absolute inset-y-0 right-0 w-[58%] overflow-hidden [clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)]"
        : "absolute inset-y-0 left-0 w-[58%] overflow-hidden"
    }
  >
    {src ? (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    ) : (
      <div className="flex h-full min-h-48 items-center justify-center bg-zinc-900">
        <UpdatingText className="text-xs text-zinc-500" />
      </div>
    )}
    <span
      className={`absolute bottom-3 rounded-full px-3 py-1 text-[0.65rem] font-black uppercase tracking-widest ${
        side === "after"
          ? "right-3 bg-emerald-500 text-emerald-950"
          : "left-3 bg-zinc-950/85 text-zinc-100"
      }`}
    >
      {label}
    </span>
  </div>
);

const CustomerStoryCard = ({ story }) => {
  const { t } = useTranslation("trainer");
  const beforeSrc = Array.isArray(story.beforeImg) ? story.beforeImg[0] : story.beforeImg;
  const afterSrc = Array.isArray(story.afterImg) ? story.afterImg[0] : story.afterImg;

  return (
    <article
      data-customer-story-card
      className="w-[88vw] max-w-[54rem] shrink-0 snap-center overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-zinc-950/40 sm:w-[42rem] lg:w-[54rem]"
    >
      <Link
        to={`/ket-qua-khach-hang/${story.slug}/`}
        aria-label={`${t("actions.view_journey")}: ${story.name}`}
        className="group/story grid min-h-full transition-colors duration-200 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:grid-cols-[minmax(0,3fr)_minmax(15rem,2fr)]"
      >
        <div className="relative min-h-64 overflow-hidden bg-zinc-900 md:min-h-[24rem]">
          <StoryImage
            src={beforeSrc}
            alt={`${story.name} - ${t("customer_card.before")}`}
            label={t("customer_card.before")}
            side="before"
          />
          <StoryImage
            src={afterSrc}
            alt={`${story.name} - ${t("customer_card.after")}`}
            label={t("customer_card.after")}
            side="after"
          />
          <div
            data-story-divider
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-emerald-300/70 [clip-path:polygon(52.34%_0,52.54%_0,42.1%_100%,41.9%_100%)]"
          />
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-8">
          {story.duration && (
            <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-primary">
              {t("customer_card.duration_label")} {story.duration}
            </p>
          )}
          <h3 className="flex flex-wrap items-center gap-x-2 text-balance text-2xl font-black uppercase text-zinc-50 sm:text-3xl">
            <span className="leading-none">{story.name}</span>
            {story.age && (
              <span className="whitespace-nowrap text-base font-bold leading-none normal-case tracking-normal text-zinc-400 sm:text-lg">
                — {story.age} {t("customer_card.age_suffix")}
              </span>
            )}
          </h3>
          <span className="mt-7 inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-primary">
            {t("actions.view_journey")}
            <ArrowRight
              aria-hidden="true"
              size={17}
            />
          </span>
        </div>
      </Link>
    </article>
  );
};

export default CustomerStoryCard;

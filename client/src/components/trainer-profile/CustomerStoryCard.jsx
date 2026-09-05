import { ArrowRight, Flame } from "lucide-react";
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
    <article className="w-full max-w-[54rem] overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-zinc-950/40 lg:w-[54rem] lg:shrink-0 lg:snap-center">
      <Link
        to={`/ket-qua-khach-hang/${story.slug}/`}
        aria-label={`${t("actions.detail_view")}: ${story.name}`}
        className="group/story grid min-h-full transition-colors duration-200 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300 md:grid-cols-[minmax(0,3fr)_minmax(15rem,2fr)]"
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
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -skew-x-12 bg-emerald-300/70" />
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-8">
          {story.duration && (
            <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              {t("customer_card.duration_label")}: {story.duration}
            </p>
          )}
          <h3 className="text-balance text-2xl font-black uppercase text-zinc-50 sm:text-3xl">
            {story.name}
          </h3>
          {story.age && (
            <p className="mt-2 text-sm font-semibold text-zinc-400">
              {story.age} {t("customer_card.age_suffix")}
            </p>
          )}
          {story.result && (
            <p className="mt-5 flex items-start gap-2 text-pretty leading-relaxed text-zinc-300">
              <Flame aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-400" size={18} />
              <span>{story.result}</span>
            </p>
          )}
          <span className="mt-7 inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-emerald-300">
            {t("actions.detail_view")}
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

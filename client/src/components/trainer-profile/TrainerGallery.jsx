import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const TrainerGallery = ({ images, name }) => {
  const { t } = useTranslation("stories");
  const [activeIndex, setActiveIndex] = useState(0);
  const availableImages = images?.filter(Boolean) || [];
  const safeActiveIndex = Math.min(activeIndex, Math.max(availableImages.length - 1, 0));

  if (availableImages.length === 0) return null;

  const showPrevious = () => {
    setActiveIndex((current) => (
      current - 1 + availableImages.length
    ) % availableImages.length);
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % availableImages.length);
  };

  return (
    <div className="flex h-full flex-col bg-orange-950/30">
      <div className="group relative min-h-[26rem] flex-1 overflow-hidden sm:min-h-[34rem] lg:min-h-[42rem]">
        {availableImages.map((image, index) => (
          <img
            key={`${image}-${index}`}
            src={image}
            alt={`${name} - ${index + 1}`}
            loading={index === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${
              index === safeActiveIndex ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        ))}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-zinc-950 to-transparent" />
        <p className="absolute inset-x-6 bottom-6 text-balance text-2xl font-black uppercase tracking-tight text-zinc-50 sm:inset-x-8 sm:text-3xl">
          {name}
        </p>

        {availableImages.length > 1 && (
          <div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-between sm:inset-x-6">
            <button
              type="button"
              onClick={showPrevious}
              aria-label={`${t("detail.aria_prev_image")}: ${name}`}
              className="inline-flex size-12 items-center justify-center rounded-full border border-zinc-50/20 bg-zinc-950/80 text-zinc-50 transition-[background-color,border-color,color] duration-200 hover:border-primary hover:bg-primary hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <ChevronLeft aria-hidden="true" size={20} />
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label={`${t("detail.aria_next_image")}: ${name}`}
              className="inline-flex size-12 items-center justify-center rounded-full border border-zinc-50/20 bg-zinc-950/80 text-zinc-50 transition-[background-color,border-color,color] duration-200 hover:border-primary hover:bg-primary hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <ChevronRight aria-hidden="true" size={20} />
            </button>
          </div>
        )}
      </div>

      {availableImages.length > 1 && (
        <div className="grid grid-cols-3 gap-2 border-t border-primary/10 bg-zinc-950 p-3">
          {availableImages.map((image, index) => (
            <button
              type="button"
              key={`thumbnail-${image}-${index}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`${name}: ${index + 1}`}
              aria-pressed={index === safeActiveIndex}
              className={`relative aspect-[4/3] overflow-hidden rounded-lg border transition-[border-color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                index === safeActiveIndex
                  ? "border-primary opacity-100"
                  : "border-zinc-700 opacity-60 hover:border-primary/60 hover:opacity-100"
              }`}
            >
              <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrainerGallery;

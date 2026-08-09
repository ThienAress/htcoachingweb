import React, { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Calculator, Utensils, CalendarDays, ArrowRight, Dumbbell, ScanLine } from "lucide-react";
import {
  HOME_TOOL_CATALOG,
  buildCatalogMediaItems,
} from "../config/homeSectionCatalog";

gsap.registerPlugin(ScrollTrigger);

const TOOL_ICONS = {
  calculator: Calculator,
  dumbbell: Dumbbell,
  utensils: Utensils,
  calendar: CalendarDays,
  scan: ScanLine,
};
const SIDE_TOOL_KEYS = HOME_TOOL_CATALOG
  .filter((item) => !item.featured)
  .map((item) => item.key);

const Tools = ({ imagesByKey, legacyImage }) => {
  const { t } = useTranslation("home");
  const sectionRef = useRef(null);
  const tdeeRef = useRef(null);
  const sideCardsRef = useRef(null);
  const itemRefs = useRef(new Map());
  const tools = useMemo(
    () => buildCatalogMediaItems(HOME_TOOL_CATALOG, {
      imagesByKey,
      legacyImage,
    }),
    [imagesByKey, legacyImage],
  );
  const featuredTool = tools.find((item) => item.featured);
  const sideTools = tools.filter((item) => !item.featured);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ctx = gsap.context(() => {
      const isDesktop = window.innerWidth >= 768;
      const sideElements = SIDE_TOOL_KEYS
        .map((itemKey) => itemRefs.current.get(itemKey))
        .filter(Boolean);

      if (isDesktop) {
        // Trạng thái ban đầu: Thẻ TDEE full width, giấu thẻ phụ
        gsap.set(tdeeRef.current, { width: "100%" });
        gsap.set(sideCardsRef.current, { display: "none", width: "0%", opacity: 0 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 40%", // Bắt đầu khi section lên gần giữa màn hình
            once: true,
          }
        });

        // Bung thẻ TDEE nhỏ lại 50% và hiện grid phụ
        tl.to(tdeeRef.current, { width: "calc(50% - 12px)", duration: 1.2, ease: "power3.inOut" }, 0)
          .set(sideCardsRef.current, { display: "grid" }, 0)
          .to(sideCardsRef.current, { width: "calc(50% - 12px)", opacity: 1, duration: 1.2, ease: "power3.inOut" }, 0)
          .fromTo(
            sideElements,
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, stagger: 0.2, ease: "power3.out" },
            0.4,
          );
      } else {
        // Mobile Animation
        gsap.set(sideCardsRef.current, { display: "grid", width: "100%", opacity: 1 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 50%",
            once: true,
          }
        });

        tl.fromTo(tdeeRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" })
          .fromTo(
            sideElements,
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: "power3.out" },
            "-=0.4",
          );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="tools" className="py-12 md:py-24 px-4 md:px-5 flex justify-center bg-gray-50/50">
      <div className="container max-w-[1200px]">

        {/* Title */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-primary uppercase font-bold text-3xl md:text-4xl mb-4">{t("tools.title")}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm md:text-base">{t("tools.subtitle")}</p>
        </div>

        {/* Bento Grid */}
        <div className="flex flex-col md:flex-row gap-5 md:gap-6 h-auto md:min-h-[550px] w-full">

          {/* TDEE Card (Thẻ bự) */}
          <div ref={tdeeRef} className="relative rounded-3xl overflow-hidden w-full h-[400px] md:h-auto group shadow-xl">
            <img src={featuredTool.image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={t(featuredTool.titleKey)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-colors duration-300" />

            <div className="absolute inset-0 p-8 md:p-12 flex flex-col justify-end">
              <div className="bg-primary/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-primary/30">
                <Calculator className="text-primary w-7 h-7" />
              </div>
              <h3 className="text-white text-2xl md:text-3xl font-bold mb-3 uppercase tracking-wide">
                {t(featuredTool.titleKey)}
              </h3>
              <p className="text-gray-300 mb-8 max-w-lg leading-relaxed text-sm md:text-base">
                {t(featuredTool.descriptionKey)}
              </p>
              <div>
                <Link
                  to={featuredTool.route}
                  className="inline-flex items-center gap-2 bg-primary text-white font-semibold hover:bg-[#d67b0b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 px-8 py-3.5 rounded-full transition-all duration-300 transform group-hover:translate-x-2 shadow-[0_0_15px_rgba(255,90,31,0.4)]"
                >
                  {t(featuredTool.ctaKey)} <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Side Cards Container (Thẻ nhỏ hiện ra) */}
          <div ref={sideCardsRef} className="grid grid-cols-2 auto-rows-[220px] md:auto-rows-[minmax(160px,1fr)] gap-5 md:gap-6 w-full md:w-1/2 h-auto opacity-100">
            {sideTools.map((item) => {
              const Icon = TOOL_ICONS[item.icon] || Dumbbell;
              return (
                <article
                  key={item.key}
                  ref={(node) => {
                    if (node) itemRefs.current.set(item.key, node);
                    else itemRefs.current.delete(item.key);
                  }}
                  className={`relative rounded-3xl overflow-hidden group shadow-xl h-[220px] md:h-auto ${item.cardClassName || "col-span-2"}`}
                >
                  <img
                    src={item.image}
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${item.imageClassName || ""}`}
                    alt={t(item.titleKey)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-colors duration-300" />

                  <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
                    <div className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/20">
                      <Icon className="text-white w-6 h-6" />
                    </div>
                    <h3 className="text-white text-xl font-bold mb-2 uppercase">{t(item.titleKey)}</h3>
                    <p className="text-gray-300 text-sm mb-5 line-clamp-2">{t(item.descriptionKey)}</p>
                    <div>
                      <Link
                        to={item.route}
                        className="inline-flex items-center gap-2 text-white font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 transition-colors text-sm"
                      >
                        {t(item.ctaKey)} <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Tools;

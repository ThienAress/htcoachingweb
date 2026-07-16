import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { Flame, Zap, Target, Dumbbell } from "lucide-react";
import hero1 from "../assets/images/hero/hero1.jpg";
import hero2 from "../assets/images/hero/hero2.jpg";
import hero3 from "../assets/images/hero/hero3.jpg";

gsap.registerPlugin(ScrollTrigger);

const About = ({ images }) => {
  const { t } = useTranslation("home");
  const defaultImages = [hero1, hero2, hero3];
  const displayImages = images && images.length > 0 ? images : defaultImages;
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const slidesRef = useRef([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // GSAP Animations cho Text và Số (Chạy 1 lần khi scroll tới)
  useEffect(() => {
    let mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      // Left side: stagger reveal from left
      if (leftRef.current) {
        const elements = leftRef.current.querySelectorAll("[data-gsap-reveal]");
        gsap.from(elements, {
          x: -30,
          opacity: 0,
          duration: 0.7,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: {
            trigger: leftRef.current,
            start: "top 80%",
            once: true,
          },
        });
      }

      // Right side: slide from right
      if (rightRef.current) {
        gsap.from(rightRef.current, {
          x: 50,
          opacity: 0,
          duration: 0.9,
          ease: "power2.out",
          scrollTrigger: {
            trigger: rightRef.current,
            start: "top 80%",
            once: true,
          },
        });
      }
    });

    return () => mm.revert();
  }, []);

  // GSAP Slider Animation cho Hình Ảnh
  useEffect(() => {
    slidesRef.current.forEach((slide, idx) => {
      if (!slide) return;
      if (idx === currentIndex) {
        gsap.fromTo(slide,
          { opacity: 0, scale: 1.05 },
          { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out", zIndex: 10 }
        );
      } else {
        gsap.to(slide, {
          opacity: 0, 
          duration: 0.8, 
          ease: "power2.out",
          zIndex: 0
        });
      }
    });
  }, [currentIndex]);

  // Autoplay cho Slider
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [displayImages.length]);

  return (
    <section id="about" className="py-(--spacing-fluid-section) bg-light">
      <div className="container-custom flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
        {/* LEFT */}
        <div ref={leftRef} className="w-full md:w-1/2 lg:flex-1 min-w-0">
          <h2 data-gsap-reveal>{t("about.title")}</h2>

          <p
            className="italic text-primary font-semibold text-fluid-lg mt-4"
            data-gsap-reveal
          >
            {t("about.quote")}
          </p>

          <p className="desc text-fluid-sm" data-gsap-reveal
            dangerouslySetInnerHTML={{ __html: t("about.bio") }}
          />

          <div className="mt-6 sm:mt-8">
            <h3 data-gsap-reveal>{t("about.training_style")}</h3>

            <ul className="mt-3 sm:mt-4 space-y-3" data-gsap-reveal>
              <li className="flex items-center gap-3 font-semibold text-fluid-sm">
                <Flame className="text-primary shrink-0" size={18} />
                {t("about.style_items.0")}
              </li>
              <li className="flex items-center gap-3 font-semibold text-fluid-sm">
                <Zap className="text-primary shrink-0" size={18} />
                {t("about.style_items.1")}
              </li>
              <li className="flex items-center gap-3 font-semibold text-fluid-sm">
                <Target className="text-primary shrink-0" size={18} />
                {t("about.style_items.2")}
              </li>
              <li className="flex items-center gap-3 font-semibold text-fluid-sm">
                <Dumbbell className="text-primary shrink-0" size={18} />
                {t("about.style_items.3")}
              </li>
            </ul>
          </div>
        </div>

        {/* RIGHT (GSAP Slider thay thế Swiper) */}
        <div ref={rightRef} className="w-full lg:w-1/2 lg:flex-1 overflow-hidden rounded-xl shadow-lg aspect-video relative group">
          <div className="w-full h-full relative">
            {displayImages.map((img, index) => (
              <div 
                key={index} 
                ref={(el) => (slidesRef.current[index] = el)}
                className="absolute inset-0 w-full h-full opacity-0 will-change-transform"
              >
                <img
                  src={img}
                  alt={`HTCOACHING không gian tập luyện ${index + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Custom Pagination Dots (Giữ lại Dấu chấm theo ý User) */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
            {displayImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? "bg-primary w-6" : "bg-white/60 hover:bg-white/90 w-2.5"
                }`}
                aria-label={`Chuyển đến ảnh ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;


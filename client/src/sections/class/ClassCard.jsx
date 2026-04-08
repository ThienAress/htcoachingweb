import React from "react";
import { CheckCircle, ArrowRight } from "lucide-react";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const BASE_SHADOW = "0 18px 45px rgba(2, 6, 23, 0.32)";
const HOVER_SHADOW = "0 42px 110px rgba(2, 6, 23, 0.58)";

const ClassCard = ({ image, title, desc, benefits }) => {
  const wrapperRef = React.useRef(null);
  const cardRef = React.useRef(null);
  const glareRef = React.useRef(null);
  const rafRef = React.useRef(null);

  const shouldDisableMotion = () => {
    if (typeof window === "undefined") return true;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    return isTouch || reduceMotion;
  };

  const updateLayers = (rotateX, rotateY) => {
    if (!cardRef.current) return;
    const layers = cardRef.current.querySelectorAll("[data-depth]");
    layers.forEach((layer) => {
      const depth = Number(layer.dataset.depth || 0);
      const moveX = rotateY * (depth / 55);
      const moveY = -rotateX * (depth / 55);
      layer.style.transform = `translate3d(${moveX}px, ${moveY}px, ${depth}px)`;
    });
  };

  const resetCard = () => {
    if (!cardRef.current || !glareRef.current) return;
    cardRef.current.style.transition =
      "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 450ms ease";
    cardRef.current.style.transform =
      "translateY(0px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    cardRef.current.style.boxShadow = BASE_SHADOW;
    const layers = cardRef.current.querySelectorAll("[data-depth]");
    layers.forEach((layer) => {
      const depth = Number(layer.dataset.depth || 0);
      layer.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
      layer.style.transform = `translate3d(0px, 0px, ${depth}px)`;
    });
    glareRef.current.style.opacity = "0";
    glareRef.current.style.background =
      "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.16), transparent 42%)";
  };

  const handleMouseEnter = () => {
    if (shouldDisableMotion()) return;
    if (!cardRef.current) return;
    cardRef.current.style.transition =
      "transform 90ms ease-out, box-shadow 220ms ease-out";
    cardRef.current.style.boxShadow = HOVER_SHADOW;
    const layers = cardRef.current.querySelectorAll("[data-depth]");
    layers.forEach((layer) => {
      layer.style.transition = "transform 90ms ease-out";
    });
  };

  const handleMouseMove = (e) => {
    if (shouldDisableMotion()) return;
    if (!wrapperRef.current || !cardRef.current || !glareRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = x / rect.width;
    const py = y / rect.height;
    const rotateY = clamp((px - 0.5) * 20, -10, 10);
    const rotateX = clamp((0.5 - py) * 20, -10, 10);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      cardRef.current.style.transition = "transform 25ms linear";
      cardRef.current.style.transform = `
        translateY(-3px)
        rotateX(${rotateX}deg)
        rotateY(${rotateY}deg)
        scale3d(1.065, 1.065, 1.065)
      `;
      updateLayers(rotateX, rotateY);
      glareRef.current.style.opacity = "1";
      glareRef.current.style.background = `
        radial-gradient(
          circle at ${px * 100}% ${py * 100}%,
          rgba(255,255,255,0.22),
          rgba(96,165,250,0.10) 18%,
          rgba(168,85,247,0.08) 28%,
          transparent 46%
        )
      `;
    });
  };

  const handleMouseLeave = () => {
    cancelAnimationFrame(rafRef.current);
    resetCard();
  };

  React.useEffect(() => {
    if (cardRef.current) {
      cardRef.current.style.boxShadow = BASE_SHADOW;
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="w-full"
      style={{ perspective: "1400px" }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        className="group relative aspect-[0.88/1] overflow-hidden rounded-[30px] border border-white/10 bg-[#0a1023] will-change-transform"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          ref={glareRef}
          className="pointer-events-none absolute inset-0 z-30 opacity-0 transition-opacity duration-300"
        />

        <div
          data-depth="8"
          className="pointer-events-none absolute -top-12 -right-10 z-10 h-32 w-32 rounded-full bg-cyan-400/12 blur-3xl"
        />
        <div
          data-depth="8"
          className="pointer-events-none absolute -bottom-10 -left-10 z-10 h-32 w-32 rounded-full bg-violet-500/15 blur-3xl"
        />

        <div
          className="relative z-20 flex h-full flex-col"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Ảnh phía trên - responsive height */}
          <div
            data-depth="22"
            className="relative h-[40%] sm:h-[44%] md:h-[46%] overflow-hidden rounded-t-[30px]"
          >
            <img
              src={image}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a1023]/20 via-transparent to-transparent" />
          </div>

          {/* Nội dung phía dưới - responsive padding và text size */}
          <div className="flex h-[60%] sm:h-[56%] md:h-[54%] flex-col bg-[#0a1023] px-4 pt-3 pb-4 sm:px-5 sm:pt-4 sm:pb-5">
            <h3
              data-depth="60"
              className="mb-1 sm:mb-2 text-[1.6rem] sm:text-[1.8rem] md:text-[2rem] leading-none text-light"
            >
              {title}
            </h3>

            <p
              data-depth="30"
              className="mb-2 sm:mb-3 text-[12px] sm:text-[13px] md:text-[14px] leading-6 sm:leading-7 text-slate-400"
            >
              {desc}
            </p>

            <ul
              data-depth="20"
              className="mb-3 sm:mb-4 space-y-1.5 sm:space-y-2.5"
            >
              {benefits.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 sm:gap-2 text-[12px] sm:text-[13px] md:text-[14px] leading-5 sm:leading-6 text-light"
                >
                  <CheckCircle className="mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div data-depth="68" className="mt-auto">
              <a
                href="#contact"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-transparent px-3 py-2.5 sm:px-4 sm:py-3 text-[13px] sm:text-[14px] md:text-[15px] font-semibold text-primary transition-all duration-300 hover:bg-primary hover:text-[#0a1023]"
              >
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                NHẬN TƯ VẤN MIỄN PHÍ
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassCard;

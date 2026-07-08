import { useEffect, useRef } from "react";
import gsap from "gsap";
import SplitType from "split-type";
import logoSrc from "../assets/images/logo/logo.svg";

/**
 * GlobalLoading — 2 chế độ:
 * 1. Intro mode (có onComplete): Text stagger + curtain open → dùng khi app mount
 * 2. Suspense mode (không onComplete): Text stagger + pulse → dùng khi lazy load pages
 */
const GlobalLoading = ({ onComplete }) => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const textRef = useRef(null);
  const underlineRef = useRef(null);
  const logoRef = useRef(null);
  const topCurtainRef = useRef(null);
  const bottomCurtainRef = useRef(null);
  const glowRef = useRef(null);
  const isIntroMode = !!onComplete;

  useEffect(() => {
    // ui-quality skill: Reduced Motion fallback (bắt buộc khi dùng GSAP)
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      onComplete?.();
      return;
    }

    const textEl = textRef.current;
    const underline = underlineRef.current;
    const logo = logoRef.current;

    // Tách "HTCOACHING" thành từng ký tự
    const split = new SplitType(textEl, { types: "chars" });
    const chars = split.chars;

    // Trạng thái ban đầu — dùng transform thay vì top/left để GPU accelerate
    gsap.set(chars, {
      opacity: 0,
      y: 15,
      display: "inline-block",
      willChange: "transform, opacity",
    });
    gsap.set(underline, { scaleX: 0, transformOrigin: "left center" });
    gsap.set(logo, { opacity: 0, scale: 0.8 });
    
    // Ngăn chặn FOUC (flash of unstyled content)
    gsap.set(contentRef.current, { visibility: "visible" });

    if (isIntroMode && glowRef.current) {
      gsap.set(glowRef.current, { opacity: 0, scaleX: 0 });
    }

    const tl = gsap.timeline({
      onComplete: () => onComplete?.(),
    });

    // ═══════════════════════════════════════════
    // PHASE 1: Text Reveal — mượt mà, GPU-accelerated
    // ═══════════════════════════════════════════

    // Logo scale in
    tl.to(logo, {
      opacity: 1,
      scale: 1,
      duration: 0.5,
      ease: "power2.out",
      force3D: true,
    });

    // Chữ stagger — duration dài hơn, ease mượt hơn
    tl.to(
      chars,
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.05,
        ease: "power3.out",
        force3D: true,
      },
      "-=0.3"
    );

    // Gạch ngang chạy ra theo chữ
    tl.to(
      underline,
      {
        scaleX: 1,
        duration: 0.7,
        ease: "power2.out",
      },
      "-=0.4"
    );

    if (isIntroMode) {
      // ═══════════════════════════════════════════
      // INTRO MODE: Hold → fade content → curtain OPEN
      // ═══════════════════════════════════════════

      // Giữ hiển thị
      tl.to({}, { duration: 0.5 });

      // Fade out toàn bộ nội dung
      tl.to(contentRef.current, {
        opacity: 0,
        duration: 0.3,
        ease: "power2.in",
      });

      // Glow line TRẮNG xuất hiện ở giữa
      tl.to(glowRef.current, {
        opacity: 1,
        scaleX: 1,
        duration: 0.25,
        ease: "power2.out",
      });

      // Curtain MỞ RA — nửa trên trượt lên, nửa dưới trượt xuống
      tl.to(topCurtainRef.current, {
        yPercent: -100,
        duration: 0.6,
        ease: "power3.inOut",
        force3D: true,
      });
      tl.to(
        bottomCurtainRef.current,
        {
          yPercent: 100,
          duration: 0.6,
          ease: "power3.inOut",
          force3D: true,
        },
        "<"
      );

      // Glow line mờ dần cùng lúc
      tl.to(
        glowRef.current,
        {
          opacity: 0,
          duration: 0.4,
          ease: "power2.in",
        },
        "<0.1"
      );
    } else {
      // ═══════════════════════════════════════════
      // SUSPENSE MODE: Pulse chờ page load
      // ═══════════════════════════════════════════
      tl.to([textEl, logo], {
        opacity: 0.4,
        duration: 0.8,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }

    return () => {
      tl.kill();
      split.revert();
    };
  }, [onComplete, isIntroMode]);

  // ═══════════════════════════════════════════
  // SUSPENSE MODE — layout đơn giản, 1 lớp
  // ═══════════════════════════════════════════
  if (!isIntroMode) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div ref={contentRef} className="flex flex-col items-center gap-3" style={{ visibility: "hidden" }}>
          <img
            ref={logoRef}
            src={logoSrc}
            alt="HTCOACHING"
            className="h-8 md:h-10"
          />
          <h1
            ref={textRef}
            className="font-display text-fluid-5xl font-bold tracking-[0.3em] uppercase select-none italic"
            style={{ color: "#F87E1A" }}
          >
            HTCOACHING
          </h1>
          <div
            ref={underlineRef}
            className="w-full h-[3px]"
            style={{
              background:
                "linear-gradient(90deg, transparent, #F87E1A 20%, #F87E1A 80%, transparent)",
            }}
          />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // INTRO MODE — 2 curtains + content + glow
  // ═══════════════════════════════════════════
  return (
    <div ref={containerRef} className="fixed inset-0 z-[100]">
      {/* Nửa trên — trượt lên khi mở */}
      <div
        ref={topCurtainRef}
        className="absolute top-0 left-0 right-0 h-1/2 bg-black"
      />

      {/* Nửa dưới — trượt xuống khi mở */}
      <div
        ref={bottomCurtainRef}
        className="absolute bottom-0 left-0 right-0 h-1/2 bg-black"
      />

      {/* Glow line ở giữa — TRẮNG */}
      <div
        ref={glowRef}
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px] pointer-events-none z-20"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, #ffffff 30%, #ffffff 70%, transparent 95%)",
          boxShadow:
            "0 0 30px 10px rgba(255, 255, 255, 0.6), 0 0 80px 30px rgba(255, 255, 255, 0.3)",
        }}
      />

      {/* Nội dung — logo + chữ + gạch ngang */}
      <div
        ref={contentRef}
        className="absolute inset-0 flex items-center justify-center z-10"
        style={{ visibility: "hidden" }}
      >
        <div className="flex flex-col items-center gap-3">
          {/* Logo phía trên */}
          <img
            ref={logoRef}
            src={logoSrc}
            alt="HTCOACHING"
            className="h-8 md:h-10"
          />

          {/* Brand text — cam, nghiêng */}
          <h1
            ref={textRef}
            className="font-display text-fluid-5xl font-bold tracking-[0.3em] uppercase select-none italic"
            style={{ color: "#F87E1A" }}
          >
            HTCOACHING
          </h1>

          {/* Gạch ngang — chạy ra theo chữ */}
          <div
            ref={underlineRef}
            className="w-full h-[3px]"
            style={{
              background:
                "linear-gradient(90deg, transparent, #F87E1A 20%, #F87E1A 80%, transparent)",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default GlobalLoading;

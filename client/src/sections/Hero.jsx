import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import SplitType from "split-type";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import hero1 from "../assets/images/hero/hero1.jpg";
import hero2 from "../assets/images/hero/hero2.jpg";
import hero3 from "../assets/images/hero/hero3.jpg";

const Hero = ({ images, avatars, onAnimationComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const titleRef = useRef(null);
  const leftRef = useRef(null);
  const ctaRef = useRef(null);
  const checklistRef = useRef(null);
  const slidesRef = useRef([]);
  const statRef = useRef([]);

  const slides = images && images.length > 0
    ? images.map(img => ({ bgImage: `url(${img})` }))
    : [
      { bgImage: `url(${hero1})` },
      { bgImage: `url(${hero2})` },
      { bgImage: `url(${hero3})` },
    ];

  // GSAP animations for Text and Left Block
  useLayoutEffect(() => {
    let split;
    let mm = gsap.matchMedia();
    let mobileTimer;
    let isCancelled = false;

    // Hide initially
    if (!window.isIntroDone) {
      gsap.set([leftRef.current], { opacity: 0 });
    }

    const startAnimation = () => {
      if (leftRef.current) {
        gsap.set([leftRef.current], { opacity: 1 });
      }

      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        document.fonts.ready.then(() => {
          if (isCancelled || !titleRef.current) return;

          if (split) {
            split.revert();
          }

          const originalHtml = titleRef.current.getAttribute("data-original-html");
          if (originalHtml) {
            titleRef.current.innerHTML = originalHtml;
          } else {
            titleRef.current.setAttribute("data-original-html", titleRef.current.innerHTML);
          }

          split = new SplitType(titleRef.current, { types: 'chars, words' });
          gsap.set(split.chars, { opacity: 0 });

          gsap.fromTo(split.chars,
            { y: 50, opacity: 0, scale: 2.5, rotationX: -90 },
            {
              y: 0, opacity: 1, scale: 1, rotationX: 0,
              duration: 0.8, ease: "power3.out", stagger: 0.03, delay: 0.2, transformOrigin: "bottom center"
            }
          );
        });

        if (leftRef.current) {
          const elements = leftRef.current.querySelectorAll("[data-gsap-reveal]");
          gsap.fromTo(elements,
            { x: -40, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.6, stagger: 0.15, ease: "power2.out", delay: 0.8 }
          );
        }

        if (ctaRef.current) {
          const buttons = ctaRef.current.children;
          gsap.fromTo(buttons,
            { x: -30, opacity: 0 },
            {
              x: 0, opacity: 1, duration: 0.6, stagger: 0.15, ease: "power2.out", delay: 1.2
            }
          );
        }

        if (checklistRef.current) {
          const items = checklistRef.current.children;
          gsap.fromTo(items,
            { x: -20, opacity: 0 },
            {
              x: 0, opacity: 1, duration: 0.5, stagger: 0.12, ease: "power2.out", delay: 1.5,
              onComplete: () => onAnimationComplete?.()
            }
          );
        }
      });

      if (window.innerWidth < 768) {
        mobileTimer = setTimeout(() => onAnimationComplete?.(), 1000);
      }
    };

    if (window.isIntroDone) {
      startAnimation();
    } else {
      window.addEventListener("introComplete", startAnimation);
    }

    const handleResize = () => {
      if (split) split.split();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener("introComplete", startAnimation);
      mm.revert();
      if (split) split.revert();
      if (mobileTimer) clearTimeout(mobileTimer);
    };
  }, []);

  // GSAP CountUp Animation cho Stats
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const stat = entry.target;
          const targetValue = +stat.dataset.count;
          const duration = 2000;
          const startTime = performance.now();

          const animate = (currentTime) => {
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const currentValue = Math.floor(progress * targetValue);
            stat.textContent = new Intl.NumberFormat().format(currentValue);
            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              const index = statRef.current.indexOf(stat);
              const isFirstOrLast = index === 0 || index === statRef.current.length - 1;
              stat.textContent = new Intl.NumberFormat().format(targetValue) + (isFirstOrLast ? "+" : "");
            }
          };
          requestAnimationFrame(animate);
          observer.unobserve(stat);
        }
      });
    });

    statRef.current.forEach((stat) => {
      if (stat) observer.observe(stat);
    });
  }, []);

  // GSAP Hero Slider Effect
  useEffect(() => {
    slidesRef.current.forEach((slide, idx) => {
      if (!slide) return;
      if (idx === currentIndex) {
        gsap.fromTo(slide,
          { opacity: 0, scale: 1.05 },
          { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out", zIndex: 1 }
        );
      } else {
        gsap.to(slide, {
          opacity: 0,
          duration: 1.2,
          ease: "power2.out",
          zIndex: 0
        });
      }
    });
  }, [currentIndex]);

  // Autoplay
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [currentIndex, slides.length]);

  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % slides.length);
  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);

  const memoizedTitle = useMemo(() => (
    <h1 ref={titleRef} className="hero-title font-display font-extrabold uppercase text-[50px] md:text-[68px] lg:text-[70px] xl:text-[80px] leading-[1.15] tracking-wide mb-6 text-dark" style={{ perspective: "1000px" }}>
      Lột xác<br />trong <span className="text-primary">90 ngày</span><br />Không viện cớ.
    </h1>
  ), []);

  return (
    <section id="home" className="relative min-h-screen pt-[73px] 2xl:pt-20 bg-[#FAF8F3] text-dark overflow-hidden flex flex-col">
      <div className="flex flex-col lg:flex-row flex-1 min-h-[calc(100vh-73px)] 2xl:min-h-[calc(100vh-80px)]">

        {/* LEFT: TEXT CONTENT */}
        <div ref={leftRef} className="w-full lg:w-1/2 flex flex-col justify-center pt-[5vh] lg:pt-[12vh] relative z-20 px-5 sm:px-10 lg:pl-[calc((100vw-1024px)/2+20px)] xl:pl-[calc((100vw-1280px)/2+20px)] 2xl:pl-[calc((100vw-1536px)/2+20px)] lg:pr-16 xl:pr-24 py-12 lg:py-0">
          <div data-gsap-reveal className="inline-flex items-center gap-2 bg-primary/10 text-[#C4400F] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 w-fit border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            Chương trình 90 ngày · HLV riêng
          </div>

          {memoizedTitle}

          <p data-gsap-reveal className="text-dark/70 text-lg xl:text-xl leading-relaxed mb-10 max-w-lg font-medium">
            Lộ trình tập & ăn được cá nhân hoá theo cơ địa của bạn, theo dõi tiến độ mỗi ngày trên Notion. <strong className="text-dark">Không đạt mục tiêu — hoàn tiền.</strong>
          </p>

          <div ref={ctaRef} className="flex flex-col xl:flex-row items-start xl:items-center gap-5 xl:gap-8 mb-8">
            <a
              href="#contact"
              className="group inline-flex items-center gap-2 bg-primary hover:bg-[#C4400F] text-[#1a0800] font-bold text-[15px] xl:text-base px-6 xl:px-[38px] py-4 xl:py-[19px] rounded-[2px] shadow-[0_8px_24px_rgba(255,90,31,0.28)] hover:shadow-[0_12px_28px_rgba(255,90,31,0.4)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
            >
              Nhận lộ trình miễn phí <span className="font-sans group-hover:translate-x-1.5 transition-transform duration-300">→</span>
            </a>
            <Link
              to="/ket-qua-khach-hang"
              className="group relative inline-flex items-center gap-2 text-dark font-semibold text-[14px] xl:text-[15px] pb-1 cursor-pointer whitespace-nowrap"
            >
              Xem hành trình học viên đã lột xác
              <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-dark/20"></span>
              <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-dark group-hover:w-full transition-all duration-300 ease-out"></span>
            </Link>
          </div>

          {/* CHECKLIST */}
          <div ref={checklistRef} className="flex flex-col gap-3.5">
            {[
              "Lộ trình riêng biệt",
              "Thực đơn thông minh",
              "Theo dõi tiến độ dễ dàng trên Notion",
              "Cam kết đạt mục tiêu 100%"
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-3 font-semibold text-[14px] xl:text-[15px] text-dark/90">
                <div className="w-[22px] h-[22px] rounded-full bg-dark flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3"><path d="M20 6L9 17l-5-5" stroke="#FF5A1F" strokeWidth="3" strokeLinecap="round" /></svg>
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: IMAGE SLIDER WITH INNER FLOATING STATS */}
        <div className="relative w-full lg:w-1/2 min-h-[50vh] lg:min-h-full overflow-hidden bg-dark">
          {/* Slider Container */}
          <div className="absolute inset-0 w-full h-full">
            {slides.map((slide, idx) => (
              <div
                key={idx}
                ref={(el) => (slidesRef.current[idx] = el)}
                className="absolute inset-0 w-full h-full opacity-0 will-change-transform"
              >
                <div
                  className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: slide.bgImage }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              </div>
            ))}
          </div>

          {/* CUSTOM NAV BUTTONS INSIDE IMAGE */}
          <div className="absolute inset-0 flex items-center justify-between px-3 lg:px-6 z-20 pointer-events-none">
            <button
              onClick={handlePrev}
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-black/40 backdrop-blur-md text-white/70 hover:text-white hover:bg-black/80 transition-all flex items-center justify-center pointer-events-auto"
            >
              <ChevronLeft className="w-6 h-6 lg:w-7 lg:h-7" />
            </button>
            <button
              onClick={handleNext}
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-black/40 backdrop-blur-md text-white/70 hover:text-white hover:bg-black/80 transition-all flex items-center justify-center pointer-events-auto"
            >
              <ChevronRight className="w-6 h-6 lg:w-7 lg:h-7" />
            </button>
          </div>

          {/* FLOATING WHITE CARD (CountUp Stats - INSIDE IMAGE) */}
          <div className="absolute bottom-8 left-8 right-8 lg:bottom-12 lg:left-14 lg:right-14 xl:bottom-16 xl:left-20 xl:right-20 bg-[#F0EBE3] backdrop-blur-md text-black px-5 py-4 lg:px-7 lg:py-[22px] rounded-[18px] shadow-2xl z-30 flex items-center justify-start gap-4">

            <div className="flex items-center gap-3.5">
              {/* Avatars Overlapping */}
              {avatars && avatars.length > 0 && (
                <div className="flex -space-x-2.5 shrink-0">
                  {avatars.map((avatar, idx) => (
                    <img
                      key={idx}
                      src={avatar}
                      alt={`Học viên ${idx + 1}`}
                      className="w-11 h-11 lg:w-[46px] lg:h-[46px] rounded-full border-2 border-[#F0EBE3] object-cover shadow-sm relative"
                      style={{ zIndex: 10 - idx }}
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-col items-start">
                <span className="font-bold text-dark text-[16px] lg:text-[17px] leading-snug">
                  <span
                    data-count="50"
                    ref={(el) => (statRef.current[0] = el)}
                  >
                    0
                  </span>
                  {" "}học viên đã lột xác
                </span>
                <span className="text-[13px] lg:text-[14px] text-gray-600 font-medium">
                  Đánh giá trung bình 4.9/5
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

export default Hero;

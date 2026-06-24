import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { gsap } from "gsap";
import SplitType from "split-type";
import {
  Route,
  Apple,
  LineChart,
  Medal,
  Search,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import hero1 from "../assets/images/hero/hero1.jpg";
import hero2 from "../assets/images/hero/hero2.jpg";
import hero3 from "../assets/images/hero/hero3.jpg";

const Hero = ({ images, onAnimationComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const titleRef = useRef(null);
  const featuresRef = useRef(null);
  const ctaRef = useRef(null);
  const slidesRef = useRef([]);

  const slides = images && images.length > 0 
    ? images.map(img => ({ bgImage: `url(${img})` }))
    : [
        { bgImage: `url(${hero1})` },
        { bgImage: `url(${hero2})` },
        { bgImage: `url(${hero3})` },
      ];

  const features = [
    { icon: Route, text: "Lộ trình riêng biệt" },
    { icon: Apple, text: "Thực đơn thông minh" },
    { icon: LineChart, text: "Theo dõi tiến độ dễ dàng trên Notion" },
    { icon: Medal, text: "Cam kết đạt mục tiêu 100%" },
  ];

  // GSAP animations for Text, Features and CTA (runs once on mount)
  useLayoutEffect(() => {
    let split;
    let mm = gsap.matchMedia();
    let mobileTimer;
    
    // Hide initially to prevent showing behind the curtain
    if (!window.isIntroDone) {
      gsap.set([titleRef.current, featuresRef.current, ctaRef.current], { opacity: 0 });
    }

    const startAnimation = () => {
      // Reset visibility so children can animate
      gsap.set([titleRef.current, featuresRef.current, ctaRef.current], { opacity: 1 });
      
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        // 1. Text Animation (Chars sliding & fading)
        if (titleRef.current) {
          split = new SplitType(titleRef.current, { types: 'chars, words' });
          
          // Hide characters initially to prevent flash of unstyled content
          gsap.set(split.chars, { opacity: 0 });

          gsap.fromTo(split.chars, 
            { 
              y: 50, 
              opacity: 0, 
              scale: 2.5,
              rotationX: -90
            },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              rotationX: 0,
              duration: 0.8,
              ease: "power3.out",
              stagger: 0.03,
              delay: 0.2,
              transformOrigin: "bottom center"
            }
          );
        }

        // 2. Features: stagger from left
        if (featuresRef.current) {
          gsap.from(featuresRef.current.children, {
            x: -40,
            opacity: 0,
            duration: 0.6,
            stagger: 0.15,
            ease: "power2.out",
            delay: 0.8,
          });
        }

        // 3. CTA buttons: slide in from sides
        if (ctaRef.current) {
          const buttons = ctaRef.current.children;
          if (buttons[0]) {
            gsap.fromTo(buttons[0], 
              { x: -50, opacity: 0 },
              {
                x: 0,
                opacity: 1,
                duration: 0.7,
                ease: "power2.out",
                delay: 1.2,
              }
            );
          }
          if (buttons[1]) {
            gsap.fromTo(buttons[1], 
              { x: 50, opacity: 0 },
              {
                x: 0,
                opacity: 1,
                duration: 0.7,
                ease: "power2.out",
                delay: 1.4,
                onComplete: () => onAnimationComplete?.(),
              }
            );
          } else {
            // Fallback nếu không có button[1] (mobile)
            gsap.delayedCall(2.5, () => onAnimationComplete?.());
          }
        }
      });

      // Fallback cho mobile (< 768px) — matchMedia không trigger animation
      if (window.innerWidth < 768) {
        mobileTimer = setTimeout(() => onAnimationComplete?.(), 1000);
      }
    };

    if (window.isIntroDone) {
      startAnimation();
    } else {
      window.addEventListener("introComplete", startAnimation);
    }
    // Cleanup on resize or unmount
    const handleResize = () => {
      if (split) {
        split.split(); // re-split on window resize to fix layout
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener("introComplete", startAnimation);
      mm.revert();
      if (split) split.revert();
      if (mobileTimer) clearTimeout(mobileTimer);
    };
  }, []);

  // GSAP Hero Slider Effect (Crossfade + Zoom)
  useEffect(() => {
    slidesRef.current.forEach((slide, idx) => {
      if (!slide) return;
      if (idx === currentIndex) {
        gsap.fromTo(slide,
          { opacity: 0, scale: 1.1 },
          { opacity: 1, scale: 1, duration: 1.5, ease: "power2.out", zIndex: 1 }
        );
      } else {
        gsap.to(slide, {
          opacity: 0, 
          duration: 1.5, 
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

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <section
      id="home"
      className="relative flex items-center text-left text-white overflow-hidden min-h-screen bg-black"
    >
      <div className="absolute inset-0 w-full h-full">
        {slides.map((slide, idx) => (
          <div
            key={idx}
            ref={(el) => (slidesRef.current[idx] = el)}
            className="absolute inset-0 w-full h-full opacity-0 will-change-transform"
          >
            <div
              className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), ${slide.bgImage}`,
              }}
            />
          </div>
        ))}
      </div>

      {/* CONTENT */}
      <div className="absolute top-0 left-0 w-full h-full flex items-center lg:items-start justify-start pt-20 lg:pt-[96px] 2xl:pt-[140px] pb-6 pl-4 sm:pl-8 lg:pl-16 xl:pl-20 2xl:pl-24 z-10 pointer-events-none">
        <div className="max-w-2xl lg:max-w-lg xl:max-w-2xl 2xl:max-w-3xl mx-auto sm:mx-0 text-left pointer-events-auto px-4 sm:px-0">
          <h1 ref={titleRef} className="hero-title font-display font-extrabold uppercase leading-tight mb-3 lg:mb-4" style={{ perspective: "1000px" }}>
            <span className="gradient-text">TĂNG CƠ - GIẢM MỠ</span>, <span className="gradient-text">LỘT XÁC NGOẠN MỤC</span> TRONG 90 NGÀY? BẠN ĐÃ SẴN SÀNG CÙNG TÔI <span className="gradient-text">CHINH PHỤC MỤC TIÊU</span> NÀY CHƯA!
          </h1>

          <ul ref={featuresRef} className="space-y-1.5 lg:space-y-2 mb-3 lg:mb-4">
            {features.map((feature, idx) => (
              <li
                key={idx}
                className="flex items-center text-sm sm:text-base lg:text-sm xl:text-base 2xl:text-lg font-medium opacity-95"
              >
                <feature.icon
                  className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-3 shrink-0"
                  strokeWidth={1.5}
                />
                <span>{feature.text}</span>
              </li>
            ))}
          </ul>

          <div ref={ctaRef} className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-3 lg:mt-4">
            <a
              href="#classes"
              className="btn btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span>Khám phá chương trình tập</span>
            </a>
            <a
              href="#pricing"
              className="btn btn-white flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <ArrowRight className="w-4 h-4 shrink-0" />
              <span>Đăng ký ngay</span>
            </a>
          </div>
        </div>
      </div>

      {/* CUSTOM NAV BUTTONS */}
      <button
        onClick={handlePrev}
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-gray hover:text-white hover:bg-black/70 transition-all items-center justify-center"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={handleNext}
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-gray hover:text-white hover:bg-black/70 transition-all items-center justify-center"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </section>
  );
};

export default Hero;


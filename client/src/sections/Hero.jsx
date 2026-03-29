import { useState, useEffect, useMemo, useRef } from "react";
import Swiper from "swiper/bundle";
import "swiper/css/bundle";
import "swiper/css/navigation";
import "swiper/css/pagination";
import AOS from "aos";
import "aos/dist/aos.css";
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

const Hero = () => {
  // ================= REFS =================
  const prevRef = useRef(null);
  const nextRef = useRef(null);

  // ================= STATE =================
  const [typedIndex, setTypedIndex] = useState(0);

  // ================= STATIC DATA =================
  const texts = [
    "Tăng cơ - giảm mỡ",
    ", ",
    "lột xác ngoạn mục",
    " trong 90 ngày? Bạn đã sẵn sàng cùng tôi ",
    "chinh phục mục tiêu",
    " này chưa!",
  ];

  const slides = [
    { bgImage: `url(${hero1})` },
    { bgImage: `url(${hero2})` },
    { bgImage: `url(${hero3})` },
  ];

  const features = [
    { icon: Route, text: "Lộ trình riêng biệt", delay: "1000" },
    { icon: Apple, text: "Thực đơn thông minh", delay: "1200" },
    {
      icon: LineChart,
      text: "Theo dõi tiến độ dễ dàng trên Notion",
      delay: "1400",
    },
    { icon: Medal, text: "Cam kết đạt mục tiêu 100%", delay: "1600" },
  ];

  // ================= DERIVED =================
  const fullText = useMemo(() => texts.join(""), [texts]);

  const offsets = useMemo(() => {
    let start = 0;
    return texts.map((text) => {
      const end = start + text.length;
      const range = { start, end, text };
      start = end;
      return range;
    });
  }, [texts]);

  // ================= HELPERS =================
  const getTypedPart = (offset) => {
    if (typedIndex <= offset.start) return "";
    if (typedIndex >= offset.end) return offset.text;
    return offset.text.slice(0, typedIndex - offset.start);
  };

  // ================= EFFECTS =================

  // Typewriter
  useEffect(() => {
    const interval = setInterval(() => {
      setTypedIndex((prev) => {
        if (prev >= fullText.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [fullText.length]);

  // AOS refresh
  useEffect(() => {
    AOS.refresh();
  }, [typedIndex]);

  // Swiper init
  useEffect(() => {
    if (!prevRef.current || !nextRef.current) return;

    const swiper = new Swiper(".hero-swiper", {
      loop: true,
      autoplay: {
        delay: 5000,
        disableOnInteraction: false,
      },
      speed: 1000,
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
      },
      navigation: {
        prevEl: prevRef.current,
        nextEl: nextRef.current,
      },
    });

    return () => swiper.destroy();
  }, []);

  return (
    <section
      id="home"
      className="relative flex items-center text-left text-white overflow-hidden h-screen"
    >
      <div className="swiper hero-swiper w-full h-full">
        <div className="swiper-wrapper">
          {slides.map((slide, idx) => (
            <div
              key={idx}
              className="swiper-slide relative flex items-center justify-center"
            >
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), ${slide.bgImage}`,
                }}
              />
            </div>
          ))}
        </div>

        {/* CONTENT */}
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-start pl-4 sm:pl-8 md:pl-16 lg:pl-20 xl:pl-24 z-10 pointer-events-none">
          <div className="max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto sm:mx-0 text-left pointer-events-auto px-4 sm:px-0">
            {/* TITLE with Typewriter */}
            <h1
              className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold uppercase leading-tight mb-4 md:mb-6"
              data-aos="fade-down"
            >
              <span className="bg-gradient-to-r from-[#ff4d00] via-[#ff8c00] to-[#ff4d00] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient">
                {getTypedPart(offsets[0])}
              </span>
              {getTypedPart(offsets[1])}
              <span className="bg-gradient-to-r from-[#ff4d00] via-[#ff8c00] to-[#ff4d00] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient">
                {getTypedPart(offsets[2])}
              </span>
              {getTypedPart(offsets[3])}
              <span className="bg-gradient-to-r from-[#ff4d00] via-[#ff8c00] to-[#ff4d00] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient">
                {getTypedPart(offsets[4])}
              </span>
              {getTypedPart(offsets[5])}
              <span className="ml-1 inline-block w-[0.3rem] h-[1em] bg-white cursor"></span>
            </h1>

            {/* FEATURES */}
            <ul className="space-y-3 mb-6 md:mb-8">
              {features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-center text-sm sm:text-base md:text-lg font-medium opacity-95"
                  data-aos="fade-down"
                  data-aos-delay={feature.delay}
                >
                  <feature.icon
                    className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--color-primary)] mr-3 flex-shrink-0"
                    strokeWidth={1.5}
                  />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>

            {/* BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 mt-6 md:mt-8">
              <a
                href="#classes"
                className="btn !flex items-center justify-center gap-2 whitespace-nowrap bg-[var(--color-primary)] text-white border-[var(--color-primary)] hover:bg-transparent hover:text-[var(--color-primary)]"
                data-aos="fade-right"
              >
                <Search className="w-4 h-4 flex-shrink-0" />
                <span>Khám phá chương trình tập</span>
              </a>
              <a
                href="#pricing"
                className="btn !flex items-center justify-center gap-2 whitespace-nowrap border-white text-white hover:bg-white hover:text-[var(--color-primary)]"
                data-aos="fade-left"
              >
                <ArrowRight className="w-4 h-4 flex-shrink-0" />
                <span>Đăng ký ngay</span>
              </a>
            </div>
          </div>
        </div>

        {/* PAGINATION */}
        <div className="swiper-pagination !bottom-4 md:!bottom-8"></div>

        {/* CUSTOM NAV BUTTONS */}
        <button
          ref={prevRef}
          className="custom-swiper-prev hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-[var(--color-gray)] hover:text-white hover:bg-black/70 transition-all items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          ref={nextRef}
          className="custom-swiper-next hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-[var(--color-gray)] hover:text-white hover:bg-black/70 transition-all items-center justify-center"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </section>
  );
};

export default Hero;

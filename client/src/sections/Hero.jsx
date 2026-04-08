import { useState, useEffect, useMemo } from "react";
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
import { useSwiper } from "../hooks/useSwiper";

const Hero = () => {
  const [typedIndex, setTypedIndex] = useState(0);

  const texts = [
    "TĂNG CƠ - GIẢM MỠ",
    ", ",
    "LỘT XÁC NGOẠN MỤC",
    " TRONG 90 NGÀY? BẠN ĐÃ SẴN SÀNG CÙNG TÔI ",
    "CHINH PHỤC MỤC TIÊU",
    " NÀY CHƯA!",
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

  const fullText = texts.join("");
  const offsets = (() => {
    let start = 0;
    return texts.map((text) => {
      const end = start + text.length;
      const range = { start, end, text };
      start = end;
      return range;
    });
  })();

  const getTypedPart = (offset) => {
    if (typedIndex <= offset.start) return "";
    if (typedIndex >= offset.end) return offset.text;
    return offset.text.slice(0, typedIndex - offset.start);
  };

  // Typewriter effect
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

  // Swiper options
  const swiperOptions = useMemo(
    () => ({
      loop: true,
      autoplay: { delay: 5000, disableOnInteraction: false },
      speed: 1000,
      pagination: { el: ".swiper-pagination", clickable: true },
    }),
    [],
  );

  const { prevRef, nextRef } = useSwiper(".hero-swiper", swiperOptions);

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
            <h1
              className="font-display text-3xl sm:text-4xl md:text-6xl lg:text-6xl xl:text-7xl font-extrabold uppercase leading-tight mb-4 md:mb-6"
              data-aos="fade-down"
            >
              <span className="gradient-text">{getTypedPart(offsets[0])}</span>
              {getTypedPart(offsets[1])}
              <span className="gradient-text">{getTypedPart(offsets[2])}</span>
              {getTypedPart(offsets[3])}
              <span className="gradient-text">{getTypedPart(offsets[4])}</span>
              {getTypedPart(offsets[5])}
              <span className="ml-1 inline-block w-[0.3rem] h-[1em] bg-white cursor"></span>
            </h1>

            <ul className="space-y-3 mb-6 md:mb-8">
              {features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-center text-sm sm:text-base md:text-lg font-medium opacity-95"
                  data-aos="fade-down"
                  data-aos-delay={feature.delay}
                >
                  <feature.icon
                    className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-3 shrink-0"
                    strokeWidth={1.5}
                  />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 mt-6 md:mt-8">
              <a
                href="#classes"
                className="btn btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
                data-aos="fade-right"
              >
                <Search className="w-4 h-4 shrink-0" />
                <span>Khám phá chương trình tập</span>
              </a>
              <a
                href="#pricing"
                className="btn btn-white flex items-center justify-center gap-2 whitespace-nowrap"
                data-aos="fade-left"
              >
                <ArrowRight className="w-4 h-4 shrink-0" />
                <span>Đăng ký ngay</span>
              </a>
            </div>
          </div>
        </div>

        {/* PAGINATION */}
        <div className="swiper-pagination bottom-4! md:bottom-8!"></div>

        {/* CUSTOM NAV BUTTONS */}
        <button
          ref={prevRef}
          className="custom-swiper-prev hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-gray hover:text-white hover:bg-black/70 transition-all items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          ref={nextRef}
          className="custom-swiper-next hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-gray hover:text-white hover:bg-black/70 transition-all items-center justify-center"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </section>
  );
};

export default Hero;

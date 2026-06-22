import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { Flame, Zap, Target, Dumbbell } from "lucide-react";
import hero1 from "../assets/images/hero/hero1.jpg";
import hero2 from "../assets/images/hero/hero2.jpg";
import hero3 from "../assets/images/hero/hero3.jpg";

gsap.registerPlugin(ScrollTrigger);

const About = ({ images }) => {
  const defaultImages = [hero1, hero2, hero3];
  const displayImages = images && images.length > 0 ? images : defaultImages;
  const statRef = useRef([]);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const slidesRef = useRef([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // GSAP Animations cho Text và Số (Chạy 1 lần khi scroll tới)
  useEffect(() => {
    let mm = gsap.matchMedia();
    mm.add("(min-width: 768px)", () => {
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

    // Counter animation
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
              const isFirstOrLast =
                index === 0 || index === statRef.current.length - 1;
              stat.textContent =
                new Intl.NumberFormat().format(targetValue) +
                (isFirstOrLast ? "+" : "");
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
    <section id="about" className="py-16 sm:py-20 md:py-24 lg:py-25 bg-light">
      <div className="container-custom flex flex-col md:flex-row items-center gap-8 md:gap-12">
        {/* LEFT */}
        <div ref={leftRef} className="w-full md:w-1/2 lg:flex-1 min-w-0">
          <h2 data-gsap-reveal>NGƯỜI ĐỒNG HÀNH THAY ĐỔI CỦA BẠN</h2>

          <p
            className="italic text-primary font-semibold text-base sm:text-lg md:text-xl mt-4"
            data-gsap-reveal
          >
            "Không có body đỉnh trong vùng an toàn. Hoặc là thay đổi – hoặc là
            mãi như cũ."
          </p>

          <p className="desc text-sm sm:text-base" data-gsap-reveal>
            Mình là <strong>Thiện</strong> – huấn luyện viên cá nhân chuyên
            nghiệp với hơn <strong>4 năm kinh nghiệm thực chiến</strong>, người
            đã trực tiếp thay đổi hình thể cho hơn <strong>50 học viên</strong>{" "}
            với đủ mọi thể trạng khác nhau. Tăng cơ – đốt mỡ – kỷ luật hơn mỗi
            ngày là những thứ bạn sẽ đạt được khi đồng hành cùng mình.
          </p>

          <div className="mt-6 sm:mt-8">
            <h3 data-gsap-reveal>PHONG CÁCH HUẤN LUYỆN</h3>

            <ul className="mt-3 sm:mt-4 space-y-3" data-gsap-reveal>
              <li className="flex items-center gap-3 font-semibold text-sm sm:text-base">
                <Flame className="text-primary shrink-0" size={18} />
                Máu lửa, kỷ luật, thân thiện, sát cánh trong từng buổi tập
              </li>
              <li className="flex items-center gap-3 font-semibold text-sm sm:text-base">
                <Zap className="text-primary shrink-0" size={18} />
                Động lực thực chất – Không tâng bốc, chỉ thẳng vào vấn đề bạn
                cần sửa
              </li>
              <li className="flex items-center gap-3 font-semibold text-sm sm:text-base">
                <Target className="text-primary shrink-0" size={18} />
                Lộ trình cá nhân hóa – Tập đúng kỹ thuật, ăn đúng cách, đánh
                trúng mục tiêu
              </li>
              <li className="flex items-center gap-3 font-semibold text-sm sm:text-base">
                <Dumbbell className="text-primary shrink-0" size={18} />
                Với slogan NO PAIN NO GAIN, mình sẽ đưa bạn vượt qua mọi giới
                hạn.
              </li>
            </ul>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-3 gap-4 mt-8 sm:mt-10">
            {[50, 3, 4].map((value, index) => (
              <div key={index} className="text-center">
                <span
                  className="block text-2xl sm:text-3xl md:text-4xl font-bold text-primary"
                  data-count={value}
                  ref={(el) => (statRef.current[index] = el)}
                >
                  0
                </span>
                <span className="text-xs sm:text-sm text-gray whitespace-pre-line">
                  {index === 0
                    ? "Học viên thay đổi\nngoạn mục"
                    : index === 1
                      ? "Số lượng\nchuyên môn"
                      : "4 Năm kinh nghiệm\nđúc kết"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT (GSAP Slider thay thế Swiper) */}
        <div ref={rightRef} className="w-full md:w-1/2 lg:flex-1 overflow-hidden rounded-xl shadow-lg aspect-video relative group">
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


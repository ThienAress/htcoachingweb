import React, { useEffect, useRef, useMemo } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import "swiper/css/bundle";
import "swiper/css/pagination";

import { Flame, Zap, Target, Dumbbell } from "lucide-react";
import hero1 from "../assets/images/hero/hero1.jpg";
import hero2 from "../assets/images/hero/hero2.jpg";
import hero3 from "../assets/images/hero/hero3.jpg";
import { useSwiper } from "../hooks/useSwiper";

const About = () => {
  const images = [hero1, hero2, hero3];
  const statRef = useRef([]);

  // Swiper options (không có navigation)
  const swiperOptions = useMemo(
    () => ({
      loop: true,
      autoplay: { delay: 4000, disableOnInteraction: false },
      speed: 800,
      pagination: { el: ".swiper-pagination", clickable: true },
    }),
    [],
  );

  useSwiper(".about-image-swiper", swiperOptions);

  useEffect(() => {
    AOS.init({ once: true });

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

    statRef.current.forEach((stat) => observer.observe(stat));

    const setFullHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    setFullHeight();
    window.addEventListener("resize", setFullHeight);
    window.addEventListener("load", setFullHeight);

    return () => {
      window.removeEventListener("resize", setFullHeight);
      window.removeEventListener("load", setFullHeight);
    };
  }, []);

  return (
    <section id="about" className="py-16 sm:py-20 md:py-24 lg:py-25 bg-light">
      <div className="container-custom flex flex-col md:flex-row items-center gap-8 md:gap-12">
        {/* LEFT */}
        <div className="w-full md:w-1/2 lg:flex-1 min-w-0">
          <h2 data-aos="fade-right">NGƯỜI ĐỒNG HÀNH THAY ĐỔI CỦA BẠN</h2>

          <p
            className="italic text-primary font-semibold text-base sm:text-lg md:text-xl mt-4"
            data-aos="fade-right"
          >
            "Không có body đỉnh trong vùng an toàn. Hoặc là thay đổi – hoặc là
            mãi như cũ."
          </p>

          <p className="desc text-sm sm:text-base" data-aos="fade-right">
            Mình là <strong>Thiện</strong> – huấn luyện viên cá nhân chuyên
            nghiệp với hơn <strong>4 năm kinh nghiệm thực chiến</strong>, người
            đã trực tiếp thay đổi hình thể cho hơn <strong>50 học viên</strong>{" "}
            với đủ mọi thể trạng khác nhau. Tăng cơ – đốt mỡ – kỷ luật hơn mỗi
            ngày là những thứ bạn sẽ đạt được khi đồng hành cùng mình.
          </p>

          <div className="mt-6 sm:mt-8">
            <h3 data-aos="fade-right">PHONG CÁCH HUẤN LUYỆN</h3>

            <ul className="mt-3 sm:mt-4 space-y-3" data-aos="fade-right">
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
          <div className="flex flex-wrap justify-center md:justify-between gap-4 mt-8 sm:mt-10">
            {[50, 3, 4].map((value, index) => (
              <div key={index} className="text-center min-w-25">
                <span
                  className="block text-2xl sm:text-3xl md:text-4xl font-bold text-primary"
                  data-count={value}
                  ref={(el) => (statRef.current[index] = el)}
                >
                  0
                </span>
                <span className="text-xs sm:text-sm text-gray">
                  {index === 0
                    ? "Học viên thay đổi ngoạn mục"
                    : index === 1
                      ? "Số lượng chuyên môn"
                      : "4 Năm kinh nghiệm đúc kết"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="w-full md:w-1/2 lg:flex-1 overflow-hidden rounded-xl shadow-lg aspect-video">
          <div className="swiper about-image-swiper w-full h-full rounded-xl overflow-hidden">
            <div className="swiper-wrapper">
              {images.map((img, index) => (
                <div key={index} className="swiper-slide">
                  <img
                    src={img}
                    alt={`hero-${index}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <div className="swiper-pagination"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;

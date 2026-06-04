import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Dumbbell,
  Utensils,
  ChartLine,
  HeartPulse,
  ArrowRight,
} from "lucide-react";
import trainer from "../assets/images/trainer/trainer.jpg";

gsap.registerPlugin(ScrollTrigger);

const Trainer = ({ image }) => {
  const displayImage = image || trainer;
  const sectionRef = useRef(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    let mm = gsap.matchMedia(sectionRef);
    mm.add("(min-width: 768px)", () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          once: true,
        },
      });

      tl.fromTo("[data-gsap='title']",
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
      )
        .fromTo("[data-gsap='image']",
          { scale: 0.95, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.8, ease: "power2.out" },
          "-=0.3"
        )
        .fromTo("[data-gsap='text']",
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "power2.out" },
          "-=0.4"
        )
        .fromTo("[data-gsap='card']",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: "power2.out" },
          "-=0.3"
        )
        .fromTo("[data-gsap='cta']",
          { y: 15, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" },
          "-=0.2"
        );
    });

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="trainers"
      className="max-w-5xl mx-auto my-12 bg-white rounded-2xl flex flex-wrap gap-10 p-8 shadow-lg"
    >
      <div className="container-custom p-0!">
        <h2 className="text-center uppercase" data-gsap="title">
          PERSONAL TRAINER
        </h2>
        {/* Ảnh trainer */}
        <div
          className="flex-1 min-w-full md:min-w-75 mt-2 mb-6 md:mb-0"
          data-gsap="image"
        >
          <img
            src={displayImage}
            alt="Personal Trainer HTCOACHING - Hoàng Thiện"
            loading="lazy"
            width="600"
            height="400"
            className="w-full h-auto rounded-2xl object-cover"
          />
        </div>

        <div className="flex-2 min-w-full md:min-w-125 mt-8 md:mt-0">
          <div data-gsap="text">
            <h3>HOÀNG THIỆN (HTCOACHING)</h3>
            <h4 className="text-base sm:text-lg text-black font-semibold mt-2">
              Chuyên gia huấn luyện cá nhân | 4+ năm kinh nghiệm
            </h4>
            <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-5 mt-2">
              Mình sẽ giúp bạn xây dựng vóc dáng khoẻ mạnh và cải thiện thói quen
              sống thông qua phương pháp tập luyện
              <strong> khoa học, cá nhân hóa </strong> và dinh dưỡng{" "}
              <strong> tối ưu </strong>.
            </p>
          </div>
          <div className="flex flex-col gap-5 mb-5">
            <div data-gsap="card" className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl transition-all hover:bg-blue-100 hover:-translate-y-1 hover:shadow-md cursor-pointer">
              <Dumbbell className="text-primary" size={22} />
              <span className="font-semibold text-gray">
                Huấn luyện 1-1 (Online/Offline)
              </span>
            </div>
            <div data-gsap="card" className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl transition-all hover:bg-blue-100 hover:-translate-y-1 hover:shadow-md cursor-pointer">
              <Utensils className="text-primary" size={22} />
              <span className="font-semibold text-gray">
                Meal plan cá nhân hóa
              </span>
            </div>
            <div data-gsap="card" className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl transition-all hover:bg-blue-100 hover:-translate-y-1 hover:shadow-md cursor-pointer">
              <ChartLine className="text-primary" size={22} />
              <span className="font-semibold text-gray">
                Theo dõi tiến độ định kỳ
              </span>
            </div>
            <div data-gsap="card" className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl transition-all hover:bg-blue-100 hover:-translate-y-1 hover:shadow-md cursor-pointer">
              <HeartPulse className="text-primary" size={22} />
              <span className="font-semibold text-gray">Hỗ trợ phục hồi</span>
            </div>
          </div>
          <a
            data-gsap="cta"
            href="#contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-semibold shadow-md hover:bg-primary-dark hover:-translate-y-0.5 transition"
          >
            <ArrowRight size={18} />
            Liên hệ để nhận tư vấn miễn phí!
          </a>
        </div>
      </div>
    </section>
  );
};

export default Trainer;


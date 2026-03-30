import { useEffect, useRef } from "react";
import Swiper from "swiper/bundle";
import "swiper/css/bundle";
import AOS from "aos";
import "aos/dist/aos.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import FeedbackCard from "./FeedbackCard";
import Customer1 from "../../assets/images/feedback/tu.jpg";
import Customer2 from "../../assets/images/feedback/nhi.jpg";
import Hero1 from "../../assets/images/hero/hero1.jpg";
import Hero2 from "../../assets/images//hero/hero2.jpg";

const feedbacks = [
  {
    beforeImg: Customer1,
    afterImg: Hero1,
    name: "Nguyễn Thảo",
    age: "23",
    job: "Giáo viên",
    result: "-10kg",
    duration: "21 tuần",
    message: "Mình từng mất tự tin... Huấn luyện viên rất tận tâm!",
  },
  {
    beforeImg: Customer2,
    afterImg: Hero2,
    name: "Nguyễn Văn A",
    age: "30",
    job: "Nhân viên văn phòng",
    result: "-8kg",
    duration: "18 tuần",
    message: "Tôi cảm thấy khỏe hơn và tự tin hơn rất nhiều!",
  },
];

const Feedback = () => {
  const prevRef = useRef(null);
  const nextRef = useRef(null);

  useEffect(() => {
    AOS.init({ duration: 1000, once: true });
  }, []);

  useEffect(() => {
    if (!prevRef.current || !nextRef.current) return;

    const swiperInstance = new Swiper(".feedback-slider", {
      slidesPerView: 1,
      spaceBetween: 30,
      loop: feedbacks.length > 1,
      autoplay: {
        delay: 4000,
        disableOnInteraction: false,
      },
      effect: "slide",
      speed: 800,
      navigation: {
        prevEl: prevRef.current,
        nextEl: nextRef.current,
      },
    });

    return () => {
      swiperInstance.destroy();
    };
  }, []);

  return (
    <section className="customer py-10 bg-white" id="customer">
      <div className="container">
        <h2
          className="font-display text-[2rem] sm:text-[2.5rem] md:text-[3rem] lg:text-[4rem] leading-tight text-black text-center mb-8"
          data-aos="fade-down"
          data-aos-duration="1500"
        >
          Câu chuyện thay đổi của khách hàng
        </h2>
        <div
          className="swiper feedback-slider relative"
          data-aos="fade-up"
          data-aos-duration="1500"
          data-aos-delay="200"
        >
          <div className="swiper-wrapper">
            {feedbacks.map((fb, index) => (
              <FeedbackCard key={index} {...fb} />
            ))}
          </div>

          {/* Custom Navigation Buttons */}
          <button
            ref={prevRef}
            className="custom-swiper-prev hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-all items-center justify-center"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            ref={nextRef}
            className="custom-swiper-next hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-all items-center justify-center"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Feedback;

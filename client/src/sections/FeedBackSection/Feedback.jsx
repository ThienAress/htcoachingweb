import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import "swiper/css/bundle";
import AOS from "aos";
import "aos/dist/aos.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import FeedbackCard from "./FeedbackCard";
import { useSwiper } from "../../hooks/useSwiper";
import { getPublicCustomerStories } from "../../services/customerStory.service";

const Feedback = () => {
  useEffect(() => {
    AOS.init({ duration: 1000, once: true });
  }, []);

  const { data: storiesResponse } = useQuery({
    queryKey: ["public-customer-stories", "featured"],
    queryFn: () => getPublicCustomerStories({ featured: true, limit: 5 }),
  });

  const stories = (storiesResponse?.data || []).slice(0, 5);

  const swiperOptions = useMemo(
    () => ({
      slidesPerView: 1,
      spaceBetween: 30,
      loop: stories.length > 1,
      autoplay: { delay: 4000, disableOnInteraction: false },
      effect: "slide",
      speed: 800,
    }),
    [stories.length],
  );

  const { prevRef, nextRef } = useSwiper(".feedback-slider", swiperOptions);

  return (
    <section className="customer py-10 bg-white" id="customer">
      <div className="container-custom">
        <div
          className="mb-8 flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left"
          data-aos="fade-down"
          data-aos-duration="1500"
        >
          <h2 className="uppercase">CÂU CHUYỆN THAY ĐỔI CỦA KHÁCH HÀNG</h2>
          <Link
            to="/ket-qua-khach-hang"
            className="inline-flex items-center justify-center rounded-full border border-primary px-5 py-2 text-sm font-bold uppercase tracking-[0.12em] text-primary transition hover:bg-primary hover:text-white"
          >
            Xem tất cả
          </Link>
        </div>

        <div
          className="swiper feedback-slider relative"
          data-aos="fade-up"
          data-aos-duration="1500"
          data-aos-delay="200"
        >
          <div className="swiper-wrapper">
            {stories.map((story) => (
              <FeedbackCard key={story.slug} {...story} />
            ))}
          </div>

          <button
            ref={prevRef}
            className="custom-swiper-prev hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-all items-center justify-center"
            aria-label="Câu chuyện trước"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            ref={nextRef}
            className="custom-swiper-next hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-all items-center justify-center"
            aria-label="Câu chuyện tiếp theo"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Feedback;

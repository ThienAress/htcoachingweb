import { useEffect, useRef } from "react";
import Swiper from "swiper/bundle";

export const useSwiper = (selector, options = {}) => {
  const prevRef = useRef(null);
  const nextRef = useRef(null);
  const swiperInstance = useRef(null);

  useEffect(() => {
    // Dùng setTimeout để đảm bảo DOM và refs đã sẵn sàng
    const timer = setTimeout(() => {
      const element = document.querySelector(selector);
      if (!element) return;

      const swiperOptions = {
        loop: true,
        autoplay: { delay: 5000, disableOnInteraction: false },
        speed: 800,
        pagination: { el: ".swiper-pagination", clickable: true },
        ...options,
      };

      // Chỉ thêm navigation nếu có refs
      if (prevRef.current && nextRef.current) {
        swiperOptions.navigation = {
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        };
      }

      swiperInstance.current = new Swiper(selector, swiperOptions);
    }, 0);

    return () => {
      clearTimeout(timer);
      if (swiperInstance.current) {
        swiperInstance.current.destroy(true, true);
        swiperInstance.current = null;
      }
    };
  }, [selector, options]);

  return { prevRef, nextRef };
};

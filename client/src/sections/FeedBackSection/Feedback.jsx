import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import FeedbackCard from "./FeedbackCard";
import { getPublicCustomerStories } from "../../services/customerStory.service";

gsap.registerPlugin(ScrollTrigger, Flip);

const Feedback = () => {
  const headerRef = useRef(null);
  const sliderRef = useRef(null);
  
  const [items, setItems] = useState([]);
  const [flipState, setFlipState] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [cardsToShow, setCardsToShow] = useState(3);

  const { data: storiesResponse } = useQuery({
    queryKey: ["public-customer-stories", "featured"],
    queryFn: () => getPublicCustomerStories({ featured: true, limit: 8 }),
  });

  const stories = storiesResponse?.data || [];

  // Khởi tạo items lần đầu tiên khi tải xong data
  useEffect(() => {
    if (stories.length > 0 && items.length === 0) {
      setItems(stories);
    }
  }, [stories, items.length]);

  // Responsive: Tính số lượng thẻ hiển thị
  useEffect(() => {
    const handleResize = () => {
      setCardsToShow(window.innerWidth >= 768 ? 3 : 1);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let mm = gsap.matchMedia();
    mm.add("(min-width: 768px)", () => {
      if (headerRef.current) {
        gsap.from(headerRef.current, {
          y: -20, opacity: 0, duration: 0.7, ease: "power2.out",
          scrollTrigger: { trigger: headerRef.current, start: "top 85%", once: true },
        });
      }
      if (sliderRef.current) {
        gsap.from(sliderRef.current, {
          y: 40, opacity: 0, duration: 0.8, ease: "power2.out",
          scrollTrigger: { trigger: sliderRef.current, start: "top 85%", once: true },
        });
      }
    });
    return () => mm.revert();
  }, [stories.length]);

  // Điều hướng GSAP FLIP
  const handleNext = () => {
    if (isAnimating || items.length <= cardsToShow) return;
    setIsAnimating(true);
    
    // Lưu lại trạng thái kích thước & vị trí trước khi State thay đổi
    const state = Flip.getState(".flip-item");
    setFlipState({ state, forward: true });

    // Cập nhật State (xoay mảng: đưa phần tử đầu xuống cuối)
    setItems(prev => {
      const newItems = [...prev];
      newItems.push(newItems.shift());
      return newItems;
    });
  };

  const handlePrev = () => {
    if (isAnimating || items.length <= cardsToShow) return;
    setIsAnimating(true);

    const state = Flip.getState(".flip-item");
    setFlipState({ state, forward: false });

    // Cập nhật State (xoay mảng: đưa phần tử cuối lên đầu)
    setItems(prev => {
      const newItems = [...prev];
      newItems.unshift(newItems.pop());
      return newItems;
    });
  };

  // Kích hoạt GSAP FLIP ngay sau khi React render xong UI mới
  useLayoutEffect(() => {
    if (!flipState) return;

    Flip.from(flipState.state, {
      targets: ".flip-item",
      fade: true,
      absoluteOnLeave: true,
      ease: "power2.out",
      duration: 0.7,
      onComplete: () => setIsAnimating(false),
      onEnter: (elements) => {
        return gsap.fromTo(elements, 
          { opacity: 0, scale: 0.5, transformOrigin: flipState.forward ? "bottom right" : "bottom left" },
          { opacity: 1, scale: 1, duration: 0.7 }
        );
      },
      onLeave: (elements) => {
        return gsap.to(elements, { 
          opacity: 0, 
          scale: 0.5, 
          transformOrigin: flipState.forward ? "bottom left" : "bottom right", 
          duration: 0.7
        });
      }
    });

    setFlipState(null);
  }, [items, flipState]);

  if (!stories.length) return null;

  // Lấy đúng số lượng thẻ cần hiển thị (mặc định là 3)
  const visibleItems = items.slice(0, cardsToShow);

  return (
    <section className="customer py-10 bg-white overflow-hidden" id="customer">
      <div className="container-custom relative">
        <div
          ref={headerRef}
          className="mb-8 flex flex-col items-center justify-center gap-4 text-center"
        >
          <h2 className="uppercase">CÂU CHUYỆN THAY ĐỔI CỦA KHÁCH HÀNG</h2>
          <Link
            to="/ket-qua-khach-hang"
            className="inline-flex items-center justify-center rounded-full border border-primary px-5 py-2 text-sm font-bold uppercase tracking-[0.12em] text-primary transition hover:bg-primary hover:text-white"
          >
            Xem tất cả
          </Link>
        </div>

        <div ref={sliderRef} className="relative w-full px-1 md:px-4 py-2">
          {/* Vùng chứa các thẻ FLIP */}
          <div className="flex justify-center gap-5 md:gap-[30px] w-full min-h-[450px]">
            {visibleItems.map((story) => (
              <div 
                key={story.slug} 
                className="flip-item w-full md:w-[calc(33.333%-20px)] flex-shrink-0 z-10"
                data-flip-id={story.slug}
              >
                <FeedbackCard {...story} />
              </div>
            ))}
          </div>

          {/* Các nút điều hướng */}
          {items.length > cardsToShow && (
            <>
              <button
                onClick={handlePrev}
                disabled={isAnimating}
                className="hidden md:flex absolute left-0 md:-left-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white transition-all items-center justify-center hover:bg-black/70 disabled:opacity-50 disabled:cursor-default"
                aria-label="Câu chuyện trước"
              >
                {isAnimating ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <ChevronLeft className="w-6 h-6" />
                )}
              </button>
              <button
                onClick={handleNext}
                disabled={isAnimating}
                className="hidden md:flex absolute right-0 md:-right-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white transition-all items-center justify-center hover:bg-black/70 disabled:opacity-50 disabled:cursor-default"
                aria-label="Câu chuyện tiếp theo"
              >
                {isAnimating ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <ChevronRight className="w-6 h-6" />
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default Feedback;


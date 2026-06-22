import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Draggable } from "gsap/Draggable";
import ClassCard from "./ClassCard";
import class1 from "../../assets/images/classes/class1.jpg";
import class2 from "../../assets/images/classes/class2.jpg";
import class3 from "../../assets/images/classes/class3.jpg";

gsap.registerPlugin(ScrollTrigger, Draggable);

const Classes = ({ images }) => {
  const headerRef = useRef(null);
  const carouselRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const classes = [
    {
      image: images?.[0] || class1,
      title: "PERSONAL TRAINING",
      desc: "Huấn luyện 1:1 giúp bạn theo sát tiến độ, tập đúng kỹ thuật và đạt mục tiêu nhanh hơn bao giờ hết.",
      benefits: ["Lộ trình cá nhân hóa", "Tập trung vào mục tiêu", "An toàn - Hiệu quả"],
    },
    {
      image: images?.[1] || class2,
      title: "CARDIO & HIIT",
      desc: "Đốt cháy mỡ thừa hiệu quả, tăng nhịp tim và cải thiện sức bền chỉ trong vài phút mỗi buổi tập.",
      benefits: ["Bài tập ngắn - Hiệu quả vượt trội", "Cải thiện sức khỏe tim mạch", "Phù hợp với người bận rộn"],
    },
    {
      image: images?.[2] || class3,
      title: "BOXING",
      desc: "Tăng sức bền, cải thiện phản xạ, giải phóng căng thẳng với những bài tập đầy năng lượng và linh hoạt.",
      benefits: ["Đốt mỡ, săn chắc toàn thân", "Nâng cao phản xạ", "Giải phóng năng lượng"],
    },
  ];

  // Dùng refs để truy cập hàm mới nhất bên trong Draggable (chỉ chạy 1 lần)
  const handleNextRef = useRef(null);
  const handlePrevRef = useRef(null);

  useEffect(() => {
    handleNextRef.current = handleNext;
    handlePrevRef.current = handlePrev;
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile || isPaused) return;
    const interval = setInterval(() => {
      if (handleNextRef.current) handleNextRef.current();
    }, 3000);
    return () => clearInterval(interval);
  }, [isMobile, isPaused]);

  // 1. Chỉ chạy 1 lần khi load trang để animate Header, set vị trí ban đầu và gắn Draggable
  useEffect(() => {
    let ctx = gsap.context(() => {
      if (headerRef.current) {
        gsap.from(headerRef.current.children, {
          y: -20, opacity: 0, duration: 0.7, stagger: 0.15, ease: "power2.out",
          scrollTrigger: { trigger: headerRef.current, start: "top 85%", once: true },
        });
      }

      if (carouselRef.current) {
        const cards = carouselRef.current.children;
        const total = classes.length;

        // Set vị trí tức thời lúc mới load để tránh bị giật từ tâm ra
        Array.from(cards).forEach((card, i) => {
          let offset = i % total;
          if (offset < -1) offset += total;
          if (offset > 1) offset -= total;

          const xPercent = offset * 110; 
          const scale = offset === 0 ? 1 : 0.75;
          const zIndex = offset === 0 ? 20 : 10;
          const opacity = offset === 0 ? 1 : 0.5;
          const filter = offset === 0 ? "blur(0px)" : "blur(3px)";
          
          gsap.set(card, { xPercent, scale, opacity, zIndex, filter });
        });

        // Bổ sung Draggable (Kéo thả) cho Container (Chỉ gắn 1 lần duy nhất)
        Draggable.create(carouselRef.current, {
          type: "x",
          edgeResistance: 0.65,
          onPress: () => setIsPaused(true),
          onRelease: () => setIsPaused(false),
          onDragEnd: function() {
            if (this.getDirection("start") === "left" && this.endX < -50) {
              handleNextRef.current();
            } else if (this.getDirection("start") === "right" && this.endX > 50) {
              handlePrevRef.current();
            }
            gsap.to(carouselRef.current, { x: 0, duration: 0.3 });
          }
        });
      }
    });
    return () => ctx.revert(); // Chỉ dọn dẹp khi đổi trang (unmount)
  }, []);

  // Tracking render lần đầu để không chạy animation
  const isFirstRender = useRef(true);

  // 2. Animate GSAP khi thay đổi currentIndex
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!carouselRef.current) return;
    const cards = carouselRef.current.children;
    const total = classes.length;

    Array.from(cards).forEach((card, i) => {
      let oldOffset = (i - prevIndex) % total;
      if (oldOffset < -1) oldOffset += total;
      if (oldOffset > 1) oldOffset -= total;

      let offset = (i - currentIndex) % total;
      if (offset < -1) offset += total;
      if (offset > 1) offset -= total;

      const isWrapping = Math.abs(oldOffset - offset) > 1;
      const xPercent = offset * 110; 
      const scale = offset === 0 ? 1 : 0.75;
      const zIndex = offset === 0 ? 20 : 10;
      const opacity = offset === 0 ? 1 : 0.5;
      const filter = offset === 0 ? "blur(0px)" : "blur(3px)";

      if (isWrapping && prevIndex !== currentIndex) {
        // Vòng quay 3D hình Elip (Lặn ra sau)
        const tl = gsap.timeline();
        tl.set(card, { zIndex: 0 })
          .to(card, {
            xPercent: 0, scale: 0.4, opacity: 0, filter: "blur(10px)",
            duration: 0.35, ease: "power2.in"
          })
          .to(card, {
            xPercent: xPercent, scale: scale, opacity: opacity, filter: filter,
            duration: 0.4, ease: "power2.out"
          });
      } else {
        // Các thẻ còn lại: Trượt mượt mà
        gsap.to(card, {
          xPercent: xPercent, scale: scale, opacity: opacity, zIndex: zIndex, filter: filter,
          duration: 0.75, ease: "power2.inOut",
        });
      }
    });

    // Cực kỳ quan trọng: CHỈ kill tweens đang chạy của thẻ, 
    // KHÔNG dùng ctx.revert() ở đây để tránh bị xóa sạch CSS Transforms làm thẻ bị giật ngược về vị trí gốc!
    return () => {
      gsap.killTweensOf(cards);
    };
  }, [currentIndex, prevIndex, classes.length]);

  const handleNext = () => {
    setPrevIndex(currentIndex);
    setCurrentIndex((prev) => (prev + 1) % classes.length);
  };

  const handlePrev = () => {
    setPrevIndex(currentIndex);
    setCurrentIndex((prev) => (prev - 1 + classes.length) % classes.length);
  };

  return (
    <section id="classes" className="py-12 sm:py-20 overflow-hidden bg-[#fafafa]">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 relative">
        <div ref={headerRef} className="max-w-[1650px] mx-auto z-10 relative">
          <h2 className="text-center text-primary text-2xl sm:text-3xl md:text-4xl lg:text-5xl uppercase">
            CHƯƠNG TRÌNH TẬP LUYỆN TRỰC TIẾP
          </h2>
          <p className="text-center text-gray-800 font-medium text-base sm:text-lg max-w-2xl mx-auto mb-8 px-4 mt-2">
            Cùng mình chinh phục mục tiêu thể chất với 3 bộ môn đặc trưng
          </p>
        </div>

        {/* 3D Carousel Wrapper */}
        <div className="relative w-full h-[520px] sm:h-[600px] md:h-[650px] lg:h-[720px] flex items-center justify-center perspective-[1000px] mt-4 sm:mt-8">
          
          <div ref={carouselRef} className="relative w-full max-w-[320px] sm:max-w-[400px] h-full flex items-center justify-center z-20 cursor-grab active:cursor-grabbing">
            {classes.map((item, index) => (
              <div 
                key={index} 
                className="absolute top-0 left-0 w-full cursor-pointer will-change-transform"
                onClick={() => {
                  if (index !== currentIndex) {
                    setPrevIndex(currentIndex);
                    setCurrentIndex(index);
                  }
                }}
              >
                <ClassCard {...item} />
              </div>
            ))}
          </div>
          
          {/* Controls - Nút điều hướng 2 bên */}
          <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-0 right-0 justify-between z-30 pointer-events-none px-2 sm:px-6 lg:px-12">
            <button 
              onClick={handlePrev}
              className="pointer-events-auto w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-white shadow-xl border border-gray-100 text-primary hover:bg-primary hover:text-white transition-all duration-300 transform hover:scale-110"
              aria-label="Previous"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button 
              onClick={handleNext}
              className="pointer-events-auto w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-white shadow-xl border border-gray-100 text-primary hover:bg-primary hover:text-white transition-all duration-300 transform hover:scale-110"
              aria-label="Next"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Classes;


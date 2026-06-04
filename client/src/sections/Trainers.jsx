import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useQuery } from "@tanstack/react-query";
import {
  Dumbbell,
  Utensils,
  ChartLine,
  HeartPulse,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getPublicTrainers } from "../services/trainer.service";

gsap.registerPlugin(ScrollTrigger);

const iconMap = {
  "dumbbell": Dumbbell,
  "utensils": Utensils,
  "chart-line": ChartLine,
  "heart-pulse": HeartPulse,
};

const Trainers = ({ previewData }) => {
  const { data: queryData, isLoading } = useQuery({
    queryKey: ["public-trainers"],
    queryFn: async () => {
      const res = await getPublicTrainers();
      return res.data;
    },
    enabled: !previewData,
    staleTime: 5 * 60 * 1000,
  });

  const trainersList = previewData || queryData || [];
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive state
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Initial Scroll Animation
  useEffect(() => {
    if (!sectionRef.current || trainersList.length === 0) return;

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
        .fromTo("[data-gsap='trainer-content']",
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power2.out" },
          "-=0.3"
        );
    });

    return () => mm.revert();
  }, [trainersList.length]);

  // Touch handlers cho Swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const autoplayTimer = useRef(null);

  const startAutoplay = () => {
    if (autoplayTimer.current) clearInterval(autoplayTimer.current);
    if (isMobile && trainersList.length > 1) {
      autoplayTimer.current = setInterval(() => {
        handleNext();
      }, 4000);
    }
  };

  const stopAutoplay = () => {
    if (autoplayTimer.current) clearInterval(autoplayTimer.current);
  };

  useEffect(() => {
    startAutoplay();
    return () => stopAutoplay();
  }, [isMobile, trainersList.length, currentIndex]);

  const handleTouchStart = (e) => {
    stopAutoplay();
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) {
      startAutoplay();
      return;
    }
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    } else {
      startAutoplay();
    }

    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const slideTo = (newIndex, direction) => {
    if (isAnimating || newIndex === currentIndex) return;
    setIsAnimating(true);

    const outElement = containerRef.current.children[0]; // Cũ
    const inElement = containerRef.current.children[1];  // Mới (ẩn)

    // Chuẩn bị inElement
    gsap.set(inElement, {
      opacity: isMobile ? 1 : 0,
      xPercent: isMobile ? (direction === "next" ? 100 : -100) : (direction === "next" ? 50 : -50),
      display: "flex",
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
    });

    setCurrentIndex(newIndex);

    // Animation out
    gsap.to(outElement, {
      opacity: isMobile ? 1 : 0,
      xPercent: isMobile ? (direction === "next" ? -100 : 100) : (direction === "next" ? -50 : 50),
      duration: 0.6,
      ease: "power2.inOut",
    });

    // Animation in
    gsap.to(inElement, {
      opacity: 1,
      xPercent: 0,
      duration: 0.6,
      ease: "power2.inOut",
      onComplete: () => {
        gsap.set(inElement, { position: "relative" });
        gsap.set(outElement, { display: "none" });
        setIsAnimating(false);
        startAutoplay();
      }
    });
  };

  const handleNext = () => {
    if (trainersList.length <= 1) return;
    const nextIndex = (currentIndex + 1) % trainersList.length;
    slideTo(nextIndex, "next");
  };

  const handlePrev = () => {
    if (trainersList.length <= 1) return;
    const prevIndex = (currentIndex - 1 + trainersList.length) % trainersList.length;
    slideTo(prevIndex, "prev");
  };

  if (isLoading && !previewData) {
    return (
      <section className="max-w-5xl mx-auto my-12 bg-white rounded-2xl flex flex-wrap gap-10 p-8 shadow-lg min-h-[400px] items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </section>
    );
  }

  if (trainersList.length === 0) return null;

  const currentTrainer = trainersList[currentIndex];
  // Helper render 1 trainer card
  const renderTrainerCard = (trainer, isHidden = false) => (
    <div
      key={trainer._id || trainer.slug}
      className="w-full flex-col md:flex-row flex gap-10 bg-white"
      style={{ display: isHidden ? "none" : "flex" }}
    >
      <div className="flex-1 min-w-full md:min-w-75 mt-2 mb-6 md:mb-0">
        <img
          src={trainer.image || "https://placehold.co/600x400/eeeeee/999999?text=No+Image"}
          alt={trainer.name}
          loading="lazy"
          className="w-full aspect-[3/4] md:aspect-auto md:h-full max-h-[500px] rounded-2xl object-cover shadow-sm"
        />
      </div>

      <div className="flex-2 min-w-full md:min-w-125 mt-8 md:mt-0 flex flex-col justify-center">
        <div>
          <h3 className="text-2xl font-bold uppercase text-slate-800">{trainer.name}</h3>
          {(trainer.title || trainer.experience) && (
            <h4 className="text-base sm:text-lg text-black font-semibold mt-2">
              {trainer.title} {trainer.title && trainer.experience && " | "} {trainer.experience}
            </h4>
          )}
          <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-5 mt-2 whitespace-pre-line">
            {trainer.bio}
          </p>
        </div>

        {trainer.specialties && trainer.specialties.length > 0 && (
          <div className="flex flex-col gap-4 mb-6">
            {trainer.specialties.map((spec, i) => {
              const IconComp = iconMap[spec.icon] || Dumbbell;
              return (
                <div key={i} className="flex items-center gap-3 bg-blue-50/80 border border-blue-100 p-3.5 rounded-xl transition-all hover:bg-blue-100 hover:-translate-y-1 hover:shadow-md">
                  <div className="bg-white p-2 rounded-lg text-primary shadow-sm">
                    <IconComp size={20} />
                  </div>
                  <span className="font-bold text-slate-700 text-sm md:text-base">
                    {spec.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <a
          href="#contact"
          className="inline-flex items-center justify-center w-fit gap-2 px-8 py-3.5 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary-dark hover:-translate-y-1 transition-all"
        >
          <ArrowRight size={18} />
          Liên hệ tư vấn cùng HLV {trainer.name.split(" ").pop()}!
        </a>
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      id="trainers"
      className="max-w-5xl mx-auto my-12 bg-white rounded-2xl p-8 shadow-xl overflow-hidden relative"
    >
      <div className="container-custom p-0!">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-center md:text-left uppercase m-0" data-gsap="title">
            ĐỘI NGŨ HUẤN LUYỆN VIÊN
          </h2>
          {trainersList.length > 1 && (
            <div className="hidden md:flex gap-3">
              <button
                onClick={handlePrev}
                disabled={isAnimating}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-100 hover:bg-primary hover:text-white transition-colors text-slate-600 disabled:opacity-50"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={handleNext}
                disabled={isAnimating}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-100 hover:bg-primary hover:text-white transition-colors text-slate-600 disabled:opacity-50"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          )}
        </div>

        <div
          className="relative w-full overflow-hidden"
          data-gsap="trainer-content"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div ref={containerRef} className="relative w-full flex">
            {/* Element hiện tại */}
            {renderTrainerCard(currentTrainer, false)}
            
            {/* Element cho animation (ẩn mặc định) */}
            {trainersList.length > 1 && renderTrainerCard(trainersList[(currentIndex + 1) % trainersList.length], true)}
          </div>
        </div>

        {/* Dots cho Mobile */}
        {trainersList.length > 1 && (
          <div className="flex md:hidden justify-center gap-2 mt-8">
            {trainersList.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (idx > currentIndex) slideTo(idx, "next");
                  else if (idx < currentIndex) slideTo(idx, "prev");
                }}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  idx === currentIndex ? "bg-primary w-6" : "bg-slate-300"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Trainers;

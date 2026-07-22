import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Calculator, Utensils, CalendarDays, ArrowRight, Dumbbell } from "lucide-react";
import toolImg1 from "../assets/images/hero/hero1.webp";
import toolImg2 from "../assets/images/hero/hero2.webp";
import toolImg3 from "../assets/images/hero/hero3.webp";
import toolImg4 from "../assets/images/classes/class1.jpg";

gsap.registerPlugin(ScrollTrigger);

const Tools = ({ image }) => {
  const { t } = useTranslation("home");
  const displayImage = image || toolImg1;
  const sectionRef = useRef(null);
  const tdeeRef = useRef(null);
  const sideCardsRef = useRef(null);
  const exerciseRef = useRef(null);
  const recipeRef = useRef(null);
  const mealplanRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ctx = gsap.context(() => {
      const isDesktop = window.innerWidth >= 768;

      if (isDesktop) {
        // Trạng thái ban đầu: Thẻ TDEE full width, giấu thẻ phụ
        gsap.set(tdeeRef.current, { width: "100%" });
        gsap.set(sideCardsRef.current, { display: "none", width: "0%", opacity: 0 });
        
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 40%", // Bắt đầu khi section lên gần giữa màn hình
            once: true,
          }
        });

        // Bung thẻ TDEE nhỏ lại 50% và hiện grid phụ
        tl.to(tdeeRef.current, { width: "calc(50% - 12px)", duration: 1.2, ease: "power3.inOut" }, 0)
          .set(sideCardsRef.current, { display: "grid" }, 0)
          .to(sideCardsRef.current, { width: "calc(50% - 12px)", opacity: 1, duration: 1.2, ease: "power3.inOut" }, 0)
          // Nhảy 3 thẻ con lên
          .fromTo(exerciseRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "back.out(1.5)" }, 0.4)
          .fromTo(recipeRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "back.out(1.5)" }, 0.6)
          .fromTo(mealplanRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "back.out(1.5)" }, 0.8);
      } else {
        // Mobile Animation
        gsap.set(sideCardsRef.current, { display: "grid", width: "100%", opacity: 1 });
        
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 50%",
            once: true,
          }
        });

        tl.fromTo(tdeeRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" })
          .fromTo(exerciseRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, "-=0.4")
          .fromTo(recipeRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, "-=0.4")
          .fromTo(mealplanRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, "-=0.4");
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="tools" className="py-12 md:py-24 px-4 md:px-5 flex justify-center bg-gray-50/50">
      <div className="container max-w-[1200px]">
        
        {/* Title */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-primary uppercase font-bold text-3xl md:text-4xl mb-4">{t("tools.title")}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm md:text-base">{t("tools.subtitle")}</p>
        </div>

        {/* Bento Grid */}
        <div className="flex flex-col md:flex-row gap-5 md:gap-6 h-auto md:h-[550px] w-full">
          
          {/* TDEE Card (Thẻ bự) */}
          <div ref={tdeeRef} className="relative rounded-3xl overflow-hidden w-full h-[400px] md:h-full group shadow-xl">
            <img src={displayImage} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="TDEE Tool" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-colors duration-300" />
            
            <div className="absolute inset-0 p-8 md:p-12 flex flex-col justify-end">
              <div className="bg-primary/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-primary/30">
                <Calculator className="text-primary w-7 h-7" />
              </div>
              <h3 className="text-white text-2xl md:text-3xl font-bold mb-3 uppercase tracking-wide">
                {t("tools.tdee_title")}
              </h3>
              <p className="text-gray-300 mb-8 max-w-lg leading-relaxed text-sm md:text-base">
                {t("tools.tdee_desc")}
              </p>
              <div>
                <Link
                  to="/tdee-calculator"
                  className="inline-flex items-center gap-2 bg-primary text-white font-semibold hover:bg-[#d67b0b] px-8 py-3.5 rounded-full transition-all duration-300 transform group-hover:translate-x-2 shadow-[0_0_15px_rgba(255,90,31,0.4)]"
                >
                  {t("tools.tdee_cta")} <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Side Cards Container (Thẻ nhỏ hiện ra) */}
          <div ref={sideCardsRef} className="grid grid-cols-2 grid-rows-2 gap-5 md:gap-6 w-full md:w-[0%] h-auto md:h-full opacity-0">
            
            {/* Exercise Card */}
            <div ref={exerciseRef} className="relative rounded-3xl overflow-hidden col-span-2 group shadow-xl h-[250px] md:h-auto">
              <img src={toolImg4} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Exercises" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-colors duration-300" />
              
              <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
                <div className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/20">
                  <Dumbbell className="text-white w-6 h-6" />
                </div>
                <h3 className="text-white text-xl font-bold mb-2 uppercase">{t("tools.exercise_title")}</h3>
                <p className="text-gray-300 text-sm mb-5 line-clamp-2">{t("tools.exercise_desc")}</p>
                <div>
                  <Link
                    to="/exercises"
                    className="inline-flex items-center gap-2 text-white font-semibold hover:text-primary transition-colors text-sm"
                  >
                    {t("tools.exercise_cta")} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Recipe Card */}
            <div ref={recipeRef} className="relative rounded-3xl overflow-hidden col-span-2 md:col-span-1 group shadow-xl h-[250px] md:h-auto">
              <img src={toolImg2} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Recipe" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-colors duration-300" />
              
              <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
                <div className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/20">
                  <Utensils className="text-white w-6 h-6" />
                </div>
                <h3 className="text-white text-xl font-bold mb-2 uppercase">{t("tools.recipe_title")}</h3>
                <p className="text-gray-300 text-sm mb-5 line-clamp-2">{t("tools.recipe_desc")}</p>
                <div>
                  <Link
                    to="/cong-thuc-nau-an"
                    className="inline-flex items-center gap-2 text-white font-semibold hover:text-primary transition-colors text-sm"
                  >
                    {t("tools.recipe_cta")} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Meal Plan Card */}
            <div ref={mealplanRef} className="relative rounded-3xl overflow-hidden col-span-2 md:col-span-1 group shadow-xl h-[250px] md:h-auto">
              <img src={toolImg3} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Meal Plan" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-colors duration-300" />
              
              <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
                <div className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/20">
                  <CalendarDays className="text-white w-6 h-6" />
                </div>
                <h3 className="text-white text-xl font-bold mb-2 uppercase">{t("tools.mealplan_title")}</h3>
                <p className="text-gray-300 text-sm mb-5 line-clamp-2">{t("tools.mealplan_desc")}</p>
                <div>
                  <Link
                    to="/mealplan"
                    className="inline-flex items-center gap-2 text-white font-semibold hover:text-primary transition-colors text-sm"
                  >
                    {t("tools.mealplan_cta")} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default Tools;

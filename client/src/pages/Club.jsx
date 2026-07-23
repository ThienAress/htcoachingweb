import React, { useState, useEffect, useRef } from "react";
import { MapPin, ArrowRight, Clock, ExternalLink, Loader2, Search, Star, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "../sections/Header/Header";
import Footer from "../sections/Footer/Footer";
import Contact from "../sections/Contact";
import ChatIcons from "../components/ChatIcons";
import ScrollToTop from "../components/ScrollToTop";
import SEO from "../components/SEO";
import { useTranslation, Trans } from "react-i18next";
import { getGyms, getDistricts } from "../services/gym.service";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const Club = () => {
  const { t } = useTranslation("club");
  const [selectedDistrict, setSelectedDistrict] = useState("Tất cả");
  const [searchTerm, setSearchTerm] = useState("");
  const titleRef = useRef(null);
  const gridRef = useRef(null);

  const { data: districtsData = [] } = useQuery({
    queryKey: ["gym-districts"],
    queryFn: () => getDistricts().then((res) => res.data.data),
  });

  const { data: gymsData, isLoading } = useQuery({
    queryKey: ["public-gyms", selectedDistrict],
    queryFn: () => getGyms(selectedDistrict).then((res) => res.data.data),
  });

  const filteredGyms = gymsData?.filter((club) =>
    !searchTerm ||
    club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    club.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // GSAP animations
  useEffect(() => {
    if (isLoading || !gymsData) return;
    // Skip animations if user prefers reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      if (titleRef.current) {
        gsap.from(titleRef.current, {
          y: -20,
          opacity: 0,
          duration: 0.7,
          ease: "power2.out",
        });
      }

      if (gridRef.current) {
        const cards = gridRef.current.querySelectorAll(".club-card");
        if (cards.length) {
          gsap.fromTo(cards,
            { y: 40, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.6,
              stagger: 0.08,
              ease: "power2.out",
              scrollTrigger: {
                trigger: gridRef.current,
                start: "top 90%",
                once: true,
              },
            }
          );
        }
      }
    });

    return () => ctx.revert();
  }, [gymsData, isLoading]);

  return (
    <>
      <SEO
        title={t("seo.title")}
        description={t("seo.description")}
        canonical="/club"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SportsActivityLocation",
          "name": t("seo.schema_name"),
          "description": t("seo.schema_desc"),
          "url": "https://htcoachingweb.io.vn/club",
          "provider": {
            "@type": "Organization",
            "name": "HTCOACHING",
            "url": "https://htcoachingweb.io.vn"
          }
        }}
      />
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white pt-28 pb-8">
        <div className="container-custom">
          {/* Header section */}
          <div ref={titleRef} className="text-center mb-10">
            <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-4">
              <MapPin className="text-primary w-6 h-6" />
              <span className="font-semibold text-primary tracking-wide">
                {t("header.tag")}
              </span>
            </div>
            <h1 className="font-display text-fluid-5xl font-black uppercase tracking-normal">
              <Trans t={t} i18nKey="header.title">CÂU LẠC BỘ <span className="text-primary">PT CÓ THỂ VÀO DẠY</span></Trans>
            </h1>
            <div className="w-24 h-1 bg-primary mx-auto mt-4 rounded-full"></div>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">
              {t("header.subtitle")}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder={t("filters.search_placeholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 rounded-xl bg-gray-800/60 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition min-w-[260px] text-sm backdrop-blur-sm"
              />
            </div>
            <select
              id="district-filter"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-gray-800/60 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition min-w-[200px] text-sm backdrop-blur-sm"
            >
              <option value="Tất cả">{t("filters.all_areas")}</option>
              {districtsData.map((d, index) => (
                <option key={index} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {filteredGyms && (
              <span className="text-xs text-gray-500 font-medium">
                {t("filters.gyms_count", { count: filteredGyms.length })}
              </span>
            )}
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : (
            <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGyms?.map((club) => (
                <div
                  key={club._id}
                  className="club-card group bg-gray-800/40 backdrop-blur-sm border border-gray-700/60 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 rounded-2xl relative flex flex-col"
                >
                  {/* Image */}
                  <div className="relative overflow-hidden">
                    <img
                      src={club.image}
                      alt={club.name}
                      loading="lazy"
                      className="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent"></div>

                    {/* KickFit badge trên ảnh */}
                    {club.hasKickfit && (
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg z-10 uppercase tracking-wider">
                        <Star className="w-3 h-3 fill-white" />
                        {t("card.has_kickfit")}
                      </div>
                    )}

                    {/* Giờ mở cửa overlay */}
                    {club.openingHours && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full">
                        <Clock className="w-3 h-3 text-primary" />
                        {club.openingHours}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-lg text-white font-bold mb-3 uppercase leading-tight group-hover:text-primary transition-colors">
                      {club.name}
                    </h3>

                    <div className="space-y-2.5 mb-5 flex-1">
                      <p className="flex items-start gap-2 text-gray-400 text-sm">
                        <MapPin size={16} className="text-primary shrink-0 mt-0.5" />
                        <span>{club.address}</span>
                      </p>
                      {club.hasKickfit && (
                        <p className="flex items-center gap-2 text-orange-400 text-xs font-semibold">
                          <Flame size={14} className="shrink-0" />
                          <span>{t("card.has_kickfit")}</span>
                        </p>
                      )}
                      {club.note && (
                        <p className="text-gray-500 text-xs italic pl-6">
                          {club.note}
                        </p>
                      )}
                    </div>

                    {club.googleMapsUrl && (
                      <a
                        href={club.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto flex justify-center items-center gap-2 w-full py-2.5 bg-gray-700/40 hover:bg-primary/20 text-gray-300 hover:text-primary font-semibold rounded-xl border border-gray-700 hover:border-primary/40 transition-all duration-300 text-sm"
                      >
                        {t("card.view_on_map")} <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {filteredGyms?.length === 0 && (
                <div className="col-span-full py-20 text-center text-gray-500">
                  {t("card.no_results")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Internal Links Section */}
        <section className="mt-20 py-12 px-5 border-t border-gray-800">
          <div className="container-custom">
            <h2 className="text-center text-2xl font-bold mb-8 uppercase text-white">{t("explore.title")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <Link to="/ket-qua-khach-hang" className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all">
                <span className="text-3xl">🏆</span>
                <span className="font-semibold text-gray-300 group-hover:text-primary transition-colors">{t("explore.customer_results")}</span>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-primary transition-colors" />
              </Link>
              <Link to="/exercises" className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all">
                <span className="text-3xl">💪</span>
                <span className="font-semibold text-gray-300 group-hover:text-primary transition-colors">{t("explore.exercises")}</span>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-primary transition-colors" />
              </Link>
              <Link to="/tdee-calculator" className="group flex flex-col items-center gap-3 p-6 rounded-xl border border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all">
                <span className="text-3xl">📊</span>
                <span className="font-semibold text-gray-300 group-hover:text-primary transition-colors">{t("explore.tdee")}</span>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-primary transition-colors" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Contact />
      <Footer />
      <ChatIcons />
      <ScrollToTop />
    </>
  );
};

export default Club;

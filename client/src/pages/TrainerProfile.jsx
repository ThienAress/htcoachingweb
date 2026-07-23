// eslint-disable-next-line no-unused-vars
import { useEffect, useState, useRef, useMemo } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";
import UpdatingText from "../components/UpdatingText";
import { useQuery } from "@tanstack/react-query";
import { getPublicTrainerBySlug } from "../services/trainer.service";
import { getPublicCustomerStories } from "../services/customerStory.service";
import { translateData } from "../utils/localDataTranslator";
import lemon8Logo from "../assets/images/lemon8/lemon8.svg";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  CheckCircle2,
  Flame,
  Play,
  MessageCircle,
  Brain,
  Salad,
  Award,
  Trophy,
  Quote,
  Eye
} from "lucide-react";
import SEO from "../components/SEO";
import ScrollToTop from "../components/ScrollToTop";

/* ==========================================
   Component: Gallery ảnh HLV (tối đa 3 ảnh)
   ========================================== */
const TrainerGallery = ({ images, name }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const allImages = images?.length > 0 ? images : [];

  useEffect(() => {
    if (allImages.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % allImages.length);
    }, 3500); // 3.5 seconds
    return () => clearInterval(interval);
  }, [allImages.length]);

  if (allImages.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Ảnh chính lớn */}
      <div className="relative aspect-[4/5] md:aspect-square lg:aspect-[4/5] bg-slate-800 shadow-2xl rounded-2xl overflow-hidden group">
        {allImages.map((img, idx) => (
          <img
            key={idx}
            src={img}
            alt={`${name} - Ảnh ${idx + 1}`}
            loading={idx === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === activeIdx ? "opacity-100 z-10" : "opacity-0 z-0"}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-8 z-20 pointer-events-none">
          <div>
            <h2 className="text-fluid-3xl font-black text-white uppercase">{name}</h2>
          </div>
        </div>

        {/* Nút chuyển ảnh */}
        {allImages.length > 1 && (
          <div className="absolute inset-0 z-30 pointer-events-none">
            <button
              onClick={() => setActiveIdx((prev) => (prev - 1 + allImages.length) % allImages.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 pointer-events-auto"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setActiveIdx((prev) => (prev + 1) % allImages.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 pointer-events-auto"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ==========================================
   Component: FAQ Accordion
   ========================================== */
const AccordionItem = ({ question, answer, isOpen, onClick }) => (
  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white mb-4">
    <button onClick={onClick} className="w-full flex items-center justify-between p-5 text-left bg-white transition-colors hover:bg-slate-50">
      <span className="font-bold text-slate-800 text-lg pr-4">{question}</span>
      <div className={`shrink-0 h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-primary transition-transform duration-300 ${isOpen ? 'rotate-180 bg-primary/10' : ''}`}>
        <ChevronDown size={20} />
      </div>
    </button>
    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="p-5 pt-0 text-slate-600 leading-relaxed">{answer}</div>
    </div>
  </div>
);

/* ==========================================
   Component: Customer Grid Card (UI theo mẫu)
   ========================================== */
const CustomerCard = ({ story }) => {
  const { t } = useTranslation("trainer");
  const beforeSrc = Array.isArray(story.beforeImg) ? story.beforeImg[0] : story.beforeImg;
  const afterSrc = Array.isArray(story.afterImg) ? story.afterImg[0] : story.afterImg;

  return (
    <div className="group relative bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden hover:border-primary/60 transition-all duration-300 shadow-xl hover:shadow-primary/5 flex flex-col justify-between">
      <div>
        {/* Ảnh Before / After cạnh nhau */}
        <div className="flex relative overflow-hidden aspect-[4/3]">
          {/* Before */}
          <div className="flex-1 relative overflow-hidden bg-neutral-950">
            {beforeSrc ? (
              <img
                src={beforeSrc}
                alt="Before"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-950 min-h-[120px]">
                <UpdatingText className="text-[10px] text-slate-500" />
              </div>
            )}
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[9px] font-black px-2.5 py-1 rounded border border-white/10 uppercase tracking-wider z-20">
              {t("customer_card.before")}
            </div>
          </div>

          {/* Divider mỏng */}
          <div className="w-[1px] bg-white/10 shrink-0 relative z-10"></div>

          {/* After */}
          <div className="flex-1 relative overflow-hidden bg-neutral-950">
            {afterSrc ? (
              <img
                src={afterSrc}
                alt="After"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-950 min-h-[120px]">
                <UpdatingText className="text-[10px] text-slate-500" />
              </div>
            )}
            <div className="absolute bottom-3 right-3 bg-primary text-white text-[9px] font-black px-2.5 py-1 rounded border border-primary/20 uppercase tracking-wider z-20">
              {t("customer_card.after")}
            </div>
          </div>

          {/* Hover Overlay */}
          <Link
            to={`/ket-qua-khach-hang/${story.slug}`}
            className="absolute inset-0 flex items-center justify-center bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30"
          >
            <span className="flex items-center gap-2 bg-primary text-white font-black text-xs px-5 py-2.5 rounded-lg shadow-lg transform scale-90 group-hover:scale-100 transition-all duration-300 uppercase tracking-wider border border-primary-dark">
              <Eye size={14} /> {t("actions.detail_view")}
            </span>
          </Link>
        </div>

        {/* Nội dung thông tin học viên */}
        <div className="p-4 flex flex-col justify-between">
          <div>
            <h4 className="font-black text-white text-base truncate group-hover:text-primary transition-colors uppercase">
              {story.name}
            </h4>
            {story.age && (
              <p className="text-slate-400 text-sm font-medium mt-0.5">
                {story.age} {t("customer_card.age_suffix")}
              </p>
            )}
            {story.result && (
              <p className="mt-1.5 text-xs font-black uppercase text-primary tracking-wide">
                🔥 {story.result}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer chứa thời gian */}
      {story.duration && (
        <div className="border-t border-white/5 bg-neutral-950/60 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-400">
          <span>{t("customer_card.duration_label")}</span>
          <span className="text-white font-bold">{story.duration}</span>
        </div>
      )}
    </div>
  );
};

/* ==========================================
   Icon map cho specialties
   ========================================== */
const iconMap = {
  "dumbbell": Dumbbell,
  "utensils": Salad,
  "chart-line": Brain,
  "heart-pulse": Award,
};

/* ==========================================
   TRANG CHÍNH: Trainer Profile
   ========================================== */
const TrainerProfile = ({ previewData }) => {
  const { t, i18n } = useTranslation("trainer");
  const { slug } = useParams();
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const { data: trainerResponse, isLoading: isLoadingTrainer } = useQuery({
    queryKey: ["public-trainer-detail", slug, i18n.language],
    queryFn: () => getPublicTrainerBySlug(slug, { lang: i18n.language }),
    retry: false,
    enabled: !previewData,
  });

  const trainerRaw = previewData || trainerResponse?.data;
  const trainer = useMemo(() => translateData(trainerRaw, "trainer", i18n.language), [trainerRaw, i18n.language]);

  const { data: storiesResponse } = useQuery({
    queryKey: ["public-customer-stories", { trainerId: trainer?._id }, i18n.language],
    queryFn: () => getPublicCustomerStories({ trainerId: trainer?._id, limit: 50, lang: i18n.language }),
    enabled: !!trainer?._id && !previewData,
  });

  const stories = useMemo(
    () =>
      translateData(
        previewData ? [] : (storiesResponse?.data || []),
        "story",
        i18n.language,
      ),
    [i18n.language, previewData, storiesResponse?.data],
  );

  // Backward compatible: dùng images[] nếu có, fallback image cũ
  const trainerImages = trainer?.images?.length > 0
    ? trainer.images
    : (trainer?.image ? [trainer.image] : []);

  if (!previewData && isLoadingTrainer) {
    return (
      <main className="min-h-screen bg-[#1a1a1a] pt-32">
        <div className="container-custom flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </main>
    );
  }

  if (!trainer) return <Navigate to="/#trainers" replace />;

  const zaloLink = trainer.socialLinks?.zalo
    ? (trainer.socialLinks.zalo.startsWith('http') ? trainer.socialLinks.zalo : `https://zalo.me/${trainer.socialLinks.zalo}`)
    : null;

  const hasSocialLinks = trainer.socialLinks && (
    trainer.socialLinks.facebook || trainer.socialLinks.instagram ||
    trainer.socialLinks.tiktok || zaloLink ||
    trainer.socialLinks.lemon8 || trainer.socialLinks.threads
  );

  return (
    <main className="bg-slate-100 min-h-screen font-sans">
      {(() => {
        const personSchema = {
          "@type": "Person",
          "name": trainer.name,
          "jobTitle": trainer.title || "Huấn Luyện Viên Cá Nhân",
          "description": trainer.headline || trainer.bio || `Huấn luyện viên ${trainer.name} tại HTCOACHING`,
          "image": trainerImages[0] || "",
          "url": `https://htcoachingweb.io.vn/huan-luyen-vien/${trainer.slug}`,
          "worksFor": { "@type": "Organization", "name": "HTCOACHING" }
        };
        const graph = [personSchema];
        if (trainer.faqs?.length > 0) {
          graph.push({
            "@type": "FAQPage",
            "mainEntity": trainer.faqs.map(faq => ({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": { "@type": "Answer", "text": faq.answer }
            }))
          });
        }
        graph.push({
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Trang chủ", "item": "https://htcoachingweb.io.vn/" },
            { "@type": "ListItem", "position": 2, "name": "Huấn Luyện Viên", "item": "https://htcoachingweb.io.vn/#trainers" },
            { "@type": "ListItem", "position": 3, "name": trainer.name }
          ]
        });
        return (
          <SEO
            title={`${trainer.name} - ${trainer.title || t("seo.default_title")} | HTCOACHING`}
            description={trainer.headline || trainer.bio || t("seo.default_description")}
            image={trainerImages[0]}
            canonical={`/huan-luyen-vien/${trainer.slug}`}
            jsonLd={{ "@context": "https://schema.org", "@graph": graph }}
          />
        );
      })()}

      {/* =============================================
          1. HERO SECTION — Nền tối, Gallery ảnh
          ============================================= */}
      <section className="bg-[#1a1a1a] pt-32 md:pt-40 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none blur-3xl"></div>

        <div className="container-custom relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">

            {/* Cột thông tin */}
            <div className="order-2 lg:order-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary font-bold text-sm tracking-wide border border-primary/30 rounded-full">
                🥇 {trainer.title || t("status.professional_trainer")}
              </div>

              <h1 className="text-fluid-6xl font-black text-white leading-[1.1] uppercase">
                {trainer.headline || trainer.name}
              </h1>

              {/* Châm ngôn (Motto) */}
              {trainer.motto && (
                <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-4">
                  <Quote size={20} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-lg text-slate-200 italic font-medium leading-relaxed">"{trainer.motto}"</p>
                </div>
              )}

              {/* Phong cách huấn luyện */}
              {trainer.trainingStyle && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-primary tracking-[0.15em] uppercase">{t("sections.training_style")}</h3>
                  <p className="text-slate-300 leading-relaxed border-l-2 border-primary/50 pl-4 py-1">{trainer.trainingStyle}</p>
                </div>
              )}

              {trainer.stats?.length > 0 && <hr className="border-white/10" />}

              {/* Stats */}
              {trainer.stats?.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-12 gap-y-6">
                  {trainer.stats.map((stat, idx) => (
                    <div key={idx} className="flex flex-col">
                      <span className="text-4xl font-black text-white">{stat.value}</span>
                      <span className="text-sm font-semibold text-primary mt-1">{stat.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {(trainer.achievements?.length > 0 || trainer.specialties?.length > 0) && <hr className="border-white/10" />}

              {/* Thành tích nổi bật */}
              {trainer.achievements?.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 tracking-[0.15em] uppercase">
                    {t("sections.achievements")}
                  </h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {trainer.achievements.map((ach, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        <span className="text-slate-300 text-sm leading-relaxed">{ach}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {trainer.specialties?.length > 0 && trainer.achievements?.length > 0 && <hr className="border-white/10" />}

              {/* Chuyên môn */}
              {trainer.specialties?.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 tracking-[0.15em] uppercase">{t("sections.specialties")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {trainer.specialties.map((spec, i) => {
                      const IconComp = iconMap[spec.icon] || Dumbbell;
                      return (
                        <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full hover:bg-primary hover:border-primary transition-colors cursor-default group">
                          <IconComp size={16} className="text-primary group-hover:text-white transition-colors" />
                          <span className="font-semibold text-white text-sm">{spec.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {trainer.certifications?.length > 0 && <hr className="border-white/10" />}

              {/* Chứng chỉ */}
              {trainer.certifications?.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 tracking-[0.15em] uppercase">{t("sections.certifications")}</h3>
                  <div className="space-y-2">
                    {trainer.certifications.map((cert, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-slate-300 text-sm leading-relaxed font-medium">{cert}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  to="/#contact"
                  className="inline-flex items-center justify-center bg-primary text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary-dark transition-colors shadow-xl shadow-primary/30 gap-2"
                >
                  <Dumbbell size={20} /> {t("actions.free_consultation")}
                </Link>
                {stories.length > 0 && (
                  <a
                    href="#customer-results"
                    className="inline-flex items-center justify-center bg-white/10 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition-colors gap-2 border border-white/10"
                  >
                    {t("actions.view_results")} <Play size={18} className="fill-white" />
                  </a>
                )}
              </div>

              {/* Social Links */}
              {hasSocialLinks && (
                <div className="flex items-center gap-3 pt-2">
                  {trainer.socialLinks.facebook && (
                    <a href={trainer.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2] transition-all" title="Facebook">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                  )}
                  {trainer.socialLinks.instagram && (
                    <a href={trainer.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-[#E1306C] hover:text-white hover:border-[#E1306C] transition-all" title="Instagram">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    </a>
                  )}
                  {trainer.socialLinks.tiktok && (
                    <a href={trainer.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-[#010101] hover:text-white hover:border-white/10 transition-all" title="TikTok">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                    </a>
                  )}
                  {zaloLink && (
                    <a href={zaloLink} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-[#0068FF] hover:border-[#0068FF] transition-all" title="Zalo">
                      <svg className="w-6 h-6" viewBox="0 0 48 48"><path fill="#2962ff" d="M15,36V6.827l-1.211-0.811C8.64,8.083,5,13.112,5,19v10c0,7.732,6.268,14,14,14h10c4.722,0,8.883-2.348,11.417-5.931V36H15z"/><path fill="#eee" d="M29,5H19c-1.845,0-3.601,0.366-5.214,1.014C10.453,9.25,8,14.528,8,19c0,6.771,0.936,10.735,3.712,14.607c0.216,0.301,0.357,0.653,0.376,1.022c0.043,0.835-0.129,2.365-1.634,3.742c-0.162,0.148-0.059,0.419,0.16,0.428c0.942,0.041,2.843-0.014,4.797-0.877c0.557-0.246,1.191-0.203,1.729,0.083C20.453,39.764,24.333,40,28,40c4.676,0,9.339-1.04,12.417-2.916C42.038,34.799,43,32.014,43,29V19C43,11.268,36.732,5,29,5z"/><path fill="#2962ff" d="M36.75,27C34.683,27,33,25.317,33,23.25s1.683-3.75,3.75-3.75s3.75,1.683,3.75,3.75S38.817,27,36.75,27z M36.75,21c-1.24,0-2.25,1.01-2.25,2.25s1.01,2.25,2.25,2.25S39,24.49,39,23.25S37.99,21,36.75,21z"/><path fill="#2962ff" d="M31.5,27h-1c-0.276,0-0.5-0.224-0.5-0.5V18h1.5V27z"/><path fill="#2962ff" d="M27,19.75v0.519c-0.629-0.476-1.403-0.769-2.25-0.769c-2.067,0-3.75,1.683-3.75,3.75S22.683,27,24.75,27c0.847,0,1.621-0.293,2.25-0.769V26.5c0,0.276,0.224,0.5,0.5,0.5h1v-7.25H27z M24.75,25.5c-1.24,0-2.25-1.01-2.25-2.25S23.51,21,24.75,21S27,22.01,27,23.25S25.99,25.5,24.75,25.5z"/><path fill="#2962ff" d="M21.25,18h-8v1.5h5.321L13,26h0.026c-0.163,0.211-0.276,0.463-0.276,0.75V27h7.5c0.276,0,0.5-0.224,0.5-0.5v-1h-5.321L21,19h-0.026c0.163-0.211,0.276-0.463,0.276-0.75V18z"/></svg>
                    </a>
                  )}
                  {trainer.socialLinks.lemon8 && (
                    <a href={trainer.socialLinks.lemon8} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-[#FFE030] hover:text-black hover:border-[#FFE030] transition-all" title="Lemon8">
                      <img src={lemon8Logo} alt="Lemon8" className="w-5 h-5" />
                    </a>
                  )}
                  {trainer.socialLinks.threads && (
                    <a href={trainer.socialLinks.threads} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-white hover:text-black hover:border-white transition-all" title="Threads">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16"><path d="M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161"/></svg>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Cột Gallery ảnh */}
            <div className="order-1 lg:order-2">
              <TrainerGallery images={trainerImages} name={trainer.name} />
            </div>

          </div>
        </div>
      </section>

      {/* =============================================
          VIDEO INTRO
          ============================================= */}
      {trainer.videoIntro && (
        <section className="py-20 bg-white">
          <div className="container-custom max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-slate-900 uppercase">{t("sections.video_intro")}</h2>
              <p className="text-lg text-slate-500 font-medium mt-4">{t("sections.video_desc")}</p>
            </div>
            <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
              {trainer.videoIntro.includes("youtube.com") || trainer.videoIntro.includes("youtu.be") ? (
                <iframe
                  src={trainer.videoIntro.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                  className="w-full h-full"
                  allowFullScreen
                  loading="lazy"
                  title={`${t("sections.video_intro")} ${trainer.name}`}
                />
              ) : (
                <video src={trainer.videoIntro} controls className="w-full h-full object-contain bg-black" />
              )}
            </div>
          </div>
        </section>
      )}

      {/* =============================================
          2. PHƯƠNG PHÁP CỦA TÔI (DYNAMIC)
          ============================================= */}
      {trainer.methodologies?.length > 0 && (
        <section className="py-24 bg-white relative overflow-hidden text-slate-900 border-t border-slate-200">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000000 2px, transparent 2px)', backgroundSize: '32px 32px' }}></div>
          
          <div className="container-custom relative z-10">
            <div className="text-center mb-20">
              <span className="text-xs font-black uppercase tracking-[0.25em] text-primary bg-primary/10 px-4 py-2 rounded-full border border-primary/20 shadow-sm">
                {t("sections.methodology")}
              </span>
              <h2 className="text-fluid-6xl font-black uppercase text-slate-900 mt-6 tracking-tight drop-shadow-sm">
                <Trans t={t} i18nKey="sections.methodology_title">TRỤ CỘT <span className="text-primary">MÁU LỬA</span></Trans>
              </h2>
              <div className="h-1.5 w-24 bg-primary mx-auto mt-6 rounded-full opacity-80"></div>
              <p className="text-slate-500 font-bold mt-6 max-w-xl mx-auto text-fluid-base">
                {t("sections.methodology_desc")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {trainer.methodologies.map((method, index) => (
                <div 
                  key={index} 
                  className="bg-white border border-slate-200 rounded-2xl p-8 hover:border-primary/50 transition-all duration-300 group relative overflow-hidden hover:-translate-y-2 shadow-xl hover:shadow-primary/10"
                >
                  {/* Số thứ tự lớn chìm phía sau */}
                  <div className="absolute -right-4 -bottom-6 text-[140px] leading-none font-black text-slate-100 select-none pointer-events-none group-hover:text-primary/10 transition-colors duration-500">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      {/* Icon hoặc Số thứ tự góc cạnh */}
                      <div className="w-14 h-14 bg-primary/10 backdrop-blur-sm border border-primary/20 text-primary font-black text-xl rounded-xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                        {index + 1}
                      </div>
                      <h3 className="text-2xl font-black uppercase text-slate-900 mb-4 tracking-wide group-hover:text-primary transition-colors">
                        {method.title}
                      </h3>
                      <p className="text-slate-600 leading-relaxed font-semibold text-sm">
                        {method.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* =============================================
          3. KẾT QUẢ KHÁCH HÀNG — Grid Before/After
          Hiển thị TẤT CẢ khách hàng của HLV
          ============================================= */}
      {stories.length > 0 && (
        <section id="customer-results" className="py-20 bg-[#1a1a1a] relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>

          <div className="container-custom relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black uppercase text-white tracking-wider">{t("sections.customer_results")}</h2>
              <p className="text-lg text-slate-400 mt-4">
                <Trans t={t} i18nKey="sections.customer_results_desc" values={{ name: trainer.name }}>
                  Những học viên đã tin tưởng và lột xác cùng <span className="text-primary font-bold">{trainer.name}</span>
                </Trans>
              </p>
            </div>

            {/* Grid 3 cột */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stories.map((story) => (
                <CustomerCard key={story._id} story={story} />
              ))}
            </div>

            {/* Link xem tất cả */}
            <div className="text-center mt-12">
              <Link
                to="/ket-qua-khach-hang"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-primary text-white font-bold hover:bg-primary transition-colors uppercase tracking-widest"
              >
                {t("sections.view_all_stories")} <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* =============================================
          4. HỎI ĐÁP (FAQ)
          ============================================= */}
      {trainer.faqs?.length > 0 && (
        <section className="py-20 bg-white">
          <div className="container-custom max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black uppercase text-slate-900">{t("sections.faqs")}</h2>
              <p className="text-lg text-slate-500 mt-4 font-medium">{t("sections.faqs_desc")}</p>
            </div>

            <div className="space-y-2">
              {trainer.faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openFaqIndex === index}
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? -1 : index)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Internal Linking — SEO Hub */}
      <section className="py-14 bg-slate-100 border-t border-slate-200">
        <div className="container-custom">
          <h2 className="text-center text-3xl font-black uppercase text-slate-900 mb-2">
            <Trans t={t} i18nKey="explore.title">Khám phá <span className="text-primary">thêm</span></Trans>
          </h2>
          <p className="text-center text-sm text-slate-500 mb-8">
            {t("explore.subtitle")}
          </p>
          <div className="grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto">
            <Link
              to="/tdee-calculator"
              className="group border border-slate-200 bg-white p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Flame className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-slate-900 group-hover:text-primary transition">
                {t("explore.tdee_title")}
              </h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                {t("explore.tdee_desc")}
              </p>
            </Link>
            <Link
              to="/exercises"
              className="group border border-slate-200 bg-white p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Dumbbell className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-slate-900 group-hover:text-primary transition">
                {t("explore.exercises_title")}
              </h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                {t("explore.exercises_desc")}
              </p>
            </Link>
            <Link
              to="/ket-qua-khach-hang"
              className="group border border-slate-200 bg-white p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <CheckCircle2 className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-slate-900 group-hover:text-primary transition">
                {t("explore.results_title")}
              </h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                {t("explore.results_desc")}
              </p>
            </Link>
          </div>
        </div>
      </section>

      <ScrollToTop />
    </main>
  );
};

export default TrainerProfile;

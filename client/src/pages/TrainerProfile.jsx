import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Award,
  ChartLine,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  HeartPulse,
  Play,
  Quote,
  Trophy,
  Utensils,
} from "lucide-react";
import CustomerStoryCard from "../components/trainer-profile/CustomerStoryCard";
import TrainerGallery from "../components/trainer-profile/TrainerGallery";
import TrainerSocialLinks from "../components/trainer-profile/TrainerSocialLinks";
import SEO from "../components/SEO";
import ScrollToTop from "../components/ScrollToTop";
import { getPublicCustomerStories } from "../services/customerStory.service";
import { getPublicTrainerBySlug } from "../services/trainer.service";
import { translateData } from "../utils/localDataTranslator";

const specialtyIconMap = {
  dumbbell: Dumbbell,
  utensils: Utensils,
  "chart-line": ChartLine,
  "heart-pulse": HeartPulse,
};

const AccordionItem = ({ question, answer, isOpen, onClick }) => {
  const id = useId();
  const triggerId = `faq-trigger-${id}`;
  const panelId = `faq-panel-${id}`;

  return (
    <div className="border-b border-zinc-300">
      <h3>
        <button
          id={triggerId}
          type="button"
          onClick={onClick}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-bold text-zinc-900 transition-colors duration-200 hover:text-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-800 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-100 sm:text-xl"
        >
          <span className="text-pretty">{question}</span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-800">
            <ChevronDown
              aria-hidden="true"
              size={20}
              className={`transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      </h3>
      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="max-w-2xl pb-7 pr-12 text-pretty leading-relaxed text-zinc-600"
        >
          {answer}
        </div>
      )}
    </div>
  );
};

const TrainerProfile = ({ previewData }) => {
  const { t, i18n } = useTranslation("trainer");
  const { slug } = useParams();
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [canScrollResultsPrevious, setCanScrollResultsPrevious] = useState(false);
  const [canScrollResultsNext, setCanScrollResultsNext] = useState(false);
  const customerResultsRef = useRef(null);

  const { data: trainerResponse, isLoading: isLoadingTrainer } = useQuery({
    queryKey: ["public-trainer-detail", slug, i18n.language],
    queryFn: () => getPublicTrainerBySlug(slug, { lang: i18n.language }),
    retry: false,
    enabled: !previewData,
  });

  const trainerRaw = previewData || trainerResponse?.data;
  const trainer = useMemo(
    () => translateData(trainerRaw, "trainer", i18n.language),
    [trainerRaw, i18n.language],
  );

  const { data: storiesResponse } = useQuery({
    queryKey: ["public-customer-stories", { trainerId: trainer?._id }, i18n.language],
    queryFn: () => getPublicCustomerStories({
      trainerId: trainer?._id,
      limit: 50,
      lang: i18n.language,
    }),
    enabled: Boolean(trainer?._id) && !previewData,
  });

  const stories = useMemo(
    () => translateData(
      previewData ? [] : (storiesResponse?.data || []),
      "story",
      i18n.language,
    ),
    [i18n.language, previewData, storiesResponse?.data],
  );

  const updateCustomerResultsControls = useCallback(() => {
    const scroller = customerResultsRef.current;
    if (!scroller) return;

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    setCanScrollResultsPrevious(scroller.scrollLeft > 4);
    setCanScrollResultsNext(scroller.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    const scroller = customerResultsRef.current;
    if (!scroller) return undefined;

    updateCustomerResultsControls();
    scroller.addEventListener("scroll", updateCustomerResultsControls, { passive: true });
    window.addEventListener("resize", updateCustomerResultsControls);

    return () => {
      scroller.removeEventListener("scroll", updateCustomerResultsControls);
      window.removeEventListener("resize", updateCustomerResultsControls);
    };
  }, [stories.length, updateCustomerResultsControls]);

  const scrollCustomerResults = useCallback((direction) => {
    const scroller = customerResultsRef.current;
    if (!scroller) return;

    const firstCard = scroller.querySelector("[data-customer-story-card]");
    const scrollDistance = firstCard
      ? firstCard.getBoundingClientRect().width + 20
      : scroller.clientWidth * 0.85;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    scroller.scrollBy({
      left: direction * scrollDistance,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, []);

  const trainerImages = trainer?.images?.length > 0
    ? trainer.images
    : (trainer?.image ? [trainer.image] : []);

  if (!previewData && isLoadingTrainer) {
    return (
      <main className="min-h-screen bg-zinc-950 pt-32">
        <div className="container-custom flex items-center justify-center" role="status">
          <div
            aria-hidden="true"
            className="size-9 animate-spin rounded-full border-4 border-primary border-t-transparent motion-reduce:animate-none"
          />
          <span className="sr-only">{t("loading")}</span>
        </div>
      </main>
    );
  }

  if (!trainer) return <Navigate to="/#trainers" replace />;

  const hasAchievements = trainer.achievements?.length > 0;
  const hasCertifications = trainer.certifications?.length > 0;
  const hasProfileDetails = hasAchievements || hasCertifications;
  const hasBothProfileDetails = hasAchievements && hasCertifications;

  const personSchema = {
    "@type": "Person",
    name: trainer.name,
    jobTitle: trainer.title || "Huấn Luyện Viên Cá Nhân",
    description: trainer.headline || trainer.bio || `Huấn luyện viên ${trainer.name} tại HTCOACHING`,
    image: trainerImages[0] || "",
    url: `https://htcoachingweb.io.vn/huan-luyen-vien/${trainer.slug}/`,
    worksFor: { "@type": "Organization", name: "HTCOACHING" },
  };
  const graph = [personSchema];

  if (trainer.faqs?.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: trainer.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    });
  }

  graph.push({
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: "https://htcoachingweb.io.vn/" },
      { "@type": "ListItem", position: 2, name: "Huấn Luyện Viên", item: "https://htcoachingweb.io.vn/#trainers" },
      { "@type": "ListItem", position: 3, name: trainer.name },
    ],
  });

  return (
    <main className="min-h-screen bg-zinc-950 font-sans text-zinc-50">
      <SEO
        title={`${trainer.name} - ${trainer.title || t("seo.default_title")} | HTCOACHING`}
        description={trainer.headline || trainer.bio || t("seo.default_description")}
        image={trainerImages[0]}
        canonical={`/huan-luyen-vien/${trainer.slug}`}
        jsonLd={{ "@context": "https://schema.org", "@graph": graph }}
      />

      <section className="relative overflow-hidden border-b border-zinc-800 pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="pointer-events-none absolute top-0 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="container-custom relative">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-primary/15 bg-zinc-900 shadow-2xl shadow-orange-950/30">
            <div className={trainerImages.length > 0 ? "grid lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.15fr)]" : "grid"}>
              {trainerImages.length > 0 && (
                <TrainerGallery images={trainerImages} name={trainer.name} />
              )}

              <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-12">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-primary">
                  <Trophy aria-hidden="true" size={15} />
                  {trainer.title || t("status.professional_trainer")}
                </div>

                <h1 className="mt-6 text-balance text-4xl font-black uppercase leading-none tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
                  {trainer.name}
                </h1>

                {trainer.headline && trainer.headline !== trainer.name && (
                  <p className="mt-4 max-w-2xl text-pretty text-lg font-semibold leading-relaxed text-primary-light sm:text-xl">
                    {trainer.headline}
                  </p>
                )}

                {trainer.motto && (
                  <blockquote className="mt-7 flex max-w-2xl items-start gap-3 text-pretty text-base italic leading-relaxed text-zinc-300 sm:text-lg">
                    <Quote aria-hidden="true" size={21} className="mt-1 shrink-0 text-primary" />
                    <p>“{trainer.motto}”</p>
                  </blockquote>
                )}

                {trainer.trainingStyle && (
                  <div className="mt-8 max-w-2xl">
                    <h2 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-400">
                      {t("sections.training_style")}
                    </h2>
                    <p className="mt-3 text-pretty leading-relaxed text-zinc-300">
                      {trainer.trainingStyle}
                    </p>
                  </div>
                )}

                {trainer.stats?.length > 0 && (
                  <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-5 border-y border-zinc-700 py-6">
                    {trainer.stats.map((stat, index) => (
                      <div key={`${stat.label}-${index}`} className="flex min-w-24 flex-col">
                        <dt className="order-2 mt-1 text-sm font-semibold text-primary-light">{stat.label}</dt>
                        <dd className="order-1 text-3xl font-black tracking-tight text-zinc-50">{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {trainer.specialties?.length > 0 && (
                  <div className="mt-8">
                    <h2 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-400">
                      {t("sections.specialties")}
                    </h2>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {trainer.specialties.map((specialty, index) => {
                        const Icon = specialtyIconMap[specialty.icon] || Dumbbell;
                        return (
                          <span
                            key={`${specialty.label}-${index}`}
                            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm font-semibold text-zinc-200"
                          >
                            <Icon aria-hidden="true" size={16} className="text-primary" />
                            {specialty.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/#contact"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-black text-zinc-950 transition-[background-color,transform] duration-200 hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 active:translate-y-px motion-reduce:transition-none"
                  >
                    <Dumbbell aria-hidden="true" size={19} />
                    {t("actions.free_consultation")}
                  </Link>
                  {stories.length > 0 && (
                    <a
                      href="#customer-results"
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-600 px-6 py-3 font-bold text-zinc-100 transition-[background-color,border-color] duration-200 hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                    >
                      {t("actions.view_results")}
                      <Play aria-hidden="true" size={17} />
                    </a>
                  )}
                </div>

                <div className="mt-5">
                  <TrainerSocialLinks socialLinks={trainer.socialLinks} />
                </div>
              </div>
            </div>

            {hasProfileDetails && (
              <div className={`grid border-t border-zinc-800 bg-zinc-950/50 ${hasBothProfileDetails ? "md:grid-cols-2 md:divide-x md:divide-zinc-800" : ""}`}>
                {hasAchievements && (
                  <div className="p-6 sm:p-9">
                    <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-primary">
                      <Trophy aria-hidden="true" size={18} />
                      {t("sections.achievements")}
                    </h2>
                    <ul className="mt-5 space-y-3">
                      {trainer.achievements.map((achievement, index) => (
                        <li key={`${achievement}-${index}`} className="flex items-start gap-3 text-pretty text-sm leading-relaxed text-zinc-300">
                          <CheckCircle2 aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-primary" />
                          {achievement}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {hasCertifications && (
                  <div className={`p-6 sm:p-9 ${hasAchievements ? "border-t border-zinc-800 md:border-t-0" : ""}`}>
                    <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-primary">
                      <Award aria-hidden="true" size={18} />
                      {t("sections.certifications")}
                    </h2>
                    <ul className="mt-5 space-y-3">
                      {trainer.certifications.map((certification, index) => (
                        <li key={`${certification}-${index}`} className="flex items-start gap-3 text-pretty text-sm leading-relaxed text-zinc-300">
                          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                          {certification}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {trainer.videoIntro && (
        <section className="border-b border-zinc-800 bg-zinc-900/40 py-20 md:py-24">
          <div className="container-custom mx-auto max-w-5xl">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-balance text-3xl font-black uppercase tracking-tight text-zinc-50 sm:text-4xl">
                {t("sections.video_intro")}
              </h2>
              <p className="mt-4 text-pretty text-zinc-400">{t("sections.video_desc")}</p>
            </div>
            <div className="aspect-video overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl shadow-zinc-950/40">
              {trainer.videoIntro.includes("youtube.com") || trainer.videoIntro.includes("youtu.be") ? (
                <iframe
                  src={trainer.videoIntro.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                  className="h-full w-full rounded-2xl"
                  allowFullScreen
                  loading="lazy"
                  title={`${t("sections.video_intro")} ${trainer.name}`}
                />
              ) : (
                <video
                  src={trainer.videoIntro}
                  controls
                  className="h-full w-full rounded-2xl bg-zinc-950 object-contain"
                />
              )}
            </div>
          </div>
        </section>
      )}

      {trainer.methodologies?.length > 0 && (
        <section className="border-b border-zinc-800 py-20 md:py-28">
          <div className="container-custom mx-auto max-w-6xl">
            <div className="mb-14 max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-primary">
                {t("sections.methodology")}
              </p>
              <h2 className="mt-4 text-balance text-4xl font-black uppercase tracking-tight text-zinc-50 sm:text-5xl">
                <Trans t={t} i18nKey="sections.methodology_title">
                  TRỤ CỘT <span className="text-primary">MÁU LỬA</span>
                </Trans>
              </h2>
              <p className="mt-5 max-w-2xl text-pretty leading-relaxed text-zinc-400">
                {t("sections.methodology_desc")}
              </p>
            </div>

            <ol className="border-t border-zinc-800">
              {trainer.methodologies.map((method, index) => (
                <li
                  key={`${method.title}-${index}`}
                  className="grid gap-4 border-b border-zinc-800 py-8 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-8 md:py-10"
                >
                  <span className="text-5xl font-black tracking-tighter text-primary/45" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="max-w-3xl">
                    <h3 className="text-balance text-2xl font-black text-zinc-100 sm:text-3xl">
                      {method.title}
                    </h3>
                    <p className="mt-3 text-pretty leading-relaxed text-zinc-400">
                      {method.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {stories.length > 0 && (
        <section id="customer-results" className="scroll-mt-24 border-b border-zinc-800 bg-primary/5 py-20 md:py-28">
          <div className="container-custom">
            <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-3xl">
                <h2 className="text-balance text-4xl font-black uppercase tracking-tight text-zinc-50 sm:text-5xl">
                  {t("sections.customer_results")}
                </h2>
                <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-zinc-400">
                  <Trans t={t} i18nKey="sections.customer_results_desc" values={{ name: trainer.name }}>
                    Những học viên đã tin tưởng và lột xác cùng <span className="font-bold text-primary-light">{trainer.name}</span>
                  </Trans>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {stories.length > 1 && (
                  <div
                    role="group"
                    aria-label={t("sections.customer_results")}
                    className="hidden items-center gap-2 lg:flex"
                  >
                    <button
                      type="button"
                      onClick={() => scrollCustomerResults(-1)}
                      disabled={!canScrollResultsPrevious}
                      aria-label={t("customer_card.previous_story")}
                      className="inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-primary/50 bg-zinc-950 px-3 text-sm font-black uppercase tracking-wide text-zinc-100 transition-[background-color,border-color,color,transform] duration-200 hover:border-primary hover:bg-primary hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:translate-y-px disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600 motion-reduce:transition-none sm:px-4"
                    >
                      <ChevronLeft aria-hidden="true" size={21} />
                      <span className="hidden sm:inline">{t("customer_card.previous_story")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCustomerResults(1)}
                      disabled={!canScrollResultsNext}
                      aria-label={t("customer_card.next_story")}
                      className="inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-primary bg-primary px-3 text-sm font-black uppercase tracking-wide text-zinc-950 transition-[background-color,border-color,transform] duration-200 hover:border-primary-light hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:translate-y-px disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600 motion-reduce:transition-none sm:px-4"
                    >
                      <span className="hidden sm:inline">{t("customer_card.next_story")}</span>
                      <ChevronRight aria-hidden="true" size={21} />
                    </button>
                  </div>
                )}
                <Link
                  to="/ket-qua-khach-hang/"
                  className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-black uppercase tracking-wider text-zinc-100 transition-[color,background-color,border-color] duration-200 hover:border-primary hover:bg-primary hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {t("sections.view_all_stories")}
                  <ArrowRight aria-hidden="true" size={17} />
                </Link>
              </div>
            </div>

            <div
              ref={customerResultsRef}
              role="region"
              aria-label={t("sections.customer_results")}
              tabIndex={0}
              className="grid grid-cols-1 gap-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950 lg:flex lg:snap-x lg:snap-mandatory lg:overflow-x-auto lg:overscroll-x-contain lg:pb-6 lg:pr-4"
            >
              {stories.map((story) => (
                <CustomerStoryCard key={story._id || story.slug} story={story} />
              ))}
            </div>
          </div>
        </section>
      )}

      {trainer.faqs?.length > 0 && (
        <section data-trainer-faq className="border-b border-zinc-300 bg-zinc-100 py-20 md:py-28">
          <div className="container-custom mx-auto max-w-4xl">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-balance text-4xl font-black uppercase tracking-tight text-zinc-950 sm:text-5xl">
                {t("sections.faqs")}
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-zinc-600">{t("sections.faqs_desc")}</p>
            </div>

            <div className="border-t border-zinc-300">
              {trainer.faqs.map((faq, index) => (
                <AccordionItem
                  key={`${faq.question}-${index}`}
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

      <section data-trainer-explore className="border-b border-zinc-800 bg-zinc-950 py-16 md:py-20">
        <div className="container-custom mx-auto max-w-6xl">
          <div className="mb-9 max-w-2xl">
            <h2 className="text-balance text-3xl font-black uppercase tracking-tight text-zinc-50 sm:text-4xl">
              <Trans t={t} i18nKey="explore.title">
                Khám phá <span className="text-primary">thêm</span>
              </Trans>
            </h2>
            <p className="mt-3 text-pretty text-zinc-400">{t("explore.subtitle")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              to="/tdee-calculator/"
              className="group rounded-3xl bg-primary p-6 text-zinc-950 transition-[background-color,transform] duration-200 hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:translate-y-px motion-reduce:transition-none sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:p-8"
            >
              <Flame aria-hidden="true" className="mb-8 text-zinc-950 lg:mb-20" size={30} />
              <h3 className="text-xl font-black text-zinc-950">
                {t("explore.tdee_title")}
              </h3>
              <p className="mt-3 max-w-sm text-pretty text-sm font-medium leading-relaxed text-zinc-900/80">
                {t("explore.tdee_desc")}
              </p>
            </Link>
            <Link
              to="/exercises/"
              className="group rounded-3xl border border-zinc-800 bg-zinc-950 p-6 transition-[border-color,background-color] duration-200 hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 lg:col-span-2"
            >
              <Dumbbell aria-hidden="true" className="mb-8 text-primary" size={28} />
              <h3 className="text-xl font-black text-zinc-100 transition-colors duration-200 group-hover:text-primary-light">
                {t("explore.exercises_title")}
              </h3>
              <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-zinc-400">
                {t("explore.exercises_desc")}
              </p>
            </Link>
            <Link
              to="/ket-qua-khach-hang/"
              className="group rounded-3xl border border-zinc-800 bg-zinc-950 p-6 transition-[border-color,background-color] duration-200 hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 lg:col-span-2"
            >
              <CheckCircle2 aria-hidden="true" className="mb-8 text-primary" size={28} />
              <h3 className="text-xl font-black text-zinc-100 transition-colors duration-200 group-hover:text-primary-light">
                {t("explore.results_title")}
              </h3>
              <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-zinc-400">
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

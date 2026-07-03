import { useEffect, useRef } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import gsap from "gsap";
import { ArrowLeft, CalendarDays, CheckCircle2, Dumbbell, Flame, Hourglass } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicCustomerStories,
  getPublicCustomerStoryBySlug,
} from "../services/customerStory.service";
import SEO from "../components/SEO";

const ContinuingBanner = ({ name }) => {
  const iconRef = useRef(null);
  const dot1Ref = useRef(null);
  const dot2Ref = useRef(null);
  const dot3Ref = useRef(null);

  useEffect(() => {
    // Skip animations if user prefers reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1 });
      tl.to(iconRef.current, {
        rotation: "+=180",
        duration: 1,
        ease: "power2.inOut",
      })
      .to(dot1Ref.current, { opacity: 1, duration: 0.2 })
      .to(dot2Ref.current, { opacity: 1, duration: 0.2 })
      .to(dot3Ref.current, { opacity: 1, duration: 0.2 })
      .to({}, { duration: 0.5 })
      .to([dot1Ref.current, dot2Ref.current, dot3Ref.current], { opacity: 0, duration: 0.2 });
    });
    return () => ctx.revert();
  }, []);

  return (
    <section className="mt-8 border-t border-gray-200 pt-8 pb-4">
      <div className="flex flex-col items-center justify-center text-center">
        <div ref={iconRef} className="mb-3">
          <Hourglass className="h-8 w-8 text-primary sm:h-10 sm:w-10" />
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-gray sm:text-base">
          Khách hàng đang tiếp tục bước vào giai đoạn tập luyện nâng cao. Hãy cùng chờ đón sự lột xác bùng nổ tiếp theo của <strong>{name}</strong> cùng HTCOACHING nhé
          <span ref={dot1Ref} className="opacity-0 inline-block">.</span>
          <span ref={dot2Ref} className="opacity-0 inline-block">.</span>
          <span ref={dot3Ref} className="opacity-0 inline-block">.</span>
        </p>
      </div>
    </section>
  );
};

const BeforeAfterBlock = ({ title, subtitle, beforeImg, afterImg }) => (
  <figure className="overflow-hidden border border-gray-200 bg-white">
    <div className="flex items-center justify-between gap-4 bg-primary px-4 py-3 text-white sm:px-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] sm:text-sm">
          {title}
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase sm:text-xs">
          {subtitle}
        </p>
      </div>
      <div className="text-right font-display text-2xl font-bold leading-none sm:text-3xl">
        HT
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-2 sm:gap-3 sm:p-3">
      <div className="relative min-h-0 overflow-hidden bg-neutral-200">
        <img
          src={beforeImg}
          alt={`${title} before`}
          className="aspect-[4/5] w-full object-cover object-center"
        />
        <span className="absolute bottom-2 left-2 bg-primary px-2 py-1 text-[10px] font-bold uppercase text-white sm:text-xs">
          Before
        </span>
      </div>
      <div className="relative min-h-0 overflow-hidden bg-neutral-200">
        <img
          src={afterImg}
          alt={`${title} after`}
          className="aspect-[4/5] w-full object-cover object-center"
        />
        <span className="absolute bottom-2 left-2 bg-primary px-2 py-1 text-[10px] font-bold uppercase text-white sm:text-xs">
          After
        </span>
      </div>
    </div>
  </figure>
);

const RelatedStoryCard = ({ story }) => (
  <Link
    to={`/ket-qua-khach-hang/${story.slug}`}
    className="group block overflow-hidden border border-gray-200 bg-white transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
  >
    <div className="grid grid-cols-2 gap-1 bg-neutral-100 p-1">
      <img
        src={story.beforeImg}
        alt={`${story.name} before`}
        className="aspect-[4/5] w-full object-cover"
      />
      <img
        src={story.afterImg}
        alt={`${story.name} after`}
        className="aspect-[4/5] w-full object-cover"
      />
    </div>
    <div className="p-3">
      <p className="text-sm font-bold text-dark transition group-hover:text-primary">
        {story.name}
      </p>
      <p className="mt-1 text-xs text-gray">
        {story.result} trong {story.duration}
      </p>
    </div>
  </Link>
);

const CustomerStoryDetail = ({ previewData }) => {
  const { slug } = useParams();

  const { data: storyResponse, isLoading: isLoadingStory } = useQuery({
    queryKey: ["public-customer-story", slug],
    queryFn: () => getPublicCustomerStoryBySlug(slug),
    retry: false,
    enabled: !previewData,
  });

  const { data: storiesResponse } = useQuery({
    queryKey: ["public-customer-stories", "related"],
    queryFn: () => getPublicCustomerStories({ limit: 20 }),
    enabled: !previewData,
  });

  const story = previewData || (storyResponse?.data?.slug ? storyResponse.data : null);

  if (!previewData && isLoadingStory) {
    return (
      <main className="min-h-screen bg-white pt-32">
        <div className="container-custom">
          <phantom-ui loading>
            <div className="space-y-6">
              <div className="h-8 w-2/3 bg-gray-100 rounded"></div>
              <div className="h-64 bg-gray-100 rounded"></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-40 bg-gray-100 rounded"></div>
                <div className="h-40 bg-gray-100 rounded"></div>
              </div>
            </div>
          </phantom-ui>
        </div>
      </main>
    );
  }

  if (!story) {
    return <Navigate to="/" replace />;
  }

  const relatedStories = (storiesResponse?.data || [])
    .filter((relatedStory) => relatedStory.slug !== story.slug)
    .slice(0, 6);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": `Hành trình ${story.duration} của ${story.name}`,
    "image": [
      story.heroImage || story.afterImg
    ],
    "author": {
      "@type": "Organization",
      "name": "HTCOACHING"
    },
    "publisher": {
      "@type": "Organization",
      "name": "HTCOACHING",
      "logo": {
        "@type": "ImageObject",
        "url": "https://htcoachingweb.io.vn/logo.png"
      }
    },
    "description": `Khám phá hành trình ${story.duration} thay đổi vóc dáng của ${story.name} (${story.age} tuổi, ${story.job}). Kết quả: ${story.result}.`,
    ...(story.createdAt && { "datePublished": new Date(story.createdAt).toISOString().split("T")[0] }),
    ...(story.updatedAt && { "dateModified": new Date(story.updatedAt).toISOString().split("T")[0] })
  };

  return (
    <main className="bg-white">
      {!previewData && (
        <SEO
          title={`Hành trình ${story.duration} của ${story.name}`}
          description={`Khám phá hành trình ${story.duration} thay đổi vóc dáng của ${story.name} (${story.age} tuổi, ${story.job}). Kết quả: ${story.result}.`}
          canonical={`/ket-qua-khach-hang/${story.slug}`}
          image={story.heroImage || story.afterImg}
          type="article"
          jsonLd={articleSchema}
        />
      )}
      <section className="relative min-h-[420px] overflow-hidden bg-black text-white sm:min-h-[500px]">
        <img
          src={story.heroImage}
          alt={story.name}
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container-custom relative z-10 flex min-h-[420px] flex-col justify-end pb-10 pt-28 sm:min-h-[500px] sm:pb-14">
          <Link
            to="/"
            className="mb-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-white/80 transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Trang chủ
          </Link>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">
            Kết quả thay đổi
          </p>
          <h1 className="max-w-4xl text-white uppercase">
            Hành trình {story.duration} của {story.name}
          </h1>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold text-white/90">
            <span className="border border-white/30 px-3 py-2">
              {story.job}
            </span>
            <span className="border border-white/30 px-3 py-2">
              {story.age} tuổi
            </span>
            <span className="border border-white/30 px-3 py-2">
              {story.packageName}
            </span>
          </div>
        </div>
      </section>

      <section className="container-custom py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          <aside className="border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <p className="text-sm font-bold uppercase text-primary">
              Thông tin chung
            </p>
            <dl className="mt-5 space-y-4 text-sm">
              {[
                ["Khách hàng", story.name],
                ["Nghề nghiệp", story.job],
                ["Mục tiêu", story.goal],
                ["Gói tập", story.packageName],
                ["Lịch tập", story.schedule],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase text-gray">
                    {label}
                  </dt>
                  <dd className="mt-1 font-semibold text-dark">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ["Bắt đầu", story.startWeight],
                ["Hiện tại", story.endWeight],
                ["Kết quả", story.result],
                ["Thời gian", story.duration],
              ].map(([label, value]) => (
                <div key={label} className="border border-gray-200 p-3">
                  <p className="text-[11px] font-bold uppercase text-gray">
                    {label}
                  </p>
                  <p className="mt-1 text-lg font-bold text-primary">{value}</p>
                </div>
              ))}
            </div>
              {story.updatedAt && (
                <p className="mt-4 text-xs text-gray flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Cập nhật: {new Date(story.updatedAt).toLocaleDateString("vi-VN")}
                </p>
              )}
          </aside>

          <div className="min-w-0">
            <div className="grid gap-5 md:grid-cols-2">
              <article className="border-l-4 border-primary bg-light p-5">
                <h2 className="h3 mb-3 text-2xl uppercase">Vấn đề của khách hàng</h2>
                <p className="text-sm leading-7 text-gray sm:text-base">
                  {story.problem}
                </p>
              </article>
              <article className="border-l-4 border-black bg-light p-5">
                <h2 className="h3 mb-3 text-2xl uppercase">Giải pháp của Huấn Luyện Viên</h2>
                <p className="text-sm leading-7 text-gray sm:text-base">
                  {story.solution}
                </p>
              </article>
            </div>

            <div className="mt-8">
              <BeforeAfterBlock
                title={story.duration}
                subtitle={`${story.age} tuổi - ${story.job}`}
                beforeImg={story.beforeImg}
                afterImg={story.afterImg}
              />
            </div>

            {story.milestones.length > 0 && (
              <section className="mt-10">
                <div className="mb-5 flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <h2 className="h3 text-2xl uppercase">Timeline hành trình</h2>
                </div>
                <div className="space-y-8">
                  {story.milestones.map((milestone, index) => (
                    <article
                      key={milestone.title || index}
                      className="grid gap-5 border-t border-gray-200 pt-6 md:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_420px]"
                    >
                      <div>
                        <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">
                          {milestone.title}
                        </p>
                        <h3 className="mt-2 text-2xl font-bold text-dark">
                          {milestone.subtitle}
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-gray sm:text-base">
                          {milestone.content}
                        </p>
                        {milestone.bullets.length > 0 && (
                          <div className="mt-6 rounded-xl bg-slate-50 p-5 border border-slate-100">
                            <p className="mb-3 font-semibold text-primary">
                              Kết quả giai đoạn {index + 1}:
                            </p>
                            <ul className="space-y-2">
                              {milestone.bullets.map((bullet) => (
                                <li
                                  key={bullet}
                                  className="flex gap-2 text-sm text-dark sm:text-base"
                                >
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="self-start">
                        <BeforeAfterBlock
                          title={milestone.title}
                          subtitle={milestone.subtitle}
                          beforeImg={milestone.beforeImg}
                          afterImg={milestone.afterImg}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {story.quote && (
              <section className="mt-10 border-t border-gray-200 pt-10 pb-4">
                <blockquote className="relative rounded-r-2xl border-l-4 border-primary bg-primary/5 p-8 sm:p-10">
                  <div className="absolute -top-3 left-6 bg-white px-2">
                    <svg
                      className="h-8 w-8 text-primary/40"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                  </div>
                  <p className="text-lg italic leading-relaxed text-slate-700 sm:text-xl">
                    “{story.quote}”
                  </p>
                  <footer className="mt-6 flex items-center gap-3">
                    <div className="h-0.5 w-8 bg-primary"></div>
                    <span className="text-sm font-bold capitalize tracking-widest text-primary">
                      {story.name}
                    </span>
                  </footer>
                </blockquote>
              </section>
            )}

            {story.isContinuing && (
              <ContinuingBanner name={story.name} />
            )}

            {relatedStories.length > 0 && (
              <section className="mt-10">
                <h2 className="h3 text-center text-2xl text-primary uppercase">
                  Các câu chuyện tương tự
                </h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedStories.map((relatedStory) => (
                    <RelatedStoryCard
                      key={relatedStory.slug}
                      story={relatedStory}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Internal Linking — SEO Hub */}
            <section className="mt-10 border-t border-gray-200 pt-10">
              <h2 className="h3 text-center text-2xl text-primary uppercase">
                Khám phá thêm
              </h2>
              <p className="text-center text-sm text-gray mt-2">
                Bắt đầu hành trình thay đổi vóc dáng của bạn ngay hôm nay
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Link
                  to="/tdee-calculator"
                  className="group border border-gray-200 bg-white p-5 transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
                >
                  <Flame className="h-6 w-6 text-primary mb-3" />
                  <h3 className="font-bold text-dark group-hover:text-primary transition">
                    Tính TDEE & Macro
                  </h3>
                  <p className="mt-2 text-sm text-gray leading-relaxed">
                    Xác định lượng calo cần nạp mỗi ngày để đạt mục tiêu giảm mỡ hoặc tăng cơ.
                  </p>
                </Link>
                <Link
                  to="/exercises"
                  className="group border border-gray-200 bg-white p-5 transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
                >
                  <Dumbbell className="h-6 w-6 text-primary mb-3" />
                  <h3 className="font-bold text-dark group-hover:text-primary transition">
                    Thư viện bài tập
                  </h3>
                  <p className="mt-2 text-sm text-gray leading-relaxed">
                    Tạo lịch tập cá nhân hóa với hệ thống bài tập chuyên nghiệp và xuất PDF miễn phí.
                  </p>
                </Link>
                <Link
                  to="/ket-qua-khach-hang"
                  className="group border border-gray-200 bg-white p-5 transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
                >
                  <CheckCircle2 className="h-6 w-6 text-primary mb-3" />
                  <h3 className="font-bold text-dark group-hover:text-primary transition">
                    Tất cả kết quả
                  </h3>
                  <p className="mt-2 text-sm text-gray leading-relaxed">
                    Xem toàn bộ hành trình thay đổi vóc dáng của các học viên HTCOACHING.
                  </p>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
};

export default CustomerStoryDetail;

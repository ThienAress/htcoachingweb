import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, Dumbbell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicCustomerStories,
  getPublicCustomerStoryBySlug,
} from "../services/customerStory.service";
import SEO from "../components/SEO";

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

const CustomerStoryDetail = () => {
  const { slug } = useParams();

  const { data: storyResponse, isLoading: isLoadingStory } = useQuery({
    queryKey: ["public-customer-story", slug],
    queryFn: () => getPublicCustomerStoryBySlug(slug),
    retry: false,
  });

  const { data: storiesResponse } = useQuery({
    queryKey: ["public-customer-stories", "related"],
    queryFn: () => getPublicCustomerStories({ limit: 20 }),
  });

  const story = storyResponse?.data?.slug ? storyResponse.data : null;

  if (isLoadingStory) {
    return (
      <main className="min-h-screen bg-white pt-32">
        <div className="container-custom">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Đang tải câu chuyện khách hàng...
          </p>
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
    "description": `Khám phá hành trình ${story.duration} thay đổi vóc dáng của ${story.name} (${story.age} tuổi, ${story.job}). Kết quả: ${story.result}.`
  };

  return (
    <main className="bg-white">
      <SEO 
        title={`Hành trình ${story.duration} của ${story.name}`}
        description={`Khám phá hành trình ${story.duration} thay đổi vóc dáng của ${story.name} (${story.age} tuổi, ${story.job}). Kết quả: ${story.result}.`}
        canonical={`/ket-qua-khach-hang/${story.slug}`}
        image={story.heroImage || story.afterImg}
        type="article"
        jsonLd={articleSchema}
      />
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
          <h1 className="max-w-4xl text-white">
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
          </aside>

          <div className="min-w-0">
            <div className="grid gap-5 md:grid-cols-2">
              <article className="border-l-4 border-primary bg-light p-5">
                <h2 className="h3 mb-3 text-2xl">Vấn đề ban đầu</h2>
                <p className="text-sm leading-7 text-gray sm:text-base">
                  {story.problem}
                </p>
              </article>
              <article className="border-l-4 border-black bg-light p-5">
                <h2 className="h3 mb-3 text-2xl">Giải pháp</h2>
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
              <p className="mt-4 text-sm leading-7 text-gray sm:text-base">
                {story.message}
              </p>
            </div>

            {story.milestones.length > 0 && (
              <section className="mt-10">
                <div className="mb-5 flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <h2 className="h3 text-2xl">Timeline hành trình</h2>
                </div>
                <div className="space-y-8">
                  {story.milestones.map((milestone) => (
                    <article
                      key={milestone.title}
                      className="grid gap-5 border-t border-gray-200 pt-6 md:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_340px]"
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
                          <ul className="mt-4 space-y-2">
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
                        )}
                      </div>
                      <BeforeAfterBlock
                        title={milestone.title}
                        subtitle={milestone.subtitle}
                        beforeImg={milestone.beforeImg}
                        afterImg={milestone.afterImg}
                      />
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-10 border-y border-gray-200 py-8">
              <div className="mb-5 flex items-center gap-3">
                <Dumbbell className="h-5 w-5 text-primary" />
                <h2 className="h3 text-2xl">Kết quả đạt được</h2>
              </div>
              {story.highlights.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {story.highlights.map((highlight) => (
                    <div key={highlight} className="border border-gray-200 p-4">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <p className="mt-3 text-sm font-semibold leading-6 text-dark">
                        {highlight}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {story.quote && (
                <blockquote className="mt-6 bg-black p-5 text-white sm:p-6">
                  <p className="text-base font-medium leading-8 sm:text-lg">
                    “{story.quote}”
                  </p>
                  <footer className="mt-4 text-sm font-bold text-primary">
                    {story.name}
                  </footer>
                </blockquote>
              )}
            </section>

            {relatedStories.length > 0 && (
              <section className="mt-10">
                <h2 className="h3 text-center text-2xl text-primary">
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
          </div>
        </div>
      </section>
    </main>
  );
};

export default CustomerStoryDetail;

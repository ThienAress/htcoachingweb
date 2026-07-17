import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import UpdatingText from "../components/UpdatingText";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Dumbbell,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { getPublicCustomerStories } from "../services/customerStory.service";
import Contact from "../sections/Contact";
import hero3 from "../assets/images/hero/hero3.jpg";
import SEO from "../components/SEO";
import ScrollToTop from "../components/ScrollToTop";
import { translateData } from "../utils/localDataTranslator";

const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

const getNumberFromText = (value = "") => {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : null;
};

const matchesAge = (story, ageFilter) => {
  if (!ageFilter) return true;
  const age = getNumberFromText(story.age);
  if (!age) return false;
  if (ageFilter === "under_20") return age < 20;
  if (ageFilter === "20_29") return age >= 20 && age <= 29;
  if (ageFilter === "30_39") return age >= 30 && age <= 39;
  if (ageFilter === "40_plus") return age >= 40;
  return true;
};

const matchesGoal = (story, goalFilter) => {
  if (!goalFilter) return true;
  const targetText = normalizeText(
    `${story.goal || ""} ${story.result || ""} ${story.message || ""}`,
  );

  if (goalFilter === "fat_loss") {
    return targetText.includes("giam") || targetText.includes("mo");
  }
  if (goalFilter === "muscle_gain") {
    return targetText.includes("tang co") || targetText.includes("co bap");
  }
  if (goalFilter === "fitness") {
    return (
      targetText.includes("suc ben") ||
      targetText.includes("thoi quen") ||
      targetText.includes("voc dang")
    );
  }
  return true;
};

const matchesDuration = (story, durationFilter) => {
  if (!durationFilter) return true;
  const weeks = getNumberFromText(story.duration);
  if (!weeks) return false;
  if (durationFilter === "under_12") return weeks <= 12;
  if (durationFilter === "12_16") return weeks >= 12 && weeks <= 16;
  if (durationFilter === "17_24") return weeks >= 17 && weeks <= 24;
  if (durationFilter === "over_24") return weeks > 24;
  return true;
};

const getSummary = (value = "", maxLength = 96) => {
  if (!value) return "Đang cập nhật";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
};

const getStoryImage = (story, key, fallback) => {
  const value = story?.[key];
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved || fallback;
};



const FilterSelect = ({ value, onChange, children, label }) => (
  <label className="relative block">
    <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
      {label}
    </span>
    <select
      value={value}
      onChange={onChange}
      className="h-12 w-full appearance-none border border-slate-200 bg-white px-4 pr-10 text-sm font-bold text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute bottom-4 right-4 h-4 w-4 text-slate-400" />
  </label>
);

const TrainerFilter = ({ trainers, selected, onChange }) => {
  const { t } = useTranslation("stories");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const selectedNames = trainers
    .filter((t) => selected.includes(t._id))
    .map((t) => t.name)
    .join(", ");

  return (
    <div className="relative block" ref={dropdownRef}>
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {t("filters.trainer")}
      </span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 w-full border border-slate-200 bg-white px-4 pr-10 text-left text-sm font-bold text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 flex items-center justify-between"
      >
        <span className="truncate">
          {selected.length === 0 ? t("filters.trainer") : selectedNames}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-30 mt-1 max-h-60 w-full overflow-y-auto border border-slate-200 bg-white p-2 shadow-lg rounded-sm">
          {trainers.length === 0 ? (
            <div className="p-2 text-xs italic text-slate-400">{t("filters.no_trainer_data")}</div>
          ) : (
            <div className="flex flex-col gap-2">
              {trainers.map((t) => {
                const isChecked = selected.includes(t._id);
                return (
                  <label
                    key={t._id}
                    className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-slate-50 cursor-pointer select-none rounded transition"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(t._id)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <span className="text-sm font-bold text-slate-700">{t.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StoryGridCard = ({ story }) => {
  const { t } = useTranslation("stories");
  const beforeImage = getStoryImage(story, "beforeImg", null);
  const afterImage = getStoryImage(story, "afterImg", null);
  const trainerName = story.trainerId?.name;

  return (
    <Link
      to={`/ket-qua-khach-hang/${story.slug}`}
      className="group block overflow-hidden border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
    >
      <div className="flex min-h-[70px] items-center justify-between gap-4 bg-primary px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="font-display text-3xl font-bold uppercase leading-none">
            {story.duration || t("detail.updating")}
          </p>
          <p className="mt-1 truncate text-[11px] font-bold uppercase leading-4 text-white/90">
            {story.age || "--"} {t("stories_list.age_suffix")} - {story.job || t("detail.updating")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-3xl font-bold leading-none">HT</p>
          <p className="text-[9px] font-black uppercase leading-none">
            Coaching
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-2">
        <div className="relative overflow-hidden bg-neutral-200">
          {beforeImage ? (
            <img
              src={beforeImage}
              alt={`${story.name} before`}
              className="aspect-[4/5] w-full object-cover object-center transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="aspect-[4/5] w-full flex items-center justify-center bg-neutral-100">
              <UpdatingText className="text-[10px] text-slate-400" />
            </div>
          )}
          <span className="absolute bottom-2 left-2 bg-primary px-2 py-1 text-[10px] font-black uppercase text-white shadow">
            Before
          </span>
        </div>
        <div className="relative overflow-hidden bg-neutral-200">
          {afterImage ? (
            <img
              src={afterImage}
              alt={`${story.name} after`}
              className="aspect-[4/5] w-full object-cover object-center transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="aspect-[4/5] w-full flex items-center justify-center bg-neutral-100">
              <UpdatingText className="text-[10px] text-slate-400" />
            </div>
          )}
          <span className="absolute bottom-2 left-2 bg-primary px-2 py-1 text-[10px] font-black uppercase text-white shadow">
            After
          </span>
        </div>
      </div>

      <div className="border-t-4 border-primary p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black uppercase text-slate-900">
              {story.name || t("stories_list.default_customer_name")}
            </h3>
            <p className="mt-1 text-xs font-semibold uppercase text-primary">
              {story.result || t("detail.updating")}
            </p>
            {trainerName && (
              <div className="mt-2">
                <Link
                  to={`/huan-luyen-vien/${story.trainerId?.slug}`}
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase text-slate-700 transition duration-200 hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>{t("stories_list.trainer_label")}: {trainerName}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                </Link>
              </div>
            )}
          </div>
          {story.packageName && (
            <span className="shrink-0 border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase text-primary">
              {story.packageName}
            </span>
          )}
        </div>
        <p className="text-sm leading-6 text-slate-600">
          <strong className="font-black text-slate-800">{t("stories_list.goal")}:</strong>{" "}
          {getSummary(story.goal, 82)}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          <strong className="font-black text-slate-800">{t("stories_list.problem")}:</strong>{" "}
          {getSummary(story.problem)}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          <strong className="font-black text-slate-800">{t("stories_list.solution")}:</strong>{" "}
          {getSummary(story.solution)}
        </p>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-black uppercase text-primary">
          {t("stories_list.view_detail")}
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
};

const CustomerStories = () => {
  const { t, i18n } = useTranslation("stories");
  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [durationFilter, setDurationFilter] = useState("");
  const [selectedTrainers, setSelectedTrainers] = useState([]);

  const stats = useMemo(() => [
    { value: "1-1", label: t("stats.one_on_one") },
    { value: "90+", label: t("stats.habit_days") },
    { value: "100%", label: t("stats.personalized") },
  ], [t]);

  const principles = useMemo(() => [
    {
      icon: ShieldCheck,
      title: t("principles.title1"),
      text: t("principles.text1"),
    },
    {
      icon: Dumbbell,
      title: t("principles.title2"),
      text: t("principles.text2"),
    },
    {
      icon: Trophy,
      title: t("principles.title3"),
      text: t("principles.text3"),
    },
  ], [t]);

  const { data, isLoading } = useQuery({
    queryKey: ["public-customer-stories", "all", i18n.language],
    queryFn: () => getPublicCustomerStories({ limit: 50, lang: i18n.language }),
  });

  const stories = useMemo(() => translateData(data?.data || [], "story", i18n.language), [data?.data, i18n.language]);
  const featuredStory = stories[0];
  const heroImage = getStoryImage(featuredStory, "heroImage", hero3);
  const collageBefore = getStoryImage(featuredStory, "beforeImg", null);
  const collageAfter = getStoryImage(featuredStory, "afterImg", null);

  const trainersList = useMemo(() => {
    const map = new Map();
    stories.forEach((story) => {
      if (story.trainerId && story.trainerId._id && story.trainerId.name) {
        map.set(story.trainerId._id, {
          _id: story.trainerId._id,
          name: story.trainerId.name,
        });
      }
    });
    return Array.from(map.values());
  }, [stories]);

  const filteredStories = useMemo(() => {
    const keyword = normalizeText(search.trim());

    let result = stories.filter((story) => {
      const searchText = normalizeText(
        `${story.name || ""} ${story.job || ""} ${story.goal || ""} ${story.result || ""
        }`,
      );

      const matchesTrainer =
        selectedTrainers.length === 0 ||
        (story.trainerId && selectedTrainers.includes(story.trainerId._id));

      return (
        (!keyword || searchText.includes(keyword)) &&
        matchesAge(story, ageFilter) &&
        matchesGoal(story, goalFilter) &&
        matchesDuration(story, durationFilter) &&
        matchesTrainer
      );
    });

    result.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(a.createdAt);
      const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(b.createdAt);
      return dateB - dateA;
    });

    return result;
  }, [stories, search, ageFilter, goalFilter, durationFilter, selectedTrainers]);

  const customerStoriesSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Kết Quả Khách Hàng HTCOACHING",
    "url": "https://htcoachingweb.io.vn/ket-qua-khach-hang",
    "description": "Tổng hợp câu chuyện thay đổi vóc dáng thực tế của học viên tại HTCOACHING — giảm mỡ, tăng cơ với giáo án PT 1 kèm 1 cá nhân hóa.",
    "provider": { "@type": "Organization", "name": "HTCOACHING", "url": "https://htcoachingweb.io.vn" }
  };

  return (
    <main className="bg-white">
      <SEO
        title={t("seo.title")}
        description={t("seo.description")}
        canonical="/ket-qua-khach-hang"
        jsonLd={customerStoriesSchema}
      />
      <section className="relative min-h-[520px] overflow-hidden bg-black text-white">
        <img
          src={heroImage}
          alt="Kết quả khách hàng HT Coaching"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-white to-transparent" />

        <div className="container-custom relative z-10 flex min-h-[520px] flex-col justify-end pb-16 pt-28">
          <div className="max-w-4xl">
            <h1 className="font-display text-fluid-6xl font-bold uppercase leading-tight text-white">
              {t("header.real_results")}
              <span className="block text-primary">{t("header.transformation_stories")}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-fluid-base font-medium leading-8 text-white/80">
              {t("header.subtitle")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#customer-story-grid"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("customer-story-grid")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex h-12 items-center justify-center gap-2 bg-primary px-5 text-sm font-black uppercase text-white transition hover:bg-primary-dark"
              >
                {t("header.view_results")}
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#contact"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex h-12 items-center justify-center gap-2 border border-white/35 px-5 text-sm font-black uppercase text-white transition hover:border-primary hover:text-primary"
              >
                {t("header.start_journey")}
                <Sparkles className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"
              >
                <p className="font-display text-3xl font-bold leading-none text-primary">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs font-bold uppercase leading-5 text-white/75">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-custom py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
              {t("principles.our_philosophy")}
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-fluid-5xl font-bold uppercase leading-tight text-slate-950">
              {t("principles.philosophy_title")}
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600">
              {t("principles.philosophy_text")}
            </p>
            <div className="mt-7 grid gap-4">
              {principles.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="border-l-4 border-primary bg-slate-50 p-4"
                  >
                    <h3 className="flex items-center gap-3 text-lg font-black uppercase text-slate-950">
                      <Icon className="h-6 w-6 shrink-0 text-primary" />
                      {item.title}
                    </h3>
                    <p className="mt-2 pl-9 text-sm leading-6 text-slate-600">
                      {item.text}
                    </p>
                  </article>
                );
              })}
            </div>
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-8 inline-flex h-12 items-center justify-center gap-2 bg-primary px-5 text-sm font-black uppercase text-white transition hover:bg-primary-dark"
            >
              {t("header.register_consultation")}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="relative min-h-[430px]">
            <div className="absolute right-0 top-0 h-[330px] w-[82%] overflow-hidden bg-slate-200 shadow-2xl sm:h-[380px]">
              <img
                src={heroImage}
                alt="Không gian tập luyện HT Coaching"
                className="h-full w-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-black/18" />
            </div>
            <div className="absolute bottom-0 left-0 w-[70%] border-8 border-white bg-white shadow-xl sm:w-[58%]">
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-2">
                <div className="relative overflow-hidden">
                  {collageBefore ? (
                    <img
                      src={collageBefore}
                      alt="Before"
                      className="aspect-[4/5] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[4/5] w-full flex items-center justify-center bg-neutral-100 min-h-[120px]">
                      <UpdatingText className="text-[10px] text-slate-400" />
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 bg-primary px-2 py-1 text-[10px] font-black uppercase text-white">
                    Before
                  </span>
                </div>
                <div className="relative overflow-hidden">
                  {collageAfter ? (
                    <img
                      src={collageAfter}
                      alt="After"
                      className="aspect-[4/5] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[4/5] w-full flex items-center justify-center bg-neutral-100 min-h-[120px]">
                      <UpdatingText className="text-[10px] text-slate-400" />
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 bg-primary px-2 py-1 text-[10px] font-black uppercase text-white">
                    After
                  </span>
                </div>
              </div>
              <div className="border-t-4 border-primary bg-white px-4 py-3">
                <p className="text-xs font-black uppercase text-slate-500">
                  {t("principles.featured_case")}
                </p>
                <p className="mt-1 text-sm font-black uppercase text-slate-950">
                  {featuredStory?.name || t("principles.default_client_name")} -{" "}
                  {featuredStory?.duration || t("principles.default_journey")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="customer-story-grid" className="bg-slate-50 py-14 sm:py-16">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
              Transformation library
            </p>
            <h2 className="mt-3 font-display text-fluid-5xl font-bold uppercase leading-tight text-slate-950">
              {t("header.real_results")} <span className="text-primary">{t("stories_list.weeks")}</span> {/* Keep styling similar */}
            </h2>
            <p className="mt-4 text-fluid-sm leading-7 text-slate-600">
              {t("stories_list.no_results_desc", "Lọc theo độ tuổi, mục tiêu và thời gian để tìm câu chuyện gần với tình trạng hiện tại của bạn nhất.")}
            </p>
          </div>

          <div className="mt-9 grid gap-4 border border-slate-200 bg-white p-4 shadow-sm grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <label className="relative block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                {t("filters.search_placeholder", "Tìm kiếm")}
              </span>
              <Search className="pointer-events-none absolute bottom-4 left-4 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 w-full border border-slate-200 py-3 pl-10 pr-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder={t("filters.search_placeholder")}
              />
            </label>

            <FilterSelect
              label={t("filters.age")}
              value={ageFilter}
              onChange={(event) => setAgeFilter(event.target.value)}
            >
              <option value="">{t("filters.age")}</option>
              <option value="under_20">{t("filters.under_20")}</option>
              <option value="20_29">{t("filters.age_20_29")}</option>
              <option value="30_39">{t("filters.age_30_39")}</option>
              <option value="40_plus">{t("filters.age_40_plus")}</option>
            </FilterSelect>

            <FilterSelect
              label={t("filters.goal")}
              value={goalFilter}
              onChange={(event) => setGoalFilter(event.target.value)}
            >
              <option value="">{t("filters.goal")}</option>
              <option value="fat_loss">{t("filters.fat_loss")}</option>
              <option value="muscle_gain">{t("filters.muscle_gain")}</option>
              <option value="fitness">{t("filters.fitness")}</option>
            </FilterSelect>

            <FilterSelect
              label={t("filters.duration")}
              value={durationFilter}
              onChange={(event) => setDurationFilter(event.target.value)}
            >
              <option value="">{t("filters.duration")}</option>
              <option value="under_12">{t("filters.under_12")}</option>
              <option value="12_16">{t("filters.duration_12_16")}</option>
              <option value="17_24">{t("filters.duration_17_24")}</option>
              <option value="over_24">{t("filters.over_24")}</option>
            </FilterSelect>

            <TrainerFilter
              trainers={trainersList}
              selected={selectedTrainers}
              onChange={setSelectedTrainers}
            />
          </div>

          <div className="mt-9 flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <p className="text-sm font-semibold text-slate-500">
              {t("stories_list.showing_count", "Hiển thị")} <span className="font-black text-slate-950">{filteredStories.length}</span> {t("stories_list.showing_suffix", "câu chuyện")}
            </p>
            <p className="hidden text-xs font-black uppercase tracking-[0.16em] text-primary sm:block">
              Before / After
            </p>
          </div>

          <div className="mt-8">
            <phantom-ui loading={isLoading || undefined}>
              {filteredStories.length === 0 ? (
                <div className="border border-dashed border-slate-300 bg-white py-16 text-center">
                  <p className="text-lg font-bold text-slate-800">
                    {t("stories_list.no_results")}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {t("stories_list.no_results_desc", "Hãy thử đổi bộ lọc hoặc quay lại sau khi admin publish thêm kết quả mới.")}
                  </p>
                </div>
              ) : (
                <div className="grid gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
                  {filteredStories.map((story) => (
                    <StoryGridCard key={story.slug || story._id} story={story} />
                  ))}
                </div>
              )}
            </phantom-ui>
          </div>
        </div>
      </section>

      {/* Internal Linking — SEO Hub */}
      <section className="bg-white py-14 border-t border-slate-200">
        <div className="container-custom">
          <h2 className="text-center text-2xl font-bold uppercase text-slate-950 mb-2">
            {t("explore.title", "Công cụ hỗ trợ")}
          </h2>
          <p className="text-center text-sm text-slate-500 mb-8">
            {t("explore.subtitle", "Bắt đầu hành trình thay đổi vóc dáng ngay hôm nay")}
          </p>
          <div className="grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto">
            <Link
              to="/tdee-calculator"
              className="group border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Sparkles className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-slate-900 group-hover:text-primary transition">
                {t("explore.tdee_title")}
              </h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                {t("explore.tdee_desc")}
              </p>
            </Link>
            <Link
              to="/exercises"
              className="group border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
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
              to="/huan-luyen-vien"
              className="group border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Trophy className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-slate-900 group-hover:text-primary transition">
                {t("explore.trainer_title")}
              </h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                {t("explore.trainer_desc")}
              </p>
            </Link>
          </div>
        </div>
      </section>

      <Contact />
      <ScrollToTop />
    </main>
  );
};

export default CustomerStories;

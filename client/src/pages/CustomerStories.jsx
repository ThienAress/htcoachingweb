import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import hero1 from "../assets/images/hero/hero1.jpg";
import hero2 from "../assets/images/hero/hero2.jpg";
import hero3 from "../assets/images/hero/hero3.jpg";
import SEO from "../components/SEO";

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
  if (!value) return "Chưa cập nhật";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
};

const getStoryImage = (story, key, fallback) =>
  story?.[key] ||
  story?.heroImage ||
  story?.beforeImg ||
  story?.afterImg ||
  fallback;

const stats = [
  { value: "1-1", label: "Theo sát từng buổi" },
  { value: "90+", label: "Ngày xây thói quen" },
  { value: "100%", label: "Lộ trình cá nhân hóa" },
];

const principles = [
  {
    icon: ShieldCheck,
    title: "Đánh giá thật",
    text: "Mỗi hồ sơ bắt đầu từ thể trạng, lịch sinh hoạt và vấn đề riêng của khách hàng.",
  },
  {
    icon: Dumbbell,
    title: "Tập luyện có kiểm soát",
    text: "Giáo án được điều chỉnh theo tiến độ, kỹ thuật và khả năng phục hồi từng tuần.",
  },
  {
    icon: Trophy,
    title: "Kết quả nhìn thấy được",
    text: "Before-after, số đo và câu chuyện đều được lưu lại để bạn thấy hành trình rõ ràng.",
  },
];

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

const StoryGridCard = ({ story }) => {
  const beforeImage = getStoryImage(story, "beforeImg", hero1);
  const afterImage = getStoryImage(story, "afterImg", hero2);

  return (
    <Link
      to={`/ket-qua-khach-hang/${story.slug}`}
      className="group block overflow-hidden border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
    >
      <div className="flex min-h-[70px] items-center justify-between gap-4 bg-primary px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="font-display text-3xl font-bold uppercase leading-none">
            {story.duration || "Hành trình"}
          </p>
          <p className="mt-1 truncate text-[11px] font-bold uppercase leading-4 text-white/90">
            {story.age || "--"} tuổi - {story.job || "Khách hàng"}
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
          <img
            src={beforeImage}
            alt={`${story.name} before`}
            className="aspect-[4/5] w-full object-cover object-center transition duration-500 group-hover:scale-105"
          />
          <span className="absolute bottom-2 left-2 bg-primary px-2 py-1 text-[10px] font-black uppercase text-white shadow">
            Before
          </span>
        </div>
        <div className="relative overflow-hidden bg-neutral-200">
          <img
            src={afterImage}
            alt={`${story.name} after`}
            className="aspect-[4/5] w-full object-cover object-center transition duration-500 group-hover:scale-105"
          />
          <span className="absolute bottom-2 left-2 bg-primary px-2 py-1 text-[10px] font-black uppercase text-white shadow">
            After
          </span>
        </div>
      </div>

      <div className="border-t-4 border-primary p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black uppercase text-slate-900">
              {story.name || "Khách hàng HT"}
            </h3>
            <p className="mt-1 text-xs font-semibold uppercase text-primary">
              {story.result || "Thay đổi vóc dáng"}
            </p>
          </div>
          {story.packageName && (
            <span className="shrink-0 border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase text-primary">
              {story.packageName}
            </span>
          )}
        </div>
        <p className="text-sm leading-6 text-slate-600">
          <strong className="font-black text-slate-800">Mục tiêu:</strong>{" "}
          {getSummary(story.goal, 82)}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          <strong className="font-black text-slate-800">Vấn đề:</strong>{" "}
          {getSummary(story.problem)}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          <strong className="font-black text-slate-800">Giải pháp:</strong>{" "}
          {getSummary(story.solution)}
        </p>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-black uppercase text-primary">
          Xem chi tiết
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
};

const CustomerStories = () => {
  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [durationFilter, setDurationFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["public-customer-stories", "all"],
    queryFn: () => getPublicCustomerStories({ limit: 50 }),
  });

  const stories = useMemo(() => data?.data || [], [data?.data]);
  const featuredStory = stories[0];
  const heroImage = getStoryImage(featuredStory, "heroImage", hero3);
  const collageBefore = getStoryImage(featuredStory, "beforeImg", hero1);
  const collageAfter = getStoryImage(featuredStory, "afterImg", hero2);

  const filteredStories = useMemo(() => {
    const keyword = normalizeText(search.trim());

    return stories.filter((story) => {
      const searchText = normalizeText(
        `${story.name || ""} ${story.job || ""} ${story.goal || ""} ${
          story.result || ""
        }`,
      );

      return (
        (!keyword || searchText.includes(keyword)) &&
        matchesAge(story, ageFilter) &&
        matchesGoal(story, goalFilter) &&
        matchesDuration(story, durationFilter)
      );
    });
  }, [stories, search, ageFilter, goalFilter, durationFilter]);

  return (
    <main className="bg-white">
      <SEO
        title="Kết quả khách hàng thực tế"
        description="Xem ngay hành trình thay đổi vóc dáng ngoạn mục của các học viên tại HTCOACHING. Khám phá các câu chuyện giảm mỡ, tăng cơ và thay đổi hình thể với giáo án 1 kèm 1."
        canonical="/ket-qua-khach-hang"
      />
      <section className="relative min-h-[520px] overflow-hidden bg-black text-white">
        <img
          src={heroImage}
          alt="Kết quả khách hàng HT Coaching"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-55"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.64),rgba(0,0,0,0.24))]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-white to-transparent" />

        <div className="container-custom relative z-10 flex min-h-[520px] flex-col justify-end pb-16 pt-28">
          <div className="max-w-4xl">
            <h1 className="font-display text-5xl font-bold uppercase leading-tight text-white sm:text-6xl lg:text-7xl">
              Kết quả khách hàng
              <span className="block text-primary">HT Coaching</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-white/80 sm:text-lg">
              Những thay đổi thật từ khách hàng thật: có mục tiêu rõ ràng, có
              lộ trình tập luyện cá nhân hóa và có dữ liệu tiến bộ theo từng
              tuần.
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
                Xem kết quả
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
                Bắt đầu hành trình
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
              Kiến thức của chúng tôi
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold uppercase leading-tight text-slate-950 sm:text-5xl">
              Kết quả của bạn là thứ chúng tôi theo đuổi
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600">
              HT Coaching không bán một tấm ảnh “after” đẹp mắt. Chúng tôi xây
              một quá trình đủ rõ: hiểu vấn đề, đặt mục tiêu, tập đúng kỹ thuật,
              ăn uống hợp lý và theo dõi tiến độ liên tục.
            </p>
            <div className="mt-7 grid gap-4">
              {principles.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 border-l-4 border-primary bg-slate-50 p-4"
                  >
                    <div className="flex h-11 w-11 items-center justify-center bg-slate-950 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black uppercase text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {item.text}
                      </p>
                    </div>
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
              Đăng ký tư vấn
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
                  <img
                    src={collageBefore}
                    alt="Before"
                    className="aspect-[4/5] w-full object-cover"
                  />
                  <span className="absolute bottom-2 left-2 bg-primary px-2 py-1 text-[10px] font-black uppercase text-white">
                    Before
                  </span>
                </div>
                <div className="relative overflow-hidden">
                  <img
                    src={collageAfter}
                    alt="After"
                    className="aspect-[4/5] w-full object-cover"
                  />
                  <span className="absolute bottom-2 left-2 bg-primary px-2 py-1 text-[10px] font-black uppercase text-white">
                    After
                  </span>
                </div>
              </div>
              <div className="border-t-4 border-primary bg-white px-4 py-3">
                <p className="text-xs font-black uppercase text-slate-500">
                  Case nổi bật
                </p>
                <p className="mt-1 text-sm font-black uppercase text-slate-950">
                  {featuredStory?.name || "Khách hàng HT Coaching"} -{" "}
                  {featuredStory?.duration || "hành trình thay đổi"}
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
            <h2 className="mt-3 font-display text-4xl font-bold uppercase leading-tight text-slate-950 sm:text-5xl">
              Kết quả <span className="text-primary">khách hàng</span>
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
              Lọc theo độ tuổi, mục tiêu và thời gian để tìm câu chuyện gần với
              tình trạng hiện tại của bạn nhất.
            </p>
          </div>

          <div className="mt-9 grid gap-4 border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <label className="relative block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Tìm kiếm
              </span>
              <Search className="pointer-events-none absolute bottom-4 left-4 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 w-full border border-slate-200 py-3 pl-10 pr-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Tên, nghề, mục tiêu..."
              />
            </label>

            <FilterSelect
              label="Độ tuổi"
              value={ageFilter}
              onChange={(event) => setAgeFilter(event.target.value)}
            >
              <option value="">Tất cả độ tuổi</option>
              <option value="under_20">Dưới 20 tuổi</option>
              <option value="20_29">20-29 tuổi</option>
              <option value="30_39">30-39 tuổi</option>
              <option value="40_plus">Từ 40 tuổi</option>
            </FilterSelect>

            <FilterSelect
              label="Mục tiêu"
              value={goalFilter}
              onChange={(event) => setGoalFilter(event.target.value)}
            >
              <option value="">Tất cả mục tiêu</option>
              <option value="fat_loss">Giảm mỡ</option>
              <option value="muscle_gain">Tăng cơ</option>
              <option value="fitness">Sức khỏe/vóc dáng</option>
            </FilterSelect>

            <FilterSelect
              label="Thời gian"
              value={durationFilter}
              onChange={(event) => setDurationFilter(event.target.value)}
            >
              <option value="">Tất cả thời gian</option>
              <option value="under_12">Đến 12 tuần</option>
              <option value="12_16">12-16 tuần</option>
              <option value="17_24">17-24 tuần</option>
              <option value="over_24">Trên 24 tuần</option>
            </FilterSelect>
          </div>

          <div className="mt-9 flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <p className="text-sm font-semibold text-slate-500">
              Hiển thị{" "}
              <span className="font-black text-slate-950">
                {filteredStories.length}
              </span>{" "}
              câu chuyện
            </p>
            <p className="hidden text-xs font-black uppercase tracking-[0.16em] text-primary sm:block">
              Before / After
            </p>
          </div>

          <div className="mt-8">
            {isLoading ? (
              <div className="border border-dashed border-slate-300 bg-white py-16 text-center text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                Đang tải kết quả khách hàng...
              </div>
            ) : filteredStories.length === 0 ? (
              <div className="border border-dashed border-slate-300 bg-white py-16 text-center">
                <p className="text-lg font-bold text-slate-800">
                  Chưa có câu chuyện phù hợp
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Hãy thử đổi bộ lọc hoặc quay lại sau khi admin publish thêm
                  kết quả mới.
                </p>
              </div>
            ) : (
              <div className="grid gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
                {filteredStories.map((story) => (
                  <StoryGridCard key={story.slug || story._id} story={story} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <Contact />
    </main>
  );
};

export default CustomerStories;

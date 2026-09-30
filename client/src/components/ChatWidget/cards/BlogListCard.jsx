import { ArrowUpRight, BookOpen, Library } from "lucide-react";
import { Link } from "react-router-dom";

import AssistantCard, {
  CardFooter,
  CardList,
  CardSection,
  Tag,
} from "./AssistantCard";

export default function BlogListCard({ data }) {
  if (!data?.posts?.length) return null;

  const totalReadTime = data.posts.reduce(
    (sum, post) => sum + (Number(post.readTime) || 0),
    0,
  );

  return (
    <AssistantCard
      eyebrow="BÀI VIẾT PHÙ HỢP"
      icon={BookOpen}
      iconTone="cyan"
      subtitle="Ưu tiên nội dung sát câu hỏi thay vì bài mới nhất"
      title={data.query || "Bài viết mới nhất"}
      value={`${data.posts.length} bài`}
      valueNote={totalReadTime ? `${totalReadTime} phút đọc` : ""}
      footer={
        <CardFooter
          action="Mở thư viện bài viết"
          icon={Library}
          note="Xếp theo độ liên quan"
          to="/blog/"
        />
      }
    >
      <CardSection>
        <CardList>
          {data.posts.map((post, index) => (
            <li
              className="py-3 first:pt-0 last:pb-0"
              key={post.slug || `${post.title}-${index}`}
            >
              <Link
                className="group flex min-h-16 items-center gap-3 focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                to={`/blog/${post.slug}/`}
              >
                {post.coverImage ? (
                  <img
                    alt=""
                    className="h-12 w-14 shrink-0 rounded-xl object-cover"
                    height="48"
                    loading="lazy"
                    src={post.coverImage}
                    width="56"
                  />
                ) : (
                  <span className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
                    <BookOpen aria-hidden="true" size={18} strokeWidth={1.8} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-pretty text-sm font-medium leading-5 text-slate-900 transition-colors duration-200 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-300 motion-reduce:transition-none">
                    {post.title}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Tag accent>{post.categoryLabel}</Tag>
                    {post.readTime && <Tag>{post.readTime} phút</Tag>}
                  </div>
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="shrink-0 text-slate-400 transition-colors duration-200 group-hover:text-emerald-600 dark:text-zinc-500 dark:group-hover:text-emerald-300 motion-reduce:transition-none"
                  size={17}
                />
              </Link>
            </li>
          ))}
        </CardList>
      </CardSection>
    </AssistantCard>
  );
}

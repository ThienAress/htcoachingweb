import { BookOpen, Clock, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

const CATEGORY_COLORS = {
  "tap-luyen": "bg-blue-500/10 text-blue-400",
  "dinh-duong": "bg-orange-500/10 text-orange-400",
  "hieu-co-the": "bg-purple-500/10 text-purple-400",
  "tu-duy-loi-song": "bg-pink-500/10 text-pink-400",
};

export default function BlogListCard({ data }) {
  if (!data?.posts?.length) return null;

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-2 w-full">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen size={16} className="text-emerald-400" />
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
          {data.query ? `Bài viết: "${data.query}"` : "Bài viết mới nhất"}
        </span>
      </div>

      <div className="space-y-2">
        {data.posts.map((post, i) => (
          <Link
            key={i}
            to={`/blog/${post.slug}`}
            className="flex gap-3 bg-black/20 rounded-lg p-2.5 hover:bg-white/5 transition-colors group"
          >
            {post.coverImage && (
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-16 h-12 rounded-md object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate group-hover:text-emerald-300 transition-colors">
                {post.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[post.category] || "bg-gray-500/10 text-gray-400"}`}>
                  {post.categoryLabel}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                  <Clock size={10} />
                  {post.readTime} phút
                </span>
              </div>
            </div>
            <ExternalLink size={14} className="text-gray-500 group-hover:text-emerald-400 shrink-0 mt-1 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}

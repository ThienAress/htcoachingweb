import { Globe } from "lucide-react";

export default function SourceAvatar({ source, size = "sm" }) {
  const sizeClasses = size === "md"
    ? "h-7 min-w-7 text-xs"
    : "h-5 min-w-5 text-[10px]";

  return (
    <span
      aria-label={source.publisher}
      className={`grid ${sizeClasses} place-items-center rounded-full bg-cyan-100 font-semibold text-cyan-800 dark:bg-cyan-300/15 dark:text-cyan-100`}
      role="img"
      title={source.publisher}
    >
      {source.avatar === "globe" ? <Globe aria-hidden="true" size={size === "md" ? 14 : 12} /> : source.monogram}
    </span>
  );
}

import { ExternalLink } from "lucide-react";

export default function WebImagesStrip({ images }) {
  if (!Array.isArray(images) || images.length === 0) return null;
  return (
    <ul
      aria-label="Hình ảnh minh họa từ nguồn web"
      className="mb-3 flex list-none gap-2 overflow-x-auto p-0 pb-1"
    >
      {images.map((image) => (
        <li className="shrink-0" key={image.src}>
          <a
            className="group relative block h-32 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-white/10 dark:bg-white/5 max-sm:h-28"
            href={image.pageUrl}
            rel="noopener noreferrer"
            target="_blank"
            title={image.title}
          >
            <img
              alt={image.title}
              className="h-full w-auto max-w-[240px] object-cover"
              decoding="async"
              loading="lazy"
              referrerPolicy="no-referrer"
              src={image.src}
            />
            <span className="absolute bottom-1 left-1 inline-flex max-w-[calc(100%-0.5rem)] items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white">
              <span className="truncate">{image.host}</span>
              <ExternalLink aria-hidden="true" size={10} strokeWidth={2} />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

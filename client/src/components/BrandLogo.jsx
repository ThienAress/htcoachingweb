const BRAND_PATH = "/branding/ht-v2";

/** Surface refers to the background, not the designer's artwork filename. */
export default function BrandLogo({
  variant = "wordmark",
  surface = "light",
  decorative = false,
  className = "",
  ref,
}) {
  const tone = surface === "dark" ? "light" : "dark";
  const wordmark = `${BRAND_PATH}/htcoaching-wordmark-${tone}.svg`;
  const mark = `${BRAND_PATH}/ht-mark-${surface === "dark" ? "on-dark" : "color"}.svg`;
  const lockup = `${BRAND_PATH}/htcoaching-lockup-slogan-${tone}.svg`;
  const alt = decorative ? "" : "HTCOACHING";

  if (variant === "header") {
    return (
      <picture className={`block shrink-0 ${className}`}>
        <source media="(min-width: 1024px)" srcSet={wordmark} width="1398.1" height="224" />
        <img ref={ref} src={mark} width="1000" height="1000" alt={alt} aria-hidden={decorative || undefined}
          className="block h-11 w-11 object-contain lg:h-auto lg:w-[150px] xl:w-[176px]" />
      </picture>
    );
  }

  if (variant === "footer") {
    return (
      <picture className={`block shrink-0 ${className}`}>
        <source media="(min-width: 1024px) and (max-width: 1279px)" srcSet={wordmark} width="1398.1" height="224" />
        <img ref={ref} src={lockup} width="1398.1" height="330" alt={alt} aria-hidden={decorative || undefined}
          className="block h-auto w-[260px] object-contain lg:w-[180px] xl:w-[260px]" />
      </picture>
    );
  }

  const isMark = variant === "mark";
  return (
    <img ref={ref} src={isMark ? mark : wordmark}
      width={isMark ? 1000 : 1398.1} height={isMark ? 1000 : 224}
      alt={alt} aria-hidden={decorative || undefined} className={`block object-contain ${className}`} />
  );
}

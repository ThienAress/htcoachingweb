import { ArrowUpRight } from "lucide-react";

const socialPlatforms = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "zalo", label: "Zalo" },
  { key: "lemon8", label: "Lemon8" },
  { key: "threads", label: "Threads" },
];

const normalizeSocialLink = (platform, value) => {
  if (!value) return null;
  if (platform === "zalo" && !value.startsWith("http")) {
    return `https://zalo.me/${value}`;
  }
  return value;
};

const TrainerSocialLinks = ({ socialLinks }) => {
  const availableLinks = socialPlatforms
    .map((platform) => ({
      ...platform,
      href: normalizeSocialLink(platform.key, socialLinks?.[platform.key]),
    }))
    .filter((platform) => platform.href);

  if (availableLinks.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {availableLinks.map((platform) => (
        <a
          key={platform.key}
          href={platform.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={platform.label}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 transition-[color,background-color,border-color] duration-200 hover:border-primary/60 hover:bg-primary/10 hover:text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          {platform.label}
          <ArrowUpRight aria-hidden="true" size={14} />
        </a>
      ))}
    </div>
  );
};

export default TrainerSocialLinks;

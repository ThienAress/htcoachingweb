import { BadgeCheck, ExternalLink, Globe2 } from "lucide-react";

import AssistantCard, {
  CardFooter,
  CardList,
  CardNotice,
  CardSection,
  CardSectionLabel,
  IndexBadge,
} from "./AssistantCard";

const MAX_SOURCES = 3;

const stripUnsafeDisplayCharacters = (value) =>
  Array.from(String(value || ""), (character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 ||
      codePoint === 127 ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x2069)
      ? " "
      : character;
  }).join("");

const normalizeSource = (source) => {
  try {
    const url = new URL(String(source?.uri || ""));
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";

    const host = url.hostname.replace(/^www\./i, "");
    const rawTitle = stripUnsafeDisplayCharacters(source?.title)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    if (!rawTitle || !host) return null;

    const suffixes = [` (${url.hostname})`, ` (${host})`];
    const matchedSuffix = suffixes.find((suffix) => rawTitle.endsWith(suffix));
    const title = matchedSuffix
      ? rawTitle.slice(0, -matchedSuffix.length).trim()
      : rawTitle;

    return { title: title || host, host, uri: url.href };
  } catch {
    return null;
  }
};

const getSafeSources = (sources) => {
  const seen = new Set();
  return (Array.isArray(sources) ? sources : [])
    .map(normalizeSource)
    .filter((source) => {
      if (!source || seen.has(source.uri)) return false;
      seen.add(source.uri);
      return true;
    })
    .slice(0, MAX_SOURCES);
};

const formatSearchedAt = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tra cứu gần đây";

  const formatOptions = { timeZone: "Asia/Ho_Chi_Minh" };
  const time = new Intl.DateTimeFormat("vi-VN", {
    ...formatOptions,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const day = new Intl.DateTimeFormat("vi-VN", {
    ...formatOptions,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  return `Tra cứu lúc ${time} · ${day}`;
};

export default function WebSourcesCard({ data }) {
  const sources = getSafeSources(data?.sources);
  if (sources.length === 0) return null;

  const topic = stripUnsafeDisplayCharacters(
    data?.topic || "Nguồn cho câu trả lời",
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "Nguồn cho câu trả lời";

  return (
    <AssistantCard
      eyebrow="NGUỒN WEB ĐÃ XÁC MINH"
      icon={Globe2}
      iconTone="cyan"
      subtitle="Các nguồn hỗ trợ trực tiếp cho phần trả lời phía trên"
      title={topic}
      value={`${sources.length} nguồn`}
      valueNote="đã đối chiếu claim"
      footer={
        <CardFooter
          action="Mở nguồn đầu tiên"
          href={sources[0].uri}
          icon={ExternalLink}
          note={formatSearchedAt(data?.searchedAt)}
        />
      }
    >
      <CardSection>
        <CardNotice icon={BadgeCheck}>
          Chỉ các ý có liên kết grounding hợp lệ mới được đưa vào câu trả lời.
          Nguồn không hỗ trợ trực tiếp sẽ bị loại.
        </CardNotice>
      </CardSection>

      <CardSection>
        <CardSectionLabel>Nguồn được sử dụng</CardSectionLabel>
        <CardList>
          {sources.map((source, index) => (
            <li
              className="py-3 first:pt-0 last:pb-0"
              key={source.uri}
            >
              <a
                className="group flex min-h-14 items-center gap-3 focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                href={source.uri}
                rel="noopener noreferrer"
                target="_blank"
              >
                <IndexBadge tone="cyan">
                  {String(index + 1).padStart(2, "0")}
                </IndexBadge>
                <div className="min-w-0 flex-1">
                  <p className="text-pretty text-sm font-medium leading-5 text-slate-900 transition-colors duration-200 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-300 motion-reduce:transition-none">
                    {source.title}
                  </p>
                  <p className="mt-1 break-all text-xs leading-5 text-slate-500 dark:text-zinc-400">
                    {source.host}
                  </p>
                </div>
                <ExternalLink
                  aria-hidden="true"
                  className="shrink-0 text-slate-400 transition-colors duration-200 group-hover:text-emerald-600 dark:text-zinc-500 dark:group-hover:text-emerald-300 motion-reduce:transition-none"
                  size={17}
                  strokeWidth={1.8}
                />
                <span className="sr-only">Mở nguồn trong thẻ mới</span>
              </a>
            </li>
          ))}
        </CardList>
      </CardSection>
    </AssistantCard>
  );
}

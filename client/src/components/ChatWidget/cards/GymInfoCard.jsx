import { Building2, Map, MapPin } from "lucide-react";

import AssistantCard, {
  CardFooter,
  CardList,
  CardSection,
  IndexBadge,
  Tag,
} from "./AssistantCard";

const getSafeMapUrl = (value) => {
  if (!value) return "";

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

export default function GymInfoCard({ data }) {
  if (!data?.gyms?.length) return null;

  const kickfitCount = data.gyms.filter((gym) => gym.hasKickfit).length;

  return (
    <AssistantCard
      eyebrow="CÂU LẠC BỘ"
      icon={MapPin}
      iconTone="cyan"
      subtitle="Thông tin giờ mở cửa và tiện ích"
      title="Câu lạc bộ phù hợp"
      value={`${data.gyms.length} địa điểm`}
      valueNote={kickfitCount ? `${kickfitCount} nơi có lớp Kickfit` : "đang hoạt động"}
      footer={
        <CardFooter
          action="Xem tất cả CLB"
          icon={MapPin}
          note="Giờ hoạt động có thể đổi vào ngày lễ"
          to="/club/"
        />
      }
    >
      <CardSection>
        <CardList>
          {data.gyms.map((gym, index) => {
            const mapUrl = getSafeMapUrl(gym.googleMapsUrl);
            const content = (
              <>
                <IndexBadge tone="cyan">
                  <Building2 aria-hidden="true" size={15} strokeWidth={1.8} />
                </IndexBadge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5 text-slate-900 dark:text-zinc-100">
                    {gym.name}
                  </p>
                  <p className="mt-1 text-pretty text-xs leading-5 text-slate-500 dark:text-zinc-400">
                    {[gym.address, gym.district, gym.openingHours]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {(gym.hasKickfit || gym.note) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {gym.hasKickfit && <Tag accent>Kickfit</Tag>}
                      {gym.note && <Tag>{gym.note}</Tag>}
                    </div>
                  )}
                </div>
                {mapUrl && (
                  <Map
                    aria-hidden="true"
                    className="shrink-0 text-slate-400 transition-colors duration-200 group-hover:text-emerald-600 dark:text-zinc-500 dark:group-hover:text-emerald-300 motion-reduce:transition-none"
                    size={17}
                  />
                )}
              </>
            );

            return (
              <li
                className="py-3 first:pt-0 last:pb-0"
                key={`${gym.name}-${index}`}
              >
                {mapUrl ? (
                  <a
                    className="group flex items-start gap-3 focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    href={mapUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {content}
                    <span className="sr-only">Mở bản đồ</span>
                  </a>
                ) : (
                  <div className="flex items-start gap-3">{content}</div>
                )}
              </li>
            );
          })}
        </CardList>
      </CardSection>
    </AssistantCard>
  );
}

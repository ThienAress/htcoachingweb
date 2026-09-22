import { ArrowUpRight, Users } from "lucide-react";
import { Link } from "react-router-dom";

import AssistantCard, {
  CardFooter,
  CardList,
  CardSection,
  Tag,
} from "./AssistantCard";

const getInitials = (name) =>
  String(name || "HLV")
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function TrainerInfoCard({ data }) {
  if (!data?.trainers?.length) return null;

  return (
    <AssistantCard
      eyebrow="HUẤN LUYỆN VIÊN"
      icon={Users}
      subtitle="Xếp theo chuyên môn và trạng thái công khai"
      title="Huấn luyện viên phù hợp"
      value={`${data.trainers.length} HLV`}
      valueNote={
        data.totalCount > data.trainers.length
          ? `${data.totalCount} hồ sơ trong hệ thống`
          : "hồ sơ đã xác minh"
      }
      footer={
        <CardFooter
          action="Xem tất cả HLV"
          icon={Users}
          note="Hồ sơ được HTCOACHING quản lý"
          to="/#trainers"
        />
      }
    >
      <CardSection>
        <CardList>
          {data.trainers.map((trainer, index) => {
            const content = (
              <>
                {trainer.image ? (
                  <img
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                    height="44"
                    loading="lazy"
                    src={trainer.image}
                    width="44"
                  />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-50 text-[13px] font-medium text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
                    {getInitials(trainer.name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5 text-slate-900 dark:text-zinc-100">
                    {trainer.name}
                    {trainer.isHeadCoach && (
                      <span className="text-slate-500 dark:text-zinc-400"> · Head Coach</span>
                    )}
                  </p>
                  {(trainer.title || trainer.experience) && (
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                      {[trainer.title, trainer.experience && `${trainer.experience} kinh nghiệm`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {trainer.specialties?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {trainer.specialties.slice(0, 3).map((specialty, specialtyIndex) => (
                        <Tag accent={specialtyIndex === 0} key={specialty}>
                          {specialty}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
                {trainer.slug && (
                  <ArrowUpRight
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
                key={trainer.slug || `${trainer.name}-${index}`}
              >
                {trainer.slug ? (
                  <Link
                    className="group flex items-center gap-3 focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    to={`/huan-luyen-vien/${trainer.slug}/`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">{content}</div>
                )}
              </li>
            );
          })}
        </CardList>
      </CardSection>
    </AssistantCard>
  );
}

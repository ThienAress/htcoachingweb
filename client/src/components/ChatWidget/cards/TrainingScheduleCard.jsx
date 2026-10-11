import { CalendarDays, Clock3, ExternalLink, MessageCircle } from "lucide-react";

import AssistantCard, {
  CardFooter,
  CardNotice,
  CardSection,
  CardSectionLabel,
  IndexBadge,
  Tag,
} from "./AssistantCard";

export default function TrainingScheduleCard({ data }) {
  if (!data) return null;

  const todaySchedules = data.todaySchedules || [];
  const primarySchedule = todaySchedules[0];
  const weekSchedule = (data.weekSchedule || []).slice(0, 5);

  return (
    <AssistantCard
      eyebrow="LỊCH TẬP"
      icon={CalendarDays}
      iconTone="cyan"
      subtitle={
        todaySchedules.length
          ? `${todaySchedules.length} buổi trong hôm nay`
          : "Không có buổi tập được xếp hôm nay"
      }
      title={data.todayLabel || "Lịch tập hôm nay"}
      value={primarySchedule?.startTime || "Nghỉ"}
      valueNote={primarySchedule?.exerciseType || "Phục hồi và chuẩn bị buổi tới"}
      footer={
        <CardFooter
          action="Xem lịch đầy đủ"
          icon={ExternalLink}
          note="Múi giờ Asia/Saigon"
          to="/training-schedule"
        />
      }
    >
      {todaySchedules.map((schedule, index) => (
        <CardSection key={`${schedule.startTime}-${schedule.exerciseType}-${index}`}>
          <div className="flex items-start gap-3">
            <IndexBadge tone="cyan">
              <Clock3 aria-hidden="true" size={15} strokeWidth={1.8} />
            </IndexBadge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                {schedule.exerciseType || "Buổi tập"}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                {schedule.startTime}–{schedule.endTime}
                {schedule.notes ? ` · ${schedule.notes}` : ""}
              </p>
            </div>
            <Tag accent>Đã xác nhận</Tag>
          </div>
        </CardSection>
      ))}

      {data.coachingDay && (
        <CardSection>
          <CardSectionLabel>Giáo án hôm nay</CardSectionLabel>
          <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
            {data.coachingDay.title}
          </p>
          {data.coachingDay.exercises?.length > 0 && (
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {data.coachingDay.exercises.filter((exercise) => exercise.completed).length}/
              {data.coachingDay.exercises.length} bài đã hoàn thành
            </p>
          )}
          {data.coachingDay.note && (
            <div className="mt-3">
              <CardNotice icon={MessageCircle}>{data.coachingDay.note}</CardNotice>
            </div>
          )}
        </CardSection>
      )}

      {weekSchedule.length > 0 && (
        <CardSection>
          <CardSectionLabel>Lịch sắp tới</CardSectionLabel>
          <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3">
            {weekSchedule.map((schedule, index) => (
              <div
                className="rounded-xl bg-slate-100 px-2 py-2 text-center text-xs text-slate-600 dark:bg-white/[0.06] dark:text-zinc-300"
                key={`${schedule.occurrenceDateKey || schedule.dayLabel}-${schedule.startTime}-${index}`}
              >
                <span className="block truncate">{schedule.dayLabel || schedule.occurrenceDateKey}</span>
                <strong className="mt-1 block font-medium text-slate-900 dark:text-zinc-100">
                  {schedule.startTime}
                </strong>
              </div>
            ))}
          </div>
        </CardSection>
      )}
    </AssistantCard>
  );
}

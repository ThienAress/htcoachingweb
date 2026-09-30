import { ArrowUpRight, Dumbbell } from "lucide-react";

import AssistantCard, {
  CardFooter,
  CardList,
  CardNotice,
  CardSection,
  IndexBadge,
  Tag,
} from "./AssistantCard";

export default function ExerciseListCard({ data }) {
  if (!data?.exercises?.length) return null;

  const resultCount = data.resultCount ?? data.exercises.length;
  const requestedCount = data.requestedCount ?? data.exercises.length;
  const muscleGroups = [
    ...new Set(data.exercises.map((exercise) => exercise.muscleGroup).filter(Boolean)),
  ];

  return (
    <AssistantCard
      eyebrow="THƯ VIỆN BÀI TẬP"
      icon={Dumbbell}
      subtitle="Kết quả có sẵn trong dữ liệu HTCOACHING"
      title={data.searchedFor || "Bài tập phù hợp"}
      value={`${resultCount} bài`}
      valueNote={muscleGroups.slice(0, 3).join(" · ")}
      footer={
        <CardFooter
          action="Xem đủ bài tập"
          icon={ArrowUpRight}
          note={`Hiện ${resultCount}/${requestedCount} kết quả`}
          to="/exercises/"
        />
      }
    >
      <CardSection>
        <CardList>
          {data.exercises.map((exercise, index) => (
            <li
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              key={`${exercise.name}-${index}`}
            >
              <IndexBadge>{String(index + 1).padStart(2, "0")}</IndexBadge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-5 text-slate-900 dark:text-zinc-100">
                  {exercise.name}
                </p>
                {exercise.description && (
                  <p className="mt-1 line-clamp-2 text-pretty text-xs leading-5 text-slate-500 dark:text-zinc-400">
                    {exercise.description}
                  </p>
                )}
              </div>
              {exercise.muscleGroup && <Tag accent>{exercise.muscleGroup}</Tag>}
            </li>
          ))}
        </CardList>
      </CardSection>

      {data.catalogInsufficient === true && (
        <CardSection>
          <CardNotice role="status" tone="amber">
            Hiện tìm thấy {resultCount}/{requestedCount} bài phù hợp với bộ lọc và thiết bị bạn đã nêu.
          </CardNotice>
        </CardSection>
      )}

      {data.scanIncomplete === true && data.catalogInsufficient !== true && (
        <CardSection>
          <CardNotice role="status" tone="amber">
            Kết quả hiện chưa đủ {requestedCount} bài và chưa quét hết thư viện trong giới hạn an toàn. Hãy thu hẹp nhóm cơ hoặc tiêu chí để tìm chính xác hơn.
          </CardNotice>
        </CardSection>
      )}
    </AssistantCard>
  );
}

import { useId, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  MessageCircle,
} from "lucide-react";

import AssistantCard, {
  CardFooter,
  CardNotice,
  CardSection,
  CardSectionLabel,
} from "./AssistantCard";

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không rõ ngày" : date.toLocaleDateString("vi-VN");
};

const getExerciseCount = (plan) =>
  plan.sections?.reduce(
    (sum, section) => sum + (section.exercises?.length || 0),
    0,
  ) || 0;

export default function WorkoutPlanCard({ data }) {
  if (!data?.plans?.length) return null;

  const latestPlan = data.plans[0];
  const latestExerciseCount = getExerciseCount(latestPlan);

  return (
    <AssistantCard
      eyebrow="GIÁO ÁN TẬP LUYỆN"
      icon={ClipboardList}
      subtitle={`${formatDate(latestPlan.planDate)} · ${latestExerciseCount} bài tập`}
      title={latestPlan.title}
      value={`${data.plans.length} buổi`}
      valueNote="gần nhất"
      footer={
        <CardFooter
          action="Mở giáo án"
          icon={ArrowUpRight}
          note={`${latestPlan.status === "completed" ? "Đã hoàn thành" : "Đang thực hiện"} · ${latestExerciseCount} bài`}
          to="/workout-plans"
        />
      }
    >
      <CardSection className="!py-0">
        <div className="divide-y divide-slate-200 dark:divide-white/10">
          {data.plans.map((plan, index) => (
            <PlanItem defaultOpen={index === 0} key={`${plan.planDate}-${index}`} plan={plan} />
          ))}
        </div>
      </CardSection>
    </AssistantCard>
  );
}

function PlanItem({ plan, defaultOpen }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = useId();
  const isCompleted = plan.status === "completed";
  const totalExercises = getExerciseCount(plan);

  return (
    <div className="py-3 first:pt-4 last:pb-4">
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl text-left transition-colors duration-200 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:text-emerald-300 motion-reduce:transition-none"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {isCompleted ? (
          <CheckCircle2
            aria-hidden="true"
            className="shrink-0 text-emerald-600 dark:text-emerald-300"
            size={17}
          />
        ) : (
          <Clock3
            aria-hidden="true"
            className="shrink-0 text-amber-600 dark:text-amber-300"
            size={17}
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-5">{plan.title}</span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-zinc-400">
            {formatDate(plan.planDate)} · {totalExercises} bài tập
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`shrink-0 text-slate-400 transition-transform duration-200 dark:text-zinc-500 motion-reduce:transition-none ${
            isOpen ? "rotate-180" : ""
          }`}
          size={17}
        />
      </button>

      {isOpen && (
        <div className="pt-4" id={panelId}>
          {plan.sections?.map((section, sectionIndex) => (
            <div
              className="border-t border-slate-200 py-4 first:border-t-0 first:pt-0 dark:border-white/10"
              key={`${section.name}-${sectionIndex}`}
            >
              <CardSectionLabel>{section.name}</CardSectionLabel>
              <ul className="divide-y divide-slate-100 dark:divide-white/[0.07]">
                {section.exercises?.map((exercise, exerciseIndex) => (
                  <li
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    key={`${exercise.name}-${exerciseIndex}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        exercise.assessment === "pass"
                          ? "bg-emerald-500"
                          : exercise.assessment === "fail"
                            ? "bg-rose-500"
                            : "bg-amber-500"
                      }`}
                    />
                    <span className="min-w-0 flex-1 text-sm text-slate-800 dark:text-zinc-200">
                      {exercise.name}
                    </span>
                    {(exercise.sets || exercise.reps) && (
                      <span className="shrink-0 text-[13px] font-medium text-cyan-700 dark:text-cyan-300">
                        {[exercise.sets, exercise.reps].filter(Boolean).join(" × ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {plan.trainerNote && (
            <CardNotice icon={MessageCircle}>{plan.trainerNote}</CardNotice>
          )}
        </div>
      )}
    </div>
  );
}

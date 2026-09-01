import { Target } from "lucide-react";

import { HabitCard } from "./HabitCard";
import { WellnessCard } from "./WellnessCard";

export const HealthGoalsSection = ({
  dateKey,
  journal,
  canEdit,
  onChanged,
  sectionRef,
}) => (
  <section
    ref={sectionRef}
    tabIndex={-1}
    className="rounded-3xl border border-orange-400/20 bg-slate-900/45 p-3 shadow-sm sm:p-4"
    aria-labelledby="customer-health-goals-title"
  >
    <header className="flex items-start gap-4 px-2 pb-4 pt-2 sm:px-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-400/10">
        <Target className="h-6 w-6 text-orange-300" aria-hidden="true" />
      </span>
      <div>
        <h2
          id="customer-health-goals-title"
          className="text-2xl font-bold text-white sm:text-3xl"
        >
          Mục tiêu sức khỏe
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Cập nhật chỉ số và Thói quen khách hàng trong cùng một nơi.
        </p>
      </div>
    </header>
    <div className="space-y-4">
      <WellnessCard
        key={`${dateKey}:${journal?._id || "new"}:${journal?.revision || 0}`}
        dateKey={dateKey}
        journal={journal}
        canEdit={canEdit}
        onChanged={onChanged}
      />
      <HabitCard
        dateKey={dateKey}
        journal={journal}
        canEdit={canEdit}
        onChanged={onChanged}
      />
    </div>
  </section>
);

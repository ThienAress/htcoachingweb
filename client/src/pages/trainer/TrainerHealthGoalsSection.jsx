import { Target } from "lucide-react";

import { TrainerHabitManager } from "./TrainerHabitManager";
import { TrainerWellnessTargetCard } from "./TrainerWellnessTargetCard";

export const TrainerHealthGoalsSection = ({ clientId, dateKey }) => (
  <section
    className="rounded-3xl border border-cyan-400/20 bg-slate-900/45 p-3 shadow-sm sm:p-4"
    aria-labelledby="trainer-health-goals-title"
  >
    <header className="flex items-start gap-4 px-2 pb-4 pt-2 sm:px-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10">
        <Target className="h-6 w-6 text-cyan-300" aria-hidden="true" />
      </span>
      <div>
        <h2
          id="trainer-health-goals-title"
          className="text-2xl font-bold text-slate-50 sm:text-3xl"
        >
          Mục tiêu sức khỏe
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Theo dõi chỉ số mục tiêu và thói quen của khách hàng trong cùng một kế hoạch.
        </p>
      </div>
    </header>
    <div className="space-y-4">
      <TrainerWellnessTargetCard clientId={clientId} />
      <TrainerHabitManager clientId={clientId} dateKey={dateKey} />
    </div>
  </section>
);

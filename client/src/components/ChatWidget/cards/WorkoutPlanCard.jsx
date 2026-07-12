import { Dumbbell, CheckCircle, Clock, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function WorkoutPlanCard({ data }) {
  if (!data?.plans?.length) return null;

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-2 w-full">
      <div className="flex items-center gap-2 mb-1">
        <Dumbbell size={16} className="text-emerald-400" />
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Giáo án tập luyện</span>
      </div>

      <div className="space-y-2">
        {data.plans.map((plan, i) => (
          <PlanItem key={i} plan={plan} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}

function PlanItem({ plan, defaultOpen }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const planDate = new Date(plan.planDate).toLocaleDateString("vi-VN");
  const isCompleted = plan.status === "completed";
  const totalExercises = plan.sections?.reduce(
    (sum, sec) => sum + (sec.exercises?.length || 0),
    0
  ) || 0;

  return (
    <div className="bg-black/20 rounded-lg overflow-hidden">
      {/* Plan header — clickable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-white/5 transition-colors"
      >
        {isCompleted ? (
          <CheckCircle size={14} className="text-emerald-400 shrink-0" />
        ) : (
          <Clock size={14} className="text-yellow-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{plan.title}</p>
          <p className="text-[10px] text-gray-400">
            {planDate} · {totalExercises} bài tập
          </p>
        </div>
        <ChevronDown
          size={14}
          className={`text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Sections — expandable */}
      {isOpen && plan.sections?.length > 0 && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {plan.sections.map((section, j) => (
            <div key={j}>
              <p className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider mb-1">
                {section.icon && <span className="mr-1">{section.icon}</span>}
                {section.name}
              </p>
              <div className="space-y-0.5">
                {section.exercises?.map((ex, k) => (
                  <div key={k} className="flex items-center gap-2 text-[11px] py-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      ex.assessment === "pass" ? "bg-emerald-400" :
                      ex.assessment === "fail" ? "bg-red-400" :
                      "bg-gray-500"
                    }`} />
                    <span className="text-gray-300 flex-1 truncate">{ex.name}</span>
                    {(ex.sets || ex.reps) && (
                      <span className="text-gray-500 shrink-0">
                        {[ex.sets && `${ex.sets}S`, ex.reps && `${ex.reps}R`].filter(Boolean).join(" × ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {plan.trainerNote && (
            <div className="mt-1.5 pt-1.5 border-t border-white/5">
              <p className="text-[10px] text-gray-400">
                💬 {plan.trainerNote.substring(0, 120)}{plan.trainerNote.length > 120 ? "..." : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

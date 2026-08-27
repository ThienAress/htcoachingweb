import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Dumbbell,
  FileText,
  Info,
  Send,
} from "lucide-react";

import ExerciseSections from "./ExerciseSections";
import MuscleGroupSelector from "./MuscleGroupSelector";
import { workoutExplanations } from "./constants";

const explanationKeys = {
  "WARM UP": "warmUp",
  "STRENGTH PREPARATION": "strength",
  "COMPOUND TRAINING": "compound",
  "ISOLATION TRAINING": "isolation",
  "COOLDOWN / STRETCHING": "cooldown",
};

export default function WorkoutPlanner({
  logic,
  exerciseOptions,
  onBack,
  onExportPDF,
  suggestion,
  onSuggestionChange,
  sending,
  onSendSuggestion,
}) {
  const { t } = useTranslation("exercises");
  const hasSelectedMuscleGroups = logic.selectedMuscleGroups.length > 0;

  return (
    <div data-workout-planner="true">
      <div className="flex flex-col gap-6 border-b border-gray-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <button
            type="button"
            onClick={onBack}
            className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-200 transition-[border-color,color,background-color] duration-200 hover:border-primary hover:bg-gray-900 hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 motion-reduce:transition-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("planner.back_to_library")}
          </button>
          <h1 className="font-display text-fluid-5xl font-black uppercase leading-none tracking-normal text-white text-balance">
            {t("planner.title")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-300 text-pretty">
            {t("planner.description")}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.12em] text-primary">
          <Dumbbell className="size-5" aria-hidden="true" />
          {t("planner.secondary_label")}
        </div>
      </div>

      <section className="py-8" aria-labelledby="planner-muscle-groups-title">
        <h2 id="planner-muscle-groups-title" className="mb-5 text-2xl font-black uppercase text-white">
          {t("card_title")}
        </h2>
        <MuscleGroupSelector
          muscleGroups={[...logic.muscleGroups, ...logic.customGroups]}
          selected={logic.selectedMuscleGroups}
          onToggle={logic.toggleMuscleGroup}
          showCustomGroupModal={logic.showCustomGroupModal}
          setShowCustomGroupModal={logic.setShowCustomGroupModal}
          tempSelectedGroups={logic.tempSelectedGroups}
          setTempSelectedGroups={logic.setTempSelectedGroups}
          handleCreateCustomGroup={logic.handleCreateCustomGroup}
          customGroupName={logic.customGroupName}
          setCustomGroupName={logic.setCustomGroupName}
        />
      </section>

      {hasSelectedMuscleGroups && (
        <ExerciseSections
          selectedMuscleGroups={logic.selectedMuscleGroups}
          workoutData={logic.workoutData}
          handleAddExercise={logic.handleAddExercise}
          handleDeleteExercise={logic.handleDeleteExercise}
          handleExerciseChange={logic.handleExerciseChange}
          exerciseOptions={exerciseOptions}
          toggleMuscleGroup={logic.toggleMuscleGroup}
          formatDate={logic.formatDate}
          isMobile={logic.isMobile}
          getMuscleGroupById={logic.getMuscleGroupById}
        />
      )}

      {hasSelectedMuscleGroups && (
        <section className="mt-8 border-y border-gray-800 py-7" aria-labelledby="workout-explanation-title">
          <div className="mb-5 flex items-center gap-2">
            <Info className="size-6 text-primary" aria-hidden="true" />
            <h2 id="workout-explanation-title" className="text-xl font-bold text-white">
              {t("explanation.title")}
            </h2>
          </div>

          <dl className="divide-y divide-gray-800">
            {workoutExplanations.map((item) => {
              const descriptionKey = explanationKeys[item.title];
              return (
                <div key={item.title} className="grid gap-2 py-4 sm:grid-cols-[minmax(12rem,16rem)_1fr] sm:gap-6">
                  <dt className="font-sans text-sm font-bold uppercase leading-6 tracking-[0.08em] text-orange-300 sm:text-base">
                    {item.title}
                  </dt>
                  <dd className="min-w-0 text-base leading-7 text-gray-300 text-pretty">
                    {descriptionKey ? t(`explanation.${descriptionKey}`) : item.description}
                  </dd>
                </div>
              );
            })}
          </dl>

          <div className="mt-3 space-y-2 border-t border-gray-800 pt-5">
            <p className="text-base italic text-gray-200">{t("explanation.footer_1")}</p>
            <p className="text-base font-semibold italic text-amber-300">{t("explanation.footer_2")}</p>
          </div>
        </section>
      )}

      {hasSelectedMuscleGroups && (
        <div className="mt-8 flex justify-start">
          <button
            type="button"
            onClick={onExportPDF}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white transition-colors duration-200 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 motion-reduce:transition-none"
          >
            <FileText className="size-5" aria-hidden="true" />
            {t("btn_export_pdf")}
          </button>
        </div>
      )}

      {hasSelectedMuscleGroups && (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">{t("suggestion.title")}</span>
            <textarea
              name="exercise-suggestion"
              rows={2}
              placeholder={t("suggestion.placeholder")}
              value={suggestion}
              onChange={(event) => onSuggestionChange(event.target.value)}
              disabled={sending}
              className="w-full resize-none rounded-xl border border-gray-700 bg-gray-900 p-3 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-wait disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            onClick={onSendSuggestion}
            disabled={sending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2 font-bold text-white transition-colors duration-200 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none"
          >
            <Send className="size-4" aria-hidden="true" />
            {sending ? t("suggestion.sending") : t("suggestion.send")}
          </button>
        </div>
      )}
    </div>
  );
}

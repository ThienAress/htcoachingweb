import { useState } from "react";

export default function ExerciseSetupGuide({ instructions = [], t }) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  if (!instructions.length) {
    return (
      <section
        aria-labelledby="exercise-setup-title"
        className="border-t border-gray-800 py-14 sm:py-16"
      >
        <h2
          id="exercise-setup-title"
          className="text-3xl font-black uppercase text-white text-balance"
        >
          {t("detail.setup_title")}
        </h2>
        <div className="mt-8 rounded-2xl border border-dashed border-gray-700 bg-gray-900/60 p-6 text-sm leading-6 text-gray-400">
          {t("detail.setup_empty")}
        </div>
      </section>
    );
  }

  const activeStep = instructions[activeStepIndex] || instructions[0];

  return (
    <section
      aria-labelledby="exercise-setup-title"
      className="border-t border-gray-800 py-14 sm:py-16"
    >
      <h2
        id="exercise-setup-title"
        className="text-3xl font-black uppercase text-white text-balance"
      >
        {t("detail.setup_title")}
      </h2>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)] lg:gap-14">
        <ol
          className="flex gap-2 overflow-x-auto overscroll-x-contain pb-3 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0"
          data-exercise-setup-steps="rail"
        >
          {instructions.map((step, index) => {
            const isActive = activeStepIndex === index;

            return (
              <li key={`${step.title}-${index}`} className="shrink-0 lg:w-full">
                <button
                  id={`exercise-step-trigger-${index}`}
                  type="button"
                  aria-controls="exercise-active-step"
                  aria-current={isActive ? "step" : undefined}
                  data-exercise-step-trigger={index + 1}
                  onClick={() => setActiveStepIndex(index)}
                  className={`relative flex min-h-16 w-full min-w-56 items-center gap-4 overflow-hidden rounded-xl px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 lg:min-w-0 ${
                    isActive
                      ? "bg-primary/10 text-white before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary"
                      : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
                  }`}
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                      isActive
                        ? "bg-primary text-white"
                        : "bg-gray-800 text-gray-200"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="font-semibold whitespace-nowrap lg:whitespace-normal">
                    {step.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <article
          id="exercise-active-step"
          aria-labelledby={`exercise-step-trigger-${activeStepIndex}`}
          aria-live="polite"
          className="self-start rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-8 lg:sticky lg:top-28"
          data-active-step={activeStepIndex + 1}
          data-exercise-setup-detail="true"
        >
          <div
            role="progressbar"
            aria-label={t("detail.setup_step_progress", {
              current: activeStepIndex + 1,
              total: instructions.length,
            })}
            aria-valuemin={1}
            aria-valuemax={instructions.length}
            aria-valuenow={activeStepIndex + 1}
            className="flex h-1 w-full overflow-hidden rounded-full bg-gray-800"
            data-exercise-step-progress="true"
          >
            {instructions.map((step, index) => (
              <span
                key={`${step.title}-${index}`}
                aria-hidden="true"
                data-exercise-progress-segment={index + 1}
                data-complete={index <= activeStepIndex ? "true" : "false"}
                className={`h-full flex-1 transition-colors motion-reduce:transition-none ${
                  index <= activeStepIndex ? "bg-primary" : "bg-gray-800"
                }`}
              />
            ))}
          </div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.14em] text-orange-300">
            {t("detail.setup_step_label", { current: activeStepIndex + 1 })}
          </p>
          <h3 className="mt-4 text-2xl font-black text-white text-balance sm:text-3xl">
            {activeStep.title}
          </h3>
          <p className="mt-5 whitespace-pre-wrap text-base leading-7 text-gray-300 text-pretty">
            {activeStep.description || t("detail.setup_step_empty")}
          </p>
        </article>
      </div>
    </section>
  );
}

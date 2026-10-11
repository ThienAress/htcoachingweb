import { Pause, Play, RotateCcw } from "lucide-react";

import { SCULPT_ANIMATION_STATES } from "./sculptAnimationStates";

const SculptStateInspector = ({
  activeState,
  isPlaying,
  motionEnabled,
  onReplay,
  onTogglePlayback,
}) => {
  const activeIndex = SCULPT_ANIMATION_STATES.findIndex(
    ({ id }) => id === activeState.id,
  );

  return (
    <section
      className="absolute bottom-24 left-3 z-50 w-[min(19rem,calc(100%-1.5rem))] rounded-2xl border border-slate-600/70 bg-slate-950/95 p-3 text-slate-100 shadow-2xl sm:bottom-7 sm:left-6 sm:p-4"
      data-sculpt-state-inspector="true"
      data-sculpt-playback={motionEnabled ? (isPlaying ? "playing" : "paused") : "static"}
      aria-label="Điều khiển bản xem thử"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-200">
            Nhịp {activeIndex + 1}/{SCULPT_ANIMATION_STATES.length}
          </p>
          <p className="mt-1 truncate text-base font-black text-slate-50">
            {activeState.label}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onTogglePlayback}
            disabled={!motionEnabled}
            aria-label={isPlaying ? "Tạm dừng chuyển động" : "Tiếp tục chuyển động"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-500 bg-slate-900 text-slate-100 transition-[background-color,border-color,color] hover:border-orange-300 hover:bg-slate-800 hover:text-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isPlaying ? (
              <Pause aria-hidden="true" size={19} />
            ) : (
              <Play aria-hidden="true" size={19} />
            )}
          </button>
          <button
            type="button"
            onClick={onReplay}
            disabled={!motionEnabled}
            aria-label="Phát lại từ đầu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-orange-300/80 bg-orange-500 text-white transition-[background-color,border-color] hover:border-orange-200 hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw aria-hidden="true" size={19} />
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-300" aria-live="polite">
        {activeState.description}
      </p>

      <div className="mt-3 flex gap-1" aria-hidden="true">
        {SCULPT_ANIMATION_STATES.map((state, index) => (
          <span
            key={state.id}
            data-sculpt-state-step={state.id}
            data-sculpt-current={state.id === activeState.id ? "true" : "false"}
            className={`h-1 flex-1 rounded-full ${index <= activeIndex ? "bg-orange-400" : "bg-slate-700"}`}
          />
        ))}
      </div>
    </section>
  );
};

export default SculptStateInspector;

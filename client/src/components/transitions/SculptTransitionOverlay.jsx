import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { useModalScrollLock } from "../../hooks/useModalScrollLock";
import { getSculptAnimationState } from "./sculptAnimationStates";
import { createSculptPreviewTimeline } from "./sculptTransitionMotion";
import SculptStaticScene from "./SculptStaticScene";
import SculptStateInspector from "./SculptStateInspector";

const SculptTransitionOverlay = ({
  motionEnabled = true,
  onClose,
}) => {
  const [activeStateId, setActiveStateId] = useState("idle");
  const [isPlaying, setIsPlaying] = useState(motionEnabled);
  const dialogRef = useRef(null);
  const sceneRef = useRef(null);
  const timelineRef = useRef(null);
  const closeButtonRef = useRef(null);
  const activeState = getSculptAnimationState(activeStateId);

  useModalScrollLock(true);

  const togglePlayback = useCallback(() => {
    if (!motionEnabled || !timelineRef.current) return;

    setIsPlaying((currentlyPlaying) => {
      if (currentlyPlaying) timelineRef.current.pause();
      else timelineRef.current.resume();
      return !currentlyPlaying;
    });
  }, [motionEnabled]);

  const replay = useCallback(() => {
    if (!motionEnabled || !timelineRef.current) return;
    setActiveStateId("idle");
    setIsPlaying(true);
    timelineRef.current.restart();
  }, [motionEnabled]);

  useEffect(() => {
    if (!motionEnabled) return undefined;

    const controller = createSculptPreviewTimeline({
      root: sceneRef.current,
      onStateChange: setActiveStateId,
    });
    timelineRef.current = controller;

    return () => {
      controller?.kill();
      timelineRef.current = null;
    };
  }, [motionEnabled]);

  useEffect(() => {
    const closeButton = closeButtonRef.current;
    closeButton?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key === "Tab") {
        const focusableElements = Array.from(
          dialogRef.current?.querySelectorAll("button:not([disabled])") || [],
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements.at(-1);

        if (event.shiftKey && document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable?.focus();
        } else if (!event.shiftKey && document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[60] overflow-hidden overscroll-contain bg-[#020B24] text-slate-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sculpt-preview-title"
      aria-describedby="sculpt-preview-description"
      data-sculpt-mode="preview"
    >
      <div className="sr-only">
        <h1 id="sculpt-preview-title">Bản xem thử chuyển động · Chu kỳ 5 giây</h1>
        <p id="sculpt-preview-description">
          {motionEnabled
            ? "Bản xem thử lặp vô hạn cho tới khi bạn đóng cửa sổ."
            : "Chuyển động đã tắt theo cài đặt thiết bị"}
        </p>
      </div>
      <SculptStaticScene
        activeState={activeState.id}
        sceneRef={sceneRef}
        timelineEnabled={motionEnabled}
      />

      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-50 inline-flex min-h-11 items-center gap-2 rounded-full border border-orange-200/70 bg-slate-950/90 px-4 text-sm font-semibold text-slate-100 shadow-lg transition-[background-color,border-color,color] hover:border-orange-300 hover:bg-slate-900 hover:text-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 sm:right-6 sm:top-6"
      >
        <X aria-hidden="true" size={18} />
        Đóng xem thử
      </button>

      <SculptStateInspector
        activeState={activeState}
        isPlaying={isPlaying}
        motionEnabled={motionEnabled}
        onReplay={replay}
        onTogglePlayback={togglePlayback}
      />

    </div>
  );
};

export default SculptTransitionOverlay;

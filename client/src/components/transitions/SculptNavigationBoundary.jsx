import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getSculptFocusRestoreTarget } from "./sculptTransitionFocus";
import { getSculptTransitionDecision } from "./sculptTransitionPolicy";
import SculptTransitionOverlay from "./SculptTransitionOverlay";

const SculptNavigationBoundary = ({ children }) => {
  const [activePreview, setActivePreview] = useState(null);
  const previewOpenRef = useRef(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    const handleClick = (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor || anchor.dataset.sculptTransition === "off") return;

      const decision = getSculptTransitionDecision({
        targetHref: anchor.href,
        currentHref: window.location.href,
        reducedMotion:
          window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true,
        saveData: navigator.connection?.saveData === true,
        defaultPrevented: event.defaultPrevented,
        button: event.button,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        linkTarget: anchor.getAttribute("target") || "",
        download: anchor.hasAttribute("download"),
      });

      if (!decision.openPreview) return;

      event.preventDefault();
      if (previewOpenRef.current) return;

      previewOpenRef.current = true;
      triggerRef.current = anchor;
      setActivePreview({ motionEnabled: decision.motionEnabled });
    };

    // Capture before React Router's Link prevents the native event for SPA navigation.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  const closePreview = useCallback(() => {
    const trigger = triggerRef.current;
    previewOpenRef.current = false;
    triggerRef.current = null;
    setActivePreview(null);
    requestAnimationFrame(() => {
      getSculptFocusRestoreTarget(trigger)?.focus();
    });
  }, []);

  return (
    <>
      <div
        aria-hidden={activePreview ? "true" : undefined}
        inert={activePreview ? true : undefined}
      >
        {children}
      </div>
      {activePreview && createPortal(
        <SculptTransitionOverlay
          motionEnabled={activePreview.motionEnabled}
          onClose={closePreview}
        />,
        document.body,
      )}
    </>
  );
};

export default SculptNavigationBoundary;

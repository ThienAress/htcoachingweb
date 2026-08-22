import { useEffect } from "react";

export const lockDocumentScroll = (documentObject = globalThis.document) => {
  const style = documentObject?.body?.style;
  if (!style) return () => {};

  const previousOverflow = style.overflow;
  const previousOverscrollBehavior = style.overscrollBehavior;
  style.overflow = "hidden";
  style.overscrollBehavior = "none";

  return () => {
    style.overflow = previousOverflow;
    style.overscrollBehavior = previousOverscrollBehavior;
  };
};
export const useModalScrollLock = (active) => {
  useEffect(() => {
    if (!active) return undefined;
    return lockDocumentScroll();
  }, [active]);
};

import { useEffect } from "react";

const activeLocks = new WeakMap();

export const lockDocumentScroll = (documentObject = globalThis.document) => {
  const style = documentObject?.body?.style;
  if (!style) return () => {};

  let lock = activeLocks.get(documentObject);
  if (!lock) {
    lock = {
      count: 0,
      previousOverflow: style.overflow,
      previousOverscrollBehavior: style.overscrollBehavior,
    };
    activeLocks.set(documentObject, lock);
  }
  lock.count += 1;
  style.overflow = "hidden";
  style.overscrollBehavior = "none";

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lock.count -= 1;
    if (lock.count > 0) return;

    style.overflow = lock.previousOverflow;
    style.overscrollBehavior = lock.previousOverscrollBehavior;
    activeLocks.delete(documentObject);
  };
};
export const useModalScrollLock = (active) => {
  useEffect(() => {
    if (!active) return undefined;
    return lockDocumentScroll();
  }, [active]);
};

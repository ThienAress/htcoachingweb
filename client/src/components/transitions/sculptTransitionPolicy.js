const TARGET_PATHS = new Set(["/exercises", "/tdee-calculator"]);

export const normalizeSculptTransitionPath = (pathname = "") => {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
};

export const isSculptTransitionPath = (pathname) =>
  TARGET_PATHS.has(normalizeSculptTransitionPath(pathname));

const skipPreview = (reason) => ({
  openPreview: false,
  motionEnabled: false,
  navigationTarget: null,
  reason,
});

export const getSculptTransitionDecision = ({
  targetHref,
  currentHref,
  reducedMotion = false,
  saveData = false,
  defaultPrevented = false,
  button = 0,
  ctrlKey = false,
  metaKey = false,
  shiftKey = false,
  altKey = false,
  linkTarget = "",
  download = false,
}) => {
  if (defaultPrevented) return skipPreview("handled");
  if (button !== 0) return skipPreview("button");
  if (ctrlKey || metaKey || shiftKey || altKey) {
    return skipPreview("modifier");
  }
  if (linkTarget && linkTarget.toLowerCase() !== "_self") {
    return skipPreview("target");
  }
  if (download) return skipPreview("download");

  try {
    const currentUrl = new URL(currentHref);
    const targetUrl = new URL(targetHref, currentUrl);

    if (targetUrl.origin !== currentUrl.origin) {
      return skipPreview("external");
    }
    if (!isSculptTransitionPath(targetUrl.pathname)) {
      return skipPreview("route");
    }

    return {
      openPreview: true,
      motionEnabled: !reducedMotion && !saveData,
      navigationTarget: null,
      reason: reducedMotion
        ? "reduced-motion"
        : saveData
          ? "save-data"
          : "eligible",
    };
  } catch {
    return skipPreview("invalid-url");
  }
};

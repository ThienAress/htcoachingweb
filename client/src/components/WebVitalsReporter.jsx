import { useEffect } from "react";
import api from "../utils/api";

const postMetric = (name, value) => {
  if (!Number.isFinite(value) || value < 0) return;
  api
    .post("/ops/web-vitals", {
      name,
      value: Number(value.toFixed(name === "CLS" ? 4 : 0)),
      route: window.location.pathname,
      device: window.matchMedia("(max-width: 767px)").matches
        ? "mobile"
        : "desktop",
    })
    .catch(() => undefined);
};

const WebVitalsReporter = () => {
  useEffect(() => {
    if (
      typeof PerformanceObserver === "undefined" ||
      navigator.webdriver
    ) {
      return undefined;
    }

    const observers = [];
    let lastLcp = 0;
    let cls = 0;
    let inp = 0;
    const observe = (type, callback, options = {}) => {
      try {
        const observer = new PerformanceObserver((list) =>
          callback(list.getEntries()),
        );
        observer.observe({ type, buffered: true, ...options });
        observers.push(observer);
      } catch {
        // Browser does not implement this performance entry type.
      }
    };

    observe("largest-contentful-paint", (entries) => {
      const latest = entries.at(-1);
      if (latest) lastLcp = latest.startTime;
    });
    observe("layout-shift", (entries) => {
      for (const entry of entries) {
        if (!entry.hadRecentInput) cls += entry.value;
      }
    });
    observe(
      "event",
      (entries) => {
        for (const entry of entries) inp = Math.max(inp, entry.duration || 0);
      },
      { durationThreshold: 40 },
    );

    const flush = () => {
      if (lastLcp) postMetric("LCP", lastLcp);
      if (inp) postMetric("INP", inp);
      postMetric("CLS", cls);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange, {
      once: true,
    });
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  return null;
};

export default WebVitalsReporter;

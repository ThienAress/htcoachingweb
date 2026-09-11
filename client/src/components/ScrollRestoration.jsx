import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import decodeHashTarget from "../utils/decodeHashTarget";

/**
 * Tự động cuộn lên đầu trang mỗi khi người dùng chuyển sang route mới.
 * Đặt component này bên trong <BrowserRouter> và bên trong MainLayout hoặc AppContent.
 */
const ScrollRestoration = () => {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return undefined;
    }

    const targetId = decodeHashTarget(hash);
    if (!targetId) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return undefined;
    }

    let frameId;
    let attempts = 0;
    const scrollToHash = () => {
      const target = document.getElementById(targetId);
      if (target) {
        const reduceMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        window.scrollTo({
          top: Math.max(
            0,
            target.getBoundingClientRect().top + window.scrollY - 80,
          ),
          behavior: reduceMotion ? "auto" : "smooth",
        });
        return;
      }
      attempts += 1;
      if (attempts < 60) frameId = window.requestAnimationFrame(scrollToHash);
    };
    frameId = window.requestAnimationFrame(scrollToHash);
    return () => window.cancelAnimationFrame(frameId);
  }, [hash, pathname]);

  return null;
};

export default ScrollRestoration;

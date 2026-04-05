// src/hooks/usePrompt.js
import { useContext, useEffect } from "react";
import { UNSAFE_NavigationContext as NavigationContext } from "react-router-dom";

/**
 * usePrompt – Cảnh báo khi chuyển trang SPA (React Router v6/v7)
 * @param {boolean} when - điều kiện bật cảnh báo
 * @param {string} message - nội dung cảnh báo
 */
export function usePrompt(when, message) {
  const { navigator } = useContext(NavigationContext);

  useEffect(() => {
    if (!when) return;

    const push = navigator.push;
    const replace = navigator.replace;

    const blocker =
      (method) =>
      (...args) => {
        if (window.confirm(message)) {
          method.apply(navigator, args);
        }
        // nếu cancel thì không điều hướng
      };

    navigator.push = blocker(push);
    navigator.replace = blocker(replace);

    return () => {
      navigator.push = push;
      navigator.replace = replace;
    };
  }, [when, message, navigator]);
}

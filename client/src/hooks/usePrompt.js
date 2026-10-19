// src/hooks/usePrompt.js
import { useContext, useEffect, useRef } from "react";
import { UNSAFE_NavigationContext as NavigationContext } from "react-router-dom";
import { useConfirmDialog } from "./useConfirmDialog";

/**
 * usePrompt – Cảnh báo khi chuyển trang SPA (React Router v6/v7)
 * @param {boolean} when - điều kiện bật cảnh báo
 * @param {string} message - nội dung cảnh báo
 * @param {{ title?: string, confirmLabel?: string, cancelLabel?: string }} [labels] - chữ trên hộp thoại
 * @returns hộp thoại xác nhận; trang gọi hook phải render phần tử này
 */
export function usePrompt(when, message, labels = {}) {
  const { navigator } = useContext(NavigationContext);
  const { confirm, dialog } = useConfirmDialog();
  const asking = useRef(false);
  const { title, confirmLabel, cancelLabel } = labels;

  useEffect(() => {
    if (!when) return;

    const push = navigator.push;
    const replace = navigator.replace;

    const blocker =
      (method) =>
      (...args) => {
        if (asking.current) return;
        asking.current = true;
        // nếu hủy thì không điều hướng
        void confirm({ title: title || "Rời khỏi trang?", message, confirmLabel: confirmLabel || "Rời trang", cancelLabel, tone: "danger" })
          .then((ok) => {
            asking.current = false;
            if (ok) method.apply(navigator, args);
          });
      };

    // eslint-disable-next-line react-hooks/immutability
    navigator.push = blocker(push);
    navigator.replace = blocker(replace);

    return () => {
      navigator.push = push;
      navigator.replace = replace;
    };
  }, [when, message, navigator, confirm, title, confirmLabel, cancelLabel]);

  return dialog;
}

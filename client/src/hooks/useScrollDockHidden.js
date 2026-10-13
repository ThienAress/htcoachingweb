import { useEffect, useState } from "react";

const MIN_DELTA_PX = 6;
const TOP_ZONE_PX = 48;
const IDLE_REVEAL_MS = 600;

/**
 * Trả về true khi người dùng đang cuộn xuống để các nút nổi (pill chat, nút liên hệ) trượt ra
 * khỏi màn hình; cuộn lên, về gần đầu trang hoặc đứng yên một lúc thì hiện lại.
 * `disabled` giữ nút luôn hiện (đang nhập, đang mở menu).
 */
export default function useScrollDockHidden({ disabled = false } = {}) {
  const [hiddenByScroll, setHiddenByScroll] = useState(false);

  useEffect(() => {
    if (disabled) return undefined;
    let lastY = window.scrollY;
    let idleTimer = null;
    let frame = null;

    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const currentY = Math.max(0, window.scrollY);
        const delta = currentY - lastY;
        if (currentY <= TOP_ZONE_PX) {
          setHiddenByScroll(false);
        } else if (delta >= MIN_DELTA_PX) {
          setHiddenByScroll(true);
        } else if (delta <= -MIN_DELTA_PX) {
          setHiddenByScroll(false);
        }
        if (Math.abs(delta) >= MIN_DELTA_PX) lastY = currentY;
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => setHiddenByScroll(false), IDLE_REVEAL_MS);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(idleTimer);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [disabled]);

  return !disabled && hiddenByScroll;
}

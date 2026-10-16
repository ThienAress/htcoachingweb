import { useEffect, useState } from "react";

const MIN_DELTA_PX = 6;
const TOP_ZONE_PX = 48;

/**
 * Trả về true khi người dùng đang cuộn xuống để các nút nổi (pill chat, nút liên hệ) trượt ra
 * khỏi màn hình. Dừng cuộn vẫn giữ ẩn để không che nội dung đang đọc; chỉ hiện lại khi cuộn lên
 * hoặc về gần đầu trang.
 * `disabled` giữ nút luôn hiện (đang nhập, đang mở menu).
 */
export default function useScrollDockHidden({ disabled = false } = {}) {
  const [hiddenByScroll, setHiddenByScroll] = useState(false);

  useEffect(() => {
    if (disabled) return undefined;
    let lastY = window.scrollY;
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
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [disabled]);

  return !disabled && hiddenByScroll;
}

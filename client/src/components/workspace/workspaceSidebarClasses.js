// Khung thanh bên chung cho các khu làm việc (HLV, quản trị, F1): nền navy cố định, mục đang chọn màu cam.
// Dùng màu tường minh (không dùng text-white, bg-slate-900...) để giao diện sáng của khu HLV không đổi màu thanh bên.
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400";

export const workspaceItemClass = (isActive) =>
  `flex min-h-11 w-full items-center gap-3 rounded-lg px-4 py-2 text-left text-sm transition-colors ${FOCUS_RING} ${
    isActive
      ? "bg-primary font-semibold text-[#ffffff]"
      : "text-[#cbd5e1] hover:bg-[#ffffff1a] hover:text-[#ffffff]"
  }`;

export const workspaceGroupLabelClass =
  `flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg px-4 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-[#94a3b8] transition-colors hover:text-[#e2e8f0] ${FOCUS_RING}`;

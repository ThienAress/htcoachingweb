import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Phone, Send } from "lucide-react";

// ======================= CÁC ICON MẠNG XÃ HỘI =======================
const ZaloIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-full h-full">
    <path fill="#2962ff" d="M15,36V6.827l-1.211-0.811C8.64,8.083,5,13.112,5,19v10c0,7.732,6.268,14,14,14h10c4.722,0,8.883-2.348,11.417-5.931V36H15z" />
    <path fill="#eee" d="M29,5H19c-1.845,0-3.601,0.366-5.214,1.014C10.453,9.25,8,14.528,8,19c0,6.771,0.936,10.735,3.712,14.607c0.216,0.301,0.357,0.653,0.376,1.022c0.043,0.835-0.129,2.365-1.634,3.742c-0.162,0.148-0.059,0.419,0.16,0.428c0.942,0.041,2.843-0.014,4.797-0.877c0.557-0.246,1.191-0.203,1.729,0.083C20.453,39.764,24.333,40,28,40c4.676,0,9.339-1.04,12.417-2.916C42.038,34.799,43,32.014,43,29V19C43,11.268,36.732,5,29,5z" />
    <path fill="#2962ff" d="M36.75,27C34.683,27,33,25.317,33,23.25s1.683-3.75,3.75-3.75s3.75,1.683,3.75,3.75S38.817,27,36.75,27z M36.75,21c-1.24,0-2.25,1.01-2.25,2.25s1.01,2.25,2.25,2.25S39,24.49,39,23.25S37.99,21,36.75,21z" />
    <path fill="#2962ff" d="M31.5,27h-1c-0.276,0-0.5-0.224-0.5-0.5V18h1.5V27z" />
    <path fill="#2962ff" d="M27,19.75v0.519c-0.629-0.476-1.403-0.769-2.25-0.769c-2.067,0-3.75,1.683-3.75,3.75S22.683,27,24.75,27c0.847,0,1.621-0.293,2.25-0.769V26.5c0,0.276,0.224,0.5,0.5,0.5h1v-7.25H27z M24.75,25.5c-1.24,0-2.25-1.01-2.25-2.25S23.51,21,24.75,21S27,22.01,27,23.25S25.99,25.5,24.75,25.5z" />
    <path fill="#2962ff" d="M21.25,18h-8v1.5h5.321L13,26h0.026c-0.163,0.211-0.276,0.463-0.276,0.75V27h7.5c0.276,0,0.5-0.224,0.5-0.5v-1h-5.321L21,19h-0.026c0.163-0.211,0.276-0.463,0.276-0.75V18z" />
  </svg>
);

const MessengerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-full h-full">
    <radialGradient id="messengerGradient" cx="11.087" cy="7.022" r="47.612" gradientTransform="matrix(1 0 0 -1 0 50)" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#1292ff" />
      <stop offset=".079" stopColor="#2982ff" />
      <stop offset=".23" stopColor="#4e69ff" />
      <stop offset=".351" stopColor="#6559ff" />
      <stop offset=".428" stopColor="#6d53ff" />
      <stop offset=".754" stopColor="#df47aa" />
      <stop offset=".946" stopColor="#ff6257" />
    </radialGradient>
    <path fill="url(#messengerGradient)" d="M44,23.5C44,34.27,35.05,43,24,43c-1.651,0-3.25-0.194-4.784-0.564c-0.465-0.112-0.951-0.069-1.379,0.145L13.46,44.77C12.33,45.335,11,44.513,11,43.249v-4.025c0-0.575-0.257-1.111-0.681-1.499C6.425,34.165,4,29.11,4,23.5C4,12.73,12.95,4,24,4S44,12.73,44,23.5z" />
    <path fill="#fff" d="M34.394,18.501l-5.7,4.22c-0.61,0.46-1.44,0.46-2.04,0.01L22.68,19.74c-1.68-1.25-4.06-0.82-5.19,0.94l-1.21,1.89l-4.11,6.68c-0.6,0.94,0.55,2.01,1.44,1.34l5.7-4.22c0.61-0.46,1.44-0.46,2.04-0.01l3.974,2.991c1.68,1.25,4.06,0.82,5.19-0.94l1.21-1.89l4.11-6.68C36.434,18.901,35.284,17.831,34.394,18.501z" />
  </svg>
);

const socialItems = [
  {
    id: "messenger",
    label: "Messenger",
    href: "https://m.me/thienvo123456",
    icon: <MessengerIcon />,
  },
  {
    id: "telegram",
    label: "Telegram",
    href: "https://t.me/thienvo", // Cập nhật đúng link Telegram nếu cần
    icon: (
      <div className="w-full h-full bg-[#0088cc] rounded-full flex items-center justify-center text-white">
        <Send size={18} className="-ml-[2px] mt-[2px]" />
      </div>
    ),
  },
  {
    id: "phone",
    label: "Gọi hotline",
    href: "tel:0934215227",
    icon: (
      <div className="w-full h-full bg-[#28a745] rounded-full flex items-center justify-center text-white">
        <Phone size={18} />
      </div>
    ),
  },
  {
    id: "zalo",
    label: "Tư vấn Zalo",
    href: "https://zalo.me/0934215227",
    icon: <ZaloIcon />,
  },
];

const getUiConfig = (width) => {
  if (width < 640) return { right: 16, bottom: 100, mainSize: 56 };
  if (width < 1024) return { right: 20, bottom: 92, mainSize: 60 };
  return { right: 24, bottom: 100, mainSize: 64 };
};

const ChatIcons = () => {
  const [open, setOpen] = useState(false);
  const [chatWidgetOpen, setChatWidgetOpen] = useState(false);
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const [currentIconIdx, setCurrentIconIdx] = useState(0);
  const wrapperRef = useRef(null);

  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440,
  );

  const ui = useMemo(() => getUiConfig(viewportWidth), [viewportWidth]);

  // Handle window resize
  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);
    return () => window.removeEventListener("resize", updateViewportWidth);
  }, []);

  // Handle auto cycling icons
  useEffect(() => {
    if (open) return;
    const interval = setInterval(() => {
      setCurrentIconIdx((prev) => (prev + 1) % socialItems.length);
    }, 2500); // Change icon every 2.5 seconds
    return () => clearInterval(interval);
  }, [open]);

  // Ẩn ChatIcons trên mobile khi chat widget mở
  useEffect(() => {
    if (viewportWidth >= 640) return;
    const onOpen = () => setChatWidgetOpen(true);
    const onClose = () => setChatWidgetOpen(false);
    window.addEventListener("ht-chat-opened", onOpen);
    window.addEventListener("ht-chat-closed", onClose);
    return () => {
      window.removeEventListener("ht-chat-opened", onOpen);
      window.removeEventListener("ht-chat-closed", onClose);
    };
  }, [viewportWidth]);

  // Ẩn khi cuộn qua 40% trang (chỉ mobile)
  useEffect(() => {
    if (viewportWidth >= 640) {
      setHiddenByScroll(false);
      return;
    }
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      setHiddenByScroll(scrolled / total > 0.4);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [viewportWidth]);

  // Click outside and Escape key handling
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const isHidden = chatWidgetOpen || hiddenByScroll;

  return (
    <div
      ref={wrapperRef}
      className="fixed z-50"
      style={{
        right: `${ui.right}px`,
        bottom: `calc(${ui.bottom}px + env(safe-area-inset-bottom, 0px))`,
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? "none" : "auto",
        transition: "opacity 0.3s ease",
      }}
    >
      <div
        className="relative flex flex-col items-end"
        style={{
          width: `${ui.mainSize}px`,
        }}
      >
        {/* Popover Menu */}
        <div
          className={`absolute right-0 bottom-full mb-4 w-52 origin-bottom-right transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            open
              ? "scale-100 opacity-100 translate-y-0"
              : "scale-90 opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-gray-100 flex flex-col p-2 relative">
            {socialItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="w-8 h-8 shrink-0 flex items-center justify-center transition-transform group-hover:scale-110">
                  {item.icon}
                </div>
                <span className="text-[15px] font-semibold text-slate-700 group-hover:text-primary transition-colors">
                  {item.label}
                </span>
              </a>
            ))}
            {/* Arrow */}
            <div className="absolute -bottom-2 right-5 w-4 h-4 bg-white border-b border-r border-gray-100 transform rotate-45 shadow-[3px_3px_5px_-3px_rgba(0,0,0,0.05)]"></div>
          </div>
        </div>

        {/* Main Button */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? "Đóng liên hệ" : "Mở liên hệ nhanh"}
          aria-expanded={open}
          className="relative flex items-center justify-center rounded-full bg-white shadow-[0_8px_30px_-5px_rgba(0,0,0,0.2)] transition-all duration-300 hover:scale-105 active:scale-95 group"
          style={{
            width: `${ui.mainSize}px`,
            height: `${ui.mainSize}px`,
          }}
        >
          {/* Rotating Icons */}
          {socialItems.map((item, idx) => (
            <div
              key={item.id}
              className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                !open && idx === currentIconIdx
                  ? "opacity-100 scale-100 rotate-0"
                  : "opacity-0 scale-50 -rotate-45"
              }`}
              style={{ padding: `${ui.mainSize * 0.22}px` }}
            >
              {item.icon}
            </div>
          ))}

          {/* Close Icon */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
              open ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-45"
            }`}
          >
            <X size={ui.mainSize * 0.45} strokeWidth={3} className="text-slate-700" />
          </div>

          {/* Ping Effect */}
          {!open && (
            <span className="absolute inset-0 rounded-full pointer-events-none chat-icons-ping-slow shadow-[0_0_0_0_rgba(0,0,0,0.1)] border border-primary/20" />
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatIcons;

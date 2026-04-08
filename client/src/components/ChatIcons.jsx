import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircleMore, X } from "lucide-react";

// ======================= CÁC ICON MẠNG XÃ HỘI =======================
const ZaloIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    className="w-full h-full"
  >
    <path
      fill="#2962ff"
      d="M15,36V6.827l-1.211-0.811C8.64,8.083,5,13.112,5,19v10c0,7.732,6.268,14,14,14h10c4.722,0,8.883-2.348,11.417-5.931V36H15z"
    />
    <path
      fill="#eee"
      d="M29,5H19c-1.845,0-3.601,0.366-5.214,1.014C10.453,9.25,8,14.528,8,19c0,6.771,0.936,10.735,3.712,14.607c0.216,0.301,0.357,0.653,0.376,1.022c0.043,0.835-0.129,2.365-1.634,3.742c-0.162,0.148-0.059,0.419,0.16,0.428c0.942,0.041,2.843-0.014,4.797-0.877c0.557-0.246,1.191-0.203,1.729,0.083C20.453,39.764,24.333,40,28,40c4.676,0,9.339-1.04,12.417-2.916C42.038,34.799,43,32.014,43,29V19C43,11.268,36.732,5,29,5z"
    />
    <path
      fill="#2962ff"
      d="M36.75,27C34.683,27,33,25.317,33,23.25s1.683-3.75,3.75-3.75s3.75,1.683,3.75,3.75S38.817,27,36.75,27z M36.75,21c-1.24,0-2.25,1.01-2.25,2.25s1.01,2.25,2.25,2.25S39,24.49,39,23.25S37.99,21,36.75,21z"
    />
    <path
      fill="#2962ff"
      d="M31.5,27h-1c-0.276,0-0.5-0.224-0.5-0.5V18h1.5V27z"
    />
    <path
      fill="#2962ff"
      d="M27,19.75v0.519c-0.629-0.476-1.403-0.769-2.25-0.769c-2.067,0-3.75,1.683-3.75,3.75S22.683,27,24.75,27c0.847,0,1.621-0.293,2.25-0.769V26.5c0,0.276,0.224,0.5,0.5,0.5h1v-7.25H27z M24.75,25.5c-1.24,0-2.25-1.01-2.25-2.25S23.51,21,24.75,21S27,22.01,27,23.25S25.99,25.5,24.75,25.5z"
    />
    <path
      fill="#2962ff"
      d="M21.25,18h-8v1.5h5.321L13,26h0.026c-0.163,0.211-0.276,0.463-0.276,0.75V27h7.5c0.276,0,0.5-0.224,0.5-0.5v-1h-5.321L21,19h-0.026c0.163-0.211,0.276-0.463,0.276-0.75V18z"
    />
  </svg>
);

const MessengerIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    className="w-full h-full"
  >
    <radialGradient
      id="messengerGradient"
      cx="11.087"
      cy="7.022"
      r="47.612"
      gradientTransform="matrix(1 0 0 -1 0 50)"
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0" stopColor="#1292ff" />
      <stop offset=".079" stopColor="#2982ff" />
      <stop offset=".23" stopColor="#4e69ff" />
      <stop offset=".351" stopColor="#6559ff" />
      <stop offset=".428" stopColor="#6d53ff" />
      <stop offset=".754" stopColor="#df47aa" />
      <stop offset=".946" stopColor="#ff6257" />
    </radialGradient>
    <path
      fill="url(#messengerGradient)"
      d="M44,23.5C44,34.27,35.05,43,24,43c-1.651,0-3.25-0.194-4.784-0.564c-0.465-0.112-0.951-0.069-1.379,0.145L13.46,44.77C12.33,45.335,11,44.513,11,43.249v-4.025c0-0.575-0.257-1.111-0.681-1.499C6.425,34.165,4,29.11,4,23.5C4,12.73,12.95,4,24,4S44,12.73,44,23.5z"
    />
    <path
      fill="#fff"
      d="M34.394,18.501l-5.7,4.22c-0.61,0.46-1.44,0.46-2.04,0.01L22.68,19.74c-1.68-1.25-4.06-0.82-5.19,0.94l-1.21,1.89l-4.11,6.68c-0.6,0.94,0.55,2.01,1.44,1.34l5.7-4.22c0.61-0.46,1.44-0.46,2.04-0.01l3.974,2.991c1.68,1.25,4.06,0.82,5.19-0.94l1.21-1.89l4.11-6.68C36.434,18.901,35.284,17.831,34.394,18.501z"
    />
  </svg>
);

const TikTokIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    className="w-full h-full"
  >
    <path
      fill="#FFFFFF"
      d="M24 4c0 5.8 3.4 10.4 8.7 11.8v5.4c-2.3-.1-4.5-.7-6.5-1.8v10.1c0 6.4-5.2 11.5-11.5 11.5S3.2 35.9 3.2 29.5 8.4 18 14.7 18c.7 0 1.4.1 2.1.2v5.8c-.7-.2-1.4-.4-2.1-.4-3.2 0-5.8 2.6-5.8 5.9s2.6 5.9 5.8 5.9 5.8-2.6 5.8-5.9V4H24z"
    />
    <path
      fill="#25F4EE"
      d="M26.5 8.2c1.6 2.8 4.2 4.9 7.2 5.8v3c-2.7-.5-5.2-1.8-7.2-3.7V8.2z"
    />
    <path
      fill="#FE2C55"
      d="M20.5 23.7v5.8c-.8-.3-1.7-.5-2.6-.5-3.2 0-5.8 2.6-5.8 5.9 0 1.2.4 2.3 1 3.3-2.6-1-4.4-3.5-4.4-6.4 0-3.8 3-6.9 6.8-6.9 1.8 0 3.5.7 5 1.8z"
    />
  </svg>
);

const InstagramIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    className="w-full h-full"
  >
    <radialGradient
      id="ig-a"
      cx="19.38"
      cy="42.04"
      r="44.9"
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0" stopColor="#fd5" />
      <stop offset=".33" stopColor="#ff543f" />
      <stop offset=".64" stopColor="#c837ab" />
      <stop offset="1" stopColor="#4168c9" />
    </radialGradient>
    <path
      fill="url(#ig-a)"
      d="M34.017,41H13.983C10.134,41,7,37.866,7,34.017V13.983C7,10.134,10.134,7,13.983,7h20.034C37.866,7,41,10.134,41,13.983v20.034C41,37.866,37.866,41,34.017,41z"
    />
    <path
      fill="#fff"
      d="M24 14.5A9.5 9.5 0 1 0 24 33.5 9.5 9.5 0 1 0 24 14.5zm0 15.5A6 6 0 1 1 24 18a6 6 0 0 1 0 12z"
    />
    <circle cx="34" cy="14" r="2.2" fill="#fff" />
  </svg>
);

const socialItems = [
  {
    id: "zalo",
    label: "Zalo",
    href: "https://zalo.me/0934215227",
    icon: <ZaloIcon />,
    color: "#0068ff",
  },
  {
    id: "messenger",
    label: "Messenger",
    href: "https://m.me/thienvo123456",
    icon: <MessengerIcon />,
    color: "#00B2FF",
  },
  {
    id: "tiktok",
    label: "TikTok",
    href: "https://www.tiktok.com/",
    icon: <TikTokIcon />,
    color: "#FE2C55",
  },
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/",
    icon: <InstagramIcon />,
    color: "#E1306C",
  },
];

const getUiConfig = (width) => {
  if (width < 420) {
    return {
      right: 25,
      bottom: 100,
      containerSize: 60,
      mainSize: 65,
      mainIconSize: 24,
      itemSize: 44,
      itemIconSize: 22,
      expandedWidth: 132,
      labelMaxWidth: 88,
      labelFontSize: "11px",
      radius: 100,
      startAngle: 160,
      endAngle: 250,
    };
  }

  if (width < 640) {
    return {
      right: 14,
      bottom: 84,
      containerSize: 64,
      mainSize: 56,
      mainIconSize: 25,
      itemSize: 48,
      itemIconSize: 24,
      expandedWidth: 142,
      labelMaxWidth: 94,
      labelFontSize: "12px",
      radius: 120,
      startAngle: 150,
      endAngle: 245,
    };
  }

  if (width < 1024) {
    return {
      right: 16,
      bottom: 92,
      containerSize: 68,
      mainSize: 60,
      mainIconSize: 26,
      itemSize: 52,
      itemIconSize: 25,
      expandedWidth: 152,
      labelMaxWidth: 100,
      labelFontSize: "13px",
      radius: 120,
      startAngle: 150,
      endAngle: 245,
    };
  }

  return {
    right: 24,
    bottom: 100,
    containerSize: 72,
    mainSize: 64,
    mainIconSize: 26,
    itemSize: 56,
    itemIconSize: 28,
    expandedWidth: 168,
    labelMaxWidth: 112,
    labelFontSize: "14px",
    radius: 120,
    startAngle: 150,
    endAngle: 245,
  };
};

const ChatIcons = () => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440,
  );

  const ui = useMemo(() => getUiConfig(viewportWidth), [viewportWidth]);

  const fanItems = useMemo(() => {
    return socialItems.map((item, index) => {
      const total = socialItems.length;
      const angle =
        total === 1
          ? ui.startAngle
          : ui.startAngle +
            ((ui.endAngle - ui.startAngle) * index) / (total - 1);

      const rad = (angle * Math.PI) / 180;
      const x = Math.cos(rad) * ui.radius;
      const y = Math.sin(rad) * ui.radius;

      return {
        ...item,
        x,
        y,
        delay: index * 60,
      };
    });
  }, [ui]);

  useEffect(() => {
    const updateViewportWidth = () => {
      setViewportWidth(window.innerWidth);
    };

    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);

    return () => window.removeEventListener("resize", updateViewportWidth);
  }, []);

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

  return (
    <div
      ref={wrapperRef}
      className="fixed z-[9999]"
      style={{
        right: `${ui.right}px`,
        bottom: `calc(${ui.bottom}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div
        className="relative"
        style={{
          width: `${ui.containerSize}px`,
          height: `${ui.containerSize}px`,
          "--item-size": `${ui.itemSize}px`,
          "--item-icon-size": `${ui.itemIconSize}px`,
          "--expanded-width": `${ui.expandedWidth}px`,
          "--label-max-width": `${ui.labelMaxWidth}px`,
        }}
      >
        {fanItems.map((item) => (
          <a
            key={item.id}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            title={item.label}
            className="absolute right-0 bottom-0 flex items-center rounded-full bg-black/80 backdrop-blur-md border-2 transition-all duration-500 ease-[cubic-bezier(0.34,1.2,0.64,1)] hover:border-opacity-100 overflow-hidden group h-[var(--item-size)] w-[var(--item-size)] hover:w-[var(--expanded-width)]"
            style={{
              borderColor: item.color,
              boxShadow: open ? `0 0 12px ${item.color}` : "none",
              transform: open
                ? `translate(${item.x}px, ${item.y}px) scale(1)`
                : "translate(0px, 0px) scale(0)",
              opacity: open ? 1 : 0,
              pointerEvents: open ? "auto" : "none",
              transitionDelay: open ? `${item.delay}ms` : "0ms",
            }}
          >
            <div className="flex h-[var(--item-size)] w-[var(--item-size)] shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110">
              <span className="drop-shadow-lg w-[var(--item-icon-size)] h-[var(--item-icon-size)]">
                {item.icon}
              </span>
            </div>

            <div className="flex max-w-0 flex-col justify-center overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.2,0.64,1)] group-hover:max-w-[var(--label-max-width)] group-hover:pr-5">
              <span
                className="whitespace-nowrap font-bold uppercase tracking-wider opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  color: item.color,
                  fontSize: ui.labelFontSize,
                }}
              >
                {item.label}
              </span>
            </div>
          </a>
        ))}

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-0 bottom-0 flex items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#2d2d2d] via-[#1a1a1a] to-[#000000] shadow-[0_10px_30px_-5px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.1)] transition-all duration-300 hover:scale-105 active:scale-95 group"
          style={{
            width: `${ui.mainSize}px`,
            height: `${ui.mainSize}px`,
          }}
        >
          <span
            className={`transition-all duration-500 ${
              open ? "rotate-90" : "rotate-0"
            }`}
          >
            {open ? (
              <X
                size={ui.mainIconSize}
                strokeWidth={2.5}
                className="text-lime-400 drop-shadow-[0_0_8px_rgba(163,230,53,0.8)]"
              />
            ) : (
              <MessageCircleMore
                size={ui.mainIconSize}
                strokeWidth={2.5}
                className="text-white group-hover:text-lime-400 transition-colors duration-300"
              />
            )}
          </span>

          {!open && (
            <span className="absolute inset-0 rounded-full animate-ping-slow bg-lime-400/20 pointer-events-none" />
          )}
        </button>
      </div>

      <style jsx>{`
        @keyframes ping-slow {
          0% {
            transform: scale(1);
            opacity: 0.5;
          }
          75% {
            transform: scale(1.3);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }

        .animate-ping-slow {
          animation: ping-slow 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        .drop-shadow-glow {
          filter: drop-shadow(0 0 4px rgba(163, 230, 53, 0.5));
        }
      `}</style>
    </div>
  );
};

export default ChatIcons;

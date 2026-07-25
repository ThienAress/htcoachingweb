import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  shouldEnableDevToolsGuard,
  startDevToolsDetection,
} from "../utils/devToolsGuard";

const ActiveDevToolsGuard = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let stopDetection = null;

    const handleStatusChange = (nextIsOpen) => {
      if (active) setIsOpen(Boolean(nextIsOpen));
    };

    import("devtools-detector")
      .then((detector) => {
        if (!active) return;
        stopDetection = startDevToolsDetection(detector, handleStatusChange);
      })
      .catch(() => {
        // Detection is a deterrent only; the application must remain usable
        // if an unsupported browser cannot load the optional detector.
      });

    return () => {
      active = false;
      stopDetection?.();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-gray-950 px-6 text-white"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="devtools-guard-title"
      aria-describedby="devtools-guard-description"
    >
      <section className="w-full max-w-xl border border-gray-800 bg-gray-900 p-8 shadow-2xl sm:p-10">
        <div className="flex items-center gap-3 text-primary">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
          <p className="text-sm font-bold uppercase tracking-[0.16em]">
            HTCOACHING Security
          </p>
        </div>
        <h1
          id="devtools-guard-title"
          className="mt-6 text-3xl font-black uppercase leading-tight sm:text-4xl"
        >
          Nội dung tạm thời bị khóa
        </h1>
        <p
          id="devtools-guard-description"
          className="mt-4 max-w-lg text-base leading-7 text-gray-300"
        >
          Công cụ dành cho nhà phát triển đang mở. Vui lòng đóng DevTools để
          tiếp tục sử dụng website.
        </p>
      </section>
    </div>
  );
};

const DevToolsGuard = () => {
  const { user, loading } = useAuth();
  const enabled = shouldEnableDevToolsGuard({
    isProduction: import.meta.env.PROD,
    authLoading: loading,
    role: user?.role,
  });

  return enabled ? <ActiveDevToolsGuard /> : null;
};

export default DevToolsGuard;

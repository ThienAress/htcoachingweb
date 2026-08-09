import { lazy, Suspense, useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import useAiAssistantNudge from "../../hooks/useAiAssistantNudge";

const ChatPanel = lazy(() => import("./ChatPanel"));
const HIDDEN_PATHS = [
  "/login",
  "/register",
  "/login-success",
  "/admin",
  "/trainer",
  "/dashboard",
  "/f1-customers",
];

export default function DeferredChatPanel() {
  const { user } = useAuth();
  const location = useLocation();
  const [shouldLoad, setShouldLoad] = useState(false);
  const [initialAction, setInitialAction] = useState(null);
  const isHidden = HIDDEN_PATHS.some((path) =>
    location.pathname.startsWith(path),
  );
  const { nudge, dismiss, accept } = useAiAssistantNudge({
    pathname: location.pathname,
    enabled: !isHidden && !shouldLoad,
  });

  useEffect(() => {
    if (!nudge) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [dismiss, nudge]);

  const openChat = (action = null) => {
    if (action) accept();
    setInitialAction(action);
    setShouldLoad(true);
  };

  if (isHidden) return null;

  if (shouldLoad) {
    const actorKey = user?._id || user?.id || "guest";
    return (
      <Suspense fallback={null}>
        <ChatPanel
          key={actorKey}
          initiallyOpen
          initialAction={initialAction}
        />
      </Suspense>
    );
  }

  if (nudge) {
    return (
      <div
        className="fixed bottom-5 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-zinc-700 bg-zinc-900 p-3 text-zinc-100 shadow-2xl"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600">
            <Bot size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-6 text-zinc-100">{nudge.message}</p>
            <button
              type="button"
              onClick={() => openChat({ prompt: nudge.prompt })}
              className="mt-2 min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50 motion-reduce:transition-none"
            >
              Hỗ trợ tôi
            </button>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 motion-reduce:transition-none"
            aria-label="Ẩn gợi ý HT Assistant"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openChat()}
      className="fixed bottom-5 left-1/2 z-50 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-200 shadow-xl transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 motion-reduce:transition-none"
      aria-label="Mở HT Assistant"
      title="Mở HT Assistant"
    >
      <Bot size={17} className="text-emerald-400" aria-hidden="true" />
      <span>HT Assistant</span>
    </button>
  );
}

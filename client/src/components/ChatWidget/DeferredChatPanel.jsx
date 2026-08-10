import { lazy, Suspense, useState } from "react";
import { Bot } from "lucide-react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

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
  const isHidden = HIDDEN_PATHS.some((path) =>
    location.pathname.startsWith(path),
  );
  const openChat = () => setShouldLoad(true);

  if (isHidden) return null;

  if (shouldLoad) {
    const actorKey = user?._id || user?.id || "guest";
    return (
      <Suspense fallback={null}>
        <ChatPanel key={actorKey} initiallyOpen />
      </Suspense>
    );
  }

  return (
    <button
      type="button"
      onClick={openChat}
      className="fixed bottom-5 left-1/2 z-50 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-200 shadow-xl transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 motion-reduce:transition-none"
      aria-label="Mở HT Assistant"
      title="Mở HT Assistant"
    >
      <Bot size={17} className="text-emerald-400" aria-hidden="true" />
      <span>HT Assistant</span>
    </button>
  );
}

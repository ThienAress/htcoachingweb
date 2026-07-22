import { lazy, Suspense, useState } from "react";
import { Bot } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ChatPanel = lazy(() => import("./ChatPanel"));
const HIDDEN_PATHS = ["/login", "/register", "/login-success", "/admin", "/trainer"];

export default function DeferredChatPanel() {
  const { user } = useAuth();
  const location = useLocation();
  const [shouldLoad, setShouldLoad] = useState(false);

  if (
    !user ||
    HIDDEN_PATHS.some((path) => location.pathname.startsWith(path))
  ) {
    return null;
  }

  if (shouldLoad) {
    return (
      <Suspense fallback={null}>
        <ChatPanel initiallyOpen />
      </Suspense>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShouldLoad(true)}
      className="fixed bottom-5 left-1/2 z-50 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#17191d] px-4 text-sm font-medium text-gray-200 shadow-xl transition hover:bg-[#22252b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      aria-label="Mở HT Assistant"
      title="Mở HT Assistant"
    >
      <Bot size={17} className="text-emerald-400" />
      <span>HT Assistant</span>
    </button>
  );
}

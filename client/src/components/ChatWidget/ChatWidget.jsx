import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Bot, X, Trash2, Send, Loader2, Square,
  PanelRight, MessageSquare, ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useAiChat from "../../hooks/useAiChat";
import ChatBubble from "./ChatBubble";
import TdeeFormCard from "./cards/TdeeFormCard";

const TOOL_LABELS = {
  calculate_tdee: "Đang tính TDEE...",
  search_exercises: "Đang tìm bài tập...",
  suggest_meal: "Đang lên thực đơn...",
  get_trainer_info: "Đang tìm HLV...",
};

const QUICK_ACTIONS = [
  { icon: "🔥", label: "Tính TDEE" },
  { icon: "🏋️", label: "Bài tập ngực" },
  { icon: "🥗", label: "Gợi ý thực đơn" },
  { icon: "👨‍🏫", label: "Tìm HLV" },
];

export default function ChatWidget() {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [mode, setMode] = useState("floating");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showTdeeForm, setShowTdeeForm] = useState(false);

  const {
    messages,
    isLoading,
    activeTool,
    error,
    sendMessage,
    loadHistory,
    clearHistory,
    cancelRequest,
  } = useAiChat();

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setIsClosing(false);
    if (!historyLoaded) {
      loadHistory();
      setHistoryLoaded(true);
    }
  }, [historyLoaded, loadHistory]);

  // Đóng với animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    const duration = mode === "sidebar" ? 300 : 200;
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, duration);
  }, [mode]);

  useEffect(() => {
    if (isOpen && !isClosing) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, activeTool, isOpen, isClosing]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && isOpen) handleClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, handleClose]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }, []);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    adjustTextarea();
  }, [adjustTextarea]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage(input, { lastPage: location.pathname });
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, isLoading, sendMessage, location.pathname]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleQuickAction = useCallback(
    (q) => {
      if (q === "Tính TDEE") {
        setShowTdeeForm(true);
        return;
      }
      sendMessage(q, { lastPage: location.pathname });
    },
    [sendMessage, location.pathname]
  );

  const handleTdeeSubmit = useCallback(
    (text) => {
      setShowTdeeForm(false);
      sendMessage(text, { lastPage: location.pathname });
    },
    [sendMessage, location.pathname]
  );

  const handleClear = useCallback(() => {
    clearHistory();
    setHistoryLoaded(false);
    setShowTdeeForm(false);
  }, [clearHistory]);

  if (!user) return null;

  // Animation cho mở/đóng
  const getAnimation = () => {
    if (mode === "sidebar") {
      return isClosing ? "chatSidebarOut 0.3s ease-in forwards" : "chatSlideIn 0.3s ease-out";
    }
    return isClosing ? "chatSlideOut 0.2s ease-in forwards" : "chatSlideRight 0.25s ease-out";
  };

  const panelClass = mode === "sidebar"
    ? "fixed top-0 right-0 z-50 w-[420px] h-screen border-l border-white/10"
    : "fixed z-50 bottom-4 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[400px] rounded-2xl border border-white/10";

  // Floating mode: auto height dựa trên content, max 80vh
  const floatingHeight = mode === "floating"
    ? { maxHeight: "min(80vh, calc(100vh - 2rem))", height: "auto" }
    : {};

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          aria-label="Mở HT Assistant"
          id="ai-chat-toggle"
          className="fixed z-40 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-110 active:scale-95 transition-all duration-300 group"
          style={{ right: "30px", bottom: "190px" }}
        >
          <Bot size={22} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900 animate-pulse" />
        </button>
      )}

      {/* Sidebar overlay */}
      {isOpen && mode === "sidebar" && (
        <div
          className={`fixed inset-0 z-40 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? "bg-transparent" : "bg-black/30"}`}
          onClick={handleClose}
        />
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={`flex flex-col bg-gray-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden ${panelClass}`}
          style={{ animation: getAnimation(), ...floatingHeight }}
          role="dialog"
          aria-label="HT Assistant Chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <Bot size={14} className="text-white" />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-white leading-tight">HT Assistant</h3>
                <p className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                  <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                  Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setMode(mode === "floating" ? "sidebar" : "floating")}
                title={mode === "floating" ? "Sidebar mode" : "Floating mode"}
                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {mode === "floating" ? <PanelRight size={15} /> : <MessageSquare size={15} />}
              </button>
              <button
                onClick={handleClear}
                title="Chat mới"
                className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {mode === "sidebar" ? <ChevronRight size={15} /> : <X size={15} />}
              </button>
            </div>
          </div>

          {/* Messages — custom scrollbar */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 overscroll-contain chat-scrollbar min-h-[200px]">
            {/* Empty state */}
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-start pt-6 px-1 chat-card-enter">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-600/20 flex items-center justify-center mb-4">
                  <Bot size={28} className="text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-1">
                  Xin chào{user?.name ? ` ${user.name.split(" ").pop()}` : ""}! 👋
                </h2>
                <p className="text-sm text-gray-400 mb-5">Tôi có thể giúp gì cho bạn?</p>
                <div className="space-y-1 w-full">
                  {QUICK_ACTIONS.map(({ icon, label }, i) => (
                    <button
                      key={label}
                      onClick={() => handleQuickAction(label)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200 text-left group"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <span className="text-base">{icon}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform duration-200">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={`${msg.role}-${i}`} className="chat-card-enter" style={{ animationDelay: `${i * 30}ms` }}>
                <ChatBubble message={msg} />
              </div>
            ))}

            {/* TDEE Form Card */}
            {showTdeeForm && (
              <div className="chat-card-enter">
                <TdeeFormCard onSubmit={handleTdeeSubmit} />
              </div>
            )}

            {/* Tool loading */}
            {activeTool && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl w-fit chat-card-enter">
                <Loader2 size={14} className="text-emerald-400 animate-spin" />
                <span className="text-xs text-emerald-400/70">{TOOL_LABELS[activeTool] || "Đang xử lý..."}</span>
              </div>
            )}

            {/* Typing dots */}
            {isLoading && !activeTool && (
              <div className="flex items-center gap-1.5 px-3 py-2 chat-card-enter">
                <span className="w-2 h-2 bg-emerald-400/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-emerald-400/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-emerald-400/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}

            {error && (
              <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 chat-card-enter">
                ⚠️ {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/10 bg-gray-900/80 shrink-0">
            <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/10 transition-all">
              <textarea
                ref={(el) => { inputRef.current = el; textareaRef.current = el; }}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi bất kỳ điều gì..."
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none focus:outline-none disabled:opacity-40"
                style={{ maxHeight: "100px" }}
              />
              {isLoading ? (
                <button
                  onClick={cancelRequest}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

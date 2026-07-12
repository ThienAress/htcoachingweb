import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Bot, X, Trash2, Send, Loader2, Square,
  PanelRight, MessageSquare, ChevronRight, Plus, Image as ImageIcon
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useAiChat from "../../hooks/useAiChat";
import ChatBubble from "./ChatBubble";
import TdeeFormCard from "./cards/TdeeFormCard";
import { submitAiFeedback } from "../../services/ai.service";

const TOOL_LABELS = {
  calculate_tdee: "Đang tính TDEE...",
  search_exercises: "Đang tìm bài tập...",
  suggest_meal: "Đang lên thực đơn...",
  get_trainer_info: "Đang tìm HLV...",
  search_knowledge: "Đang tìm kiếm trên Google...",
};

const QUICK_ACTIONS = [
  { icon: "🌐", label: "Khám phá HTCOACHING", value: "Giới thiệu cho tôi trang web HTCOACHING có những gì, tính năng và dịch vụ" },
  { icon: "🔥", label: "Tính TDEE", value: "Tính TDEE cho tôi" },
  { icon: "🥗", label: "Gợi ý thực đơn", value: "Gợi ý thực đơn giảm mỡ tăng cơ" },
  { icon: "👨‍🏫", label: "Tìm HLV", value: "Cho tôi xem thông tin các HLV tại HTCOACHING" },
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
  const [selectedImage, setSelectedImage] = useState(null); // Base64 image
  const fileInputRef = useRef(null);

  const {
    messages,
    isLoading,
    activeTool,
    error,
    conversationId,
    sendMessage,
    loadHistory,
    clearHistory,
    cancelRequest,
  } = useAiChat();

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setIsClosing(false);
    window.dispatchEvent(new Event("ht-chat-opened"));
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
      window.dispatchEvent(new Event("ht-chat-closed"));
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
    const handleCustomClose = () => {
      if (isOpen) handleClose();
    };
    document.addEventListener("keydown", handleEsc);
    window.addEventListener("close-ai-chat", handleCustomClose);
    return () => {
      document.removeEventListener("keydown", handleEsc);
      window.removeEventListener("close-ai-chat", handleCustomClose);
    };
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
    if ((!input.trim() && !selectedImage) || isLoading) return;
    sendMessage(input, { lastPage: location.pathname, image: selectedImage });
    setInput("");
    setSelectedImage(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, selectedImage, isLoading, sendMessage, location.pathname]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Chỉ hỗ trợ tải lên hình ảnh!");
      return;
    }

    // Nén và chuyển thành base64 (Tạm thời chỉ đọc raw)
    const reader = new FileReader();
    reader.onload = (e) => setSelectedImage(e.target.result);
    reader.readAsDataURL(file);
    e.target.value = ""; // reset
  };

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
    (action) => {
      if (action.label === "Tính TDEE") {
        setShowTdeeForm(true);
        return;
      }
      sendMessage(action.value, { lastPage: location.pathname });
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

  const handleFeedback = useCallback(async (messageId, feedback) => {
    if (!conversationId || !messageId) return;
    try {
      await submitAiFeedback(conversationId, messageId, feedback);
    } catch (err) {
      // Silent fail
    }
  }, [conversationId]);

  if (!user) return null;

  // Animation cho mở/đóng
  const getAnimation = () => {
    if (mode === "sidebar") {
      return isClosing ? "chatSidebarOut 0.3s ease-in forwards" : "chatSlideIn 0.3s ease-out";
    }
    return isClosing ? "chatSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "chatSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards";
  };

  const panelClass = mode === "sidebar"
    ? "fixed top-0 right-0 z-50 w-[420px] h-screen border-l border-white/10"
    : "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] sm:w-[550px] md:w-[650px] rounded-2xl border border-white/10";

  // Floating mode: chiều cao cố định vững chãi, responsive trên mobile
  const floatingHeight = mode === "floating"
    ? { height: "min(600px, calc(100vh - 4rem))" }
    : {};

  return (
    <>
      {/* Pill Bar - Kalodata style */}
      {!isOpen && (
        <div
          onClick={handleOpen}
          aria-label="Mở HT Assistant"
          id="ai-chat-toggle"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-2rem)] sm:w-[500px] bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2.5 shadow-2xl flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-500/30 hover:shadow-emerald-500/10 active:scale-[0.98] transition-all duration-300 group"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0 group-hover:rotate-12 transition-transform duration-300">
              <Bot size={16} className="text-white" />
            </div>
            <span className="text-sm text-gray-400 select-none truncate">
              Hỏi bất kỳ điều gì về tập luyện & dinh dưỡng...
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-2 rounded-full text-gray-400 bg-white/5 group-hover:text-emerald-400 group-hover:bg-white/10 transition-colors">
              <Send size={14} />
            </div>
          </div>
        </div>
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
          <div className="bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border-b border-white/10 shrink-0">
            {/* Row 1: Online status + action icons */}
            <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
              <p className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Online
              </p>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setMode(mode === "floating" ? "sidebar" : "floating")}
                  title={mode === "floating" ? "Sidebar mode" : "Floating mode"}
                  className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {mode === "floating" ? <PanelRight size={14} /> : <MessageSquare size={14} />}
                </button>
                <button
                  onClick={handleClear}
                  title="Chat mới"
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {mode === "sidebar" ? <ChevronRight size={14} /> : <X size={14} />}
                </button>
              </div>
            </div>
            {/* Row 2: Bot icon + title */}
            <div className="flex items-center gap-2.5 px-4 pb-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                <Bot size={14} className="text-white" />
              </div>
              <h3 className="text-[14px] font-bold text-white leading-tight tracking-wide">HT Assistant</h3>
            </div>
          </div>

          {/* Messages — custom scrollbar */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 overscroll-contain chat-scrollbar min-h-[200px]">
            {/* Empty state */}
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-start pt-6 px-1 chat-card-enter">
                <h2 className="text-base font-semibold text-white mb-1">
                  Xin chào{user?.name ? ` ${user.name.split(" ").pop()}` : ""}! 👋
                </h2>
                <p className="text-sm text-gray-400 mb-5">Tôi có thể giúp gì cho bạn?</p>
                <div className="space-y-1 w-full">
                  {QUICK_ACTIONS.map(({ icon, label, value }, i) => (
                    <button
                      key={label}
                      onClick={() => handleQuickAction({ label, value })}
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
                <ChatBubble message={msg} onFeedback={handleFeedback} />
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

          {/* Input Area */}
          <div className="px-3 py-3 border-t border-white/10 bg-gray-900/80 shrink-0">
            {/* Image Preview */}
            {selectedImage && (
              <div className="mb-2 relative w-16 h-16 rounded-lg overflow-hidden border border-white/20 group">
                <img src={selectedImage} alt="Upload preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            
            <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-2 py-2 focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/10 transition-all">
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Đính kèm ảnh"
                className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-white/5 disabled:opacity-40 transition-colors shrink-0"
              >
                <Plus size={20} />
              </button>
              
              <textarea
                ref={(el) => { inputRef.current = el; textareaRef.current = el; }}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi bất kỳ điều gì..."
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none focus:outline-none disabled:opacity-40 py-1"
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
                  disabled={!input.trim() && !selectedImage}
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

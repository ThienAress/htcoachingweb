// ChatPanel.jsx — Gemini-style AI chat panel
// Thay thế ChatWidget: right-side panel với sidebar + main, không có backdrop
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Bot, Send, X, Square, PanelLeftOpen, Plus, ArrowUp, Maximize2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useAiChat from "../../hooks/useAiChat";
import ChatBubble from "./ChatBubble";
import ChatPanelSidebar from "./ChatPanelSidebar";

const QUICK_ACTIONS = [
  { emoji: "🌐", label: "Khám phá HTCOACHING", value: "Giới thiệu cho tôi trang web HTCOACHING có những gì, tính năng và dịch vụ" },
  { emoji: "🔥", label: "Tính TDEE", value: "Tính TDEE cho tôi" },
  { emoji: "🥗", label: "Gợi ý thực đơn", value: "Gợi ý thực đơn giảm mỡ tăng cơ" },
  { emoji: "👨‍🏫", label: "Tìm HLV", value: "Cho tôi xem thông tin các HLV tại HTCOACHING" },
];

const TOOL_LABELS = {
  calculate_tdee: "Đang tính TDEE...",
  search_exercises: "Đang tìm bài tập...",
  suggest_meal: "Đang lên thực đơn...",
  get_trainer_info: "Đang tìm HLV...",
  search_knowledge: "Đang tìm kiếm trên Google...",
};

export default function ChatPanel() {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const pillInputRef = useRef(null);
  const pillRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [pillInput, setPillInput] = useState("");
  const [pillExpanded, setPillExpanded] = useState(false);
  const noAuthPaths = ["/login", "/register", "/admin-login", "/login-success"];
  const hidePillPaths = ["/admin", "/trainer"];

  const {
    messages, isLoading, activeTool, error, conversationId,
    conversations, sendMessage, loadHistory, loadConversations,
    clearHistory, switchConversation, removeConversation, cancelRequest,
    retryLastMessage,
  } = useAiChat();

  // Load dữ liệu khi mở panel
  useEffect(() => {
    if (isOpen && user) {
      loadConversations();
      if (messages.length === 0) loadHistory();
    }
  }, [isOpen, user]);

  // Scroll xuống cuối khi có message mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTool]);

  // Focus input khi mở
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Click outside pill → thu lại
  useEffect(() => {
    if (!pillExpanded) return;
    const handleOutside = (e) => {
      if (pillRef.current && !pillRef.current.contains(e.target)) {
        setPillExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [pillExpanded]);

  // Click outside đóng panel + lock scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"; // lock scroll
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = ""; // unlock
      document.documentElement.style.overflow = "";
    }

    if (!isOpen) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = ""; // unlock on unmount
      document.documentElement.style.overflow = "";
    };
  }, [isOpen]);

  const handleSend = useCallback(() => {
    if ((!input.trim() && !selectedImage) || isLoading) return;
    sendMessage(input.trim(), { page: location.pathname, image: selectedImage });
    setInput("");
    setSelectedImage(null);
  }, [input, selectedImage, isLoading, sendMessage, location.pathname]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Chỉ hỗ trợ tải lên hình ảnh!");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setSelectedImage(e.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    clearHistory();
    inputRef.current?.focus();
  };

  const handleSwitchConversation = async (id) => {
    if (id === conversationId) return;
    await switchConversation(id);
  };

  // Ẩn trigger với các trang không cần
  if (!user || noAuthPaths.includes(location.pathname)) return null;
  const showPill = !hidePillPaths.some((p) => location.pathname.startsWith(p));

  // Gửi từ pill bar → mở panel + gửi luôn
  const handlePillSend = () => {
    if (!pillInput.trim()) return;
    const text = pillInput.trim();
    setPillInput("");
    setPillExpanded(false);
    setIsOpen(true);
    // Chờ panel render xong rồi gửi
    setTimeout(() => {
      sendMessage(text, { page: location.pathname });
    }, 200);
  };

  return (
    <>
      {/* Pill Bar — collapsed/expanded, ẩn trên admin/trainer */}
      {showPill && (
      <div
        ref={pillRef}
        onClick={() => {
          if (!pillExpanded) {
            setPillExpanded(true);
            setTimeout(() => pillInputRef.current?.focus(), 250);
          }
        }}
        className={`pill-bar-wrapper ${
          isOpen ? "hidden-state" : "visible-state"
        } ${pillExpanded ? "pill-expanded" : "pill-collapsed"}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-emerald-400 to-cyan-400 flex items-center justify-center shadow-md shadow-emerald-500/10 shrink-0">
            <Bot size={15} className="text-white relative z-10" />
            <span className="absolute inset-0 rounded-full bg-emerald-400/20 blur-[3px]" />
          </div>
          {/* Collapsed text — ẩn khi expanded */}
          <span className={`pill-collapsed-text text-[13.5px] text-gray-400/70 select-none truncate font-medium tracking-wide ${pillExpanded ? "pill-hide" : ""}`}>
            Hỏi bất kỳ điều gì...
          </span>
          {/* Input — ẩn khi collapsed */}
          <input
            ref={pillInputRef}
            type="text"
            value={pillInput}
            onChange={(e) => setPillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handlePillSend();
              }
            }}
            placeholder="Hỏi bất kỳ điều gì về tập luyện & dinh dưỡng..."
            className={`pill-input-field flex-1 bg-transparent text-[13.5px] text-gray-200 placeholder-gray-400/60 outline-none font-medium tracking-wide min-w-0 ${pillExpanded ? "" : "pill-hide"}`}
            tabIndex={pillExpanded ? 0 : -1}
          />
        </div>
        {/* Buttons — fade in/out */}
        <div className={`pill-actions flex items-center gap-1.5 shrink-0 ${pillExpanded ? "" : "pill-hide"}`}>
          <button
            onClick={(e) => { e.stopPropagation(); handlePillSend(); }}
            disabled={!pillInput.trim()}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
              pillInput.trim()
                ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-cyan-400"
                : "bg-white/[0.06] text-gray-500 cursor-default"
            }`}
          >
            <ArrowUp size={15} strokeWidth={2.5} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(true); setPillExpanded(false); }}
            className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Mở rộng"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>
      )}

      {/* Panel — z-[60] đè lên tất cả, 840px (+20%) */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-screen z-[60] flex transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "1008px", maxWidth: "100vw" }}
        role="dialog"
        aria-label="HT Assistant"
      >
        {/* Dark panel background */}
        <div className="flex w-full h-full bg-[#0f1117] border-l border-white/8 shadow-2xl overflow-hidden">

          {/* Sidebar — animate width mượt mà */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
              sidebarOpen ? "w-[210px] opacity-100" : "w-0 opacity-0"
            }`}
          >
            <ChatPanelSidebar
              conversations={conversations}
              activeId={conversationId}
              onNew={handleNewConversation}
              onSwitch={handleSwitchConversation}
              onDelete={removeConversation}
              onToggle={() => setSidebarOpen(false)}
            />
          </div>

          {/* Main content */}
          <div className="relative flex flex-col flex-1 min-w-0">

            {/* Absolute Buttons cho Header */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Mở sidebar"
                className="absolute top-4 left-5 p-1.5 rounded-md text-gray-400 hover:text-white bg-black/20 hover:bg-white/10 transition-colors z-10"
              >
                <PanelLeftOpen size={16} />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-5 p-1.5 rounded-md text-gray-400 hover:text-white bg-black/20 hover:bg-white/10 transition-colors z-10"
            >
              <X size={16} />
            </button>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 pt-12 min-h-0">
              {messages.length === 0 && !isLoading ? (
                /* Welcome state */
                <div className="flex flex-col items-center justify-center h-full pb-10">
                  {/* Dùng <p> thay <h1> để tránh global CSS uppercase */}
                  <p className="text-base font-semibold text-white mb-2 text-center">
                    HT Assistant sẵn sàng, chờ bro thôi 💪
                  </p>
                  <p className="text-sm text-gray-500 mb-8 text-center">
                    Hỏi về tập luyện, dinh dưỡng, hoặc VĐV yêu thích của bạn
                  </p>
                  <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                    {QUICK_ACTIONS.map((a) => (
                      <button
                        key={a.value}
                        onClick={() => sendMessage(a.value, { page: location.pathname })}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/20 transition-all text-left"
                      >
                        <span className="text-lg">{a.emoji}</span>
                        <span className="text-xs text-gray-300">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Chat messages */
                <div className="flex flex-col gap-4">
                  {messages.map((msg, i) => {
                    // Bubble cuối cùng của assistant + đang loading → hiện thinking animation
                    const isLastAssistant =
                      msg.role === "assistant" &&
                      i === messages.length - 1 &&
                      isLoading;
                    return (
                      <ChatBubble
                        key={i}
                        message={msg}
                        onRetry={retryLastMessage}
                        isThinking={isLastAssistant}
                      />
                    );
                  })}

                  {activeTool && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400/80">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                      {TOOL_LABELS[activeTool] || "Đang xử lý..."}
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center justify-between text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <span>{error}</span>
                      <button 
                        onClick={retryLastMessage}
                        className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-md text-red-300 transition-colors font-medium flex items-center gap-1.5"
                      >
                        🔄 Thử lại
                      </button>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="shrink-0 px-4 pb-4 pt-2 border-t border-white/8 relative">
              {/* Image Preview */}
              {selectedImage && (
                <div className="mb-3 relative w-16 h-16 rounded-lg overflow-hidden border border-white/20 group shadow-md">
                  <img src={selectedImage} alt="Upload preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2 bg-white/5 rounded-2xl border border-white/10 px-3 py-2.5 focus-within:border-emerald-500/40 transition-colors">
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
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-emerald-400 hover:bg-white/10 disabled:opacity-40 transition-colors"
                >
                  <Plus size={18} />
                </button>

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Hỏi bất kỳ điều gì..."
                  rows={1}
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none min-h-[32px] max-h-[120px] leading-relaxed py-1.5 disabled:opacity-50"
                  style={{ fieldSizing: "content" }}
                />
                <button
                  onClick={isLoading ? cancelRequest : handleSend}
                  disabled={!isLoading && !input.trim() && !selectedImage}
                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isLoading
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : (input.trim() || selectedImage)
                      ? "bg-emerald-500 text-white hover:bg-emerald-400"
                      : "bg-white/5 text-gray-600 cursor-not-allowed"
                  }`}
                >
                  {isLoading ? <Square size={13} /> : <Send size={13} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

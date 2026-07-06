// ChatPanel.jsx — Gemini-style AI chat panel
// Thay thế ChatWidget: right-side panel với sidebar + main, không có backdrop
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Bot, Send, X, Square, PanelLeftOpen, Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useAiChat from "../../hooks/useAiChat";
import ChatBubble from "./ChatBubble";
import ChatPanelSidebar from "./ChatPanelSidebar";

const QUICK_ACTIONS = [
  { emoji: "🔥", label: "Tính TDEE", value: "Tính TDEE cho tôi" },
  { emoji: "💪", label: "Bài tập ngực", value: "Gợi ý bài tập ngực hiệu quả" },
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
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const noAuthPaths = ["/login", "/register", "/admin-login", "/login-success"];

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

  return (
    <>
      {/* Floating trigger button — luôn hiện Bot icon, không đổi thành X */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Mở HT Assistant"
        className={`fixed z-[61] right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 bg-gradient-to-br from-emerald-500 to-cyan-600 ${
          isOpen ? "opacity-0 pointer-events-none translate-x-10" : "opacity-100 translate-x-0"
        }`}
        style={{ bottom: "180px" }}
      >
        <Bot size={24} className="text-white" />
        {!isOpen && (
          <span className="absolute inset-0 rounded-full border-2 border-emerald-400/50 animate-ping opacity-70 pointer-events-none" />
        )}
      </button>

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
                  {messages.map((msg, i) => (
                    <ChatBubble key={i} message={msg} onRetry={retryLastMessage} />
                  ))}
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

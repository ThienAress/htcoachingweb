import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Bot, Send, X, Square, PanelLeftOpen, Plus, ArrowUp, Maximize2, Sun, Moon, ImageIcon, Wand2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useAiChat from "../../hooks/useAiChat";
import ChatBubble from "./ChatBubble";
import ChatPanelSidebar from "./ChatPanelSidebar";
import { submitAiFeedback } from "../../services/ai.service";

const PAGE_TYPE_MAP = {
  "/tdee-calculator": "tdee_calculator",
  "/mealplan": "meal_plan",
  "/exercises": "exercises",
  "/cong-thuc-nau-an": "recipe",
  "/ket-qua-khach-hang": "customer_story",
  "/huan-luyen-vien": "trainer_profile",
  "/training-schedule": "training_schedule",
  "/wallet": "wallet",
  "/blog": "blog",
  "/workout-plans": "workout_plan",
};

export function getPageType(pathname) {
  for (const [prefix, type] of Object.entries(PAGE_TYPE_MAP)) {
    if (pathname.startsWith(prefix)) return type;
  }
  return "general";
}

// Quick actions mặc định (hiện khi ở trang không có gợi ý riêng)
const DEFAULT_QUICK_ACTIONS = [
  { emoji: "🌐", label: "Khám phá", value: "Giới thiệu cho tôi trang web HTCOACHING có những gì, tính năng và dịch vụ" },
  { emoji: "🔥", label: "Tính TDEE", value: "Tính TDEE cho tôi" },
  { emoji: "🥗", label: "Thực đơn", value: "Gợi ý thực đơn giảm mỡ tăng cơ" },
  { emoji: "👨‍🏫", label: "Tìm HLV", value: "Cho tôi xem thông tin các HLV tại HTCOACHING" },
];

// Gợi ý câu hỏi theo trang (tương tự Gemini trên YouTube)
// Key "detail" dùng khi URL có slug (trang chi tiết), "list" dùng cho trang danh sách
const PAGE_SUGGESTIONS = {
  blog: {
    detail: [
      { emoji: "📖", label: "Tóm tắt bài viết", value: "Tóm tắt nội dung bài viết tôi đang đọc" },
      { emoji: "💡", label: "Ý chính là gì?", value: "Những điểm chính trong bài viết này là gì?" },
      { emoji: "🏋️", label: "Áp dụng thế nào?", value: "Tôi nên áp dụng kiến thức trong bài viết này vào tập luyện như thế nào?" },
    ],
    list: [
      { emoji: "📰", label: "Bài viết hay", value: "Gợi ý cho tôi chủ đề fitness nào đáng đọc" },
    ],
  },
  recipe: {
    detail: [
      { emoji: "🥗", label: "Món này healthy không?", value: "Món ăn tôi đang xem có phù hợp cho người tập gym không?" },
      { emoji: "📋", label: "Nguyên liệu cần gì?", value: "Liệt kê nguyên liệu chính của món này" },
      { emoji: "🔄", label: "Thay thế nguyên liệu", value: "Tôi có thể thay thế nguyên liệu nào trong món này cho phù hợp hơn?" },
    ],
    list: [
      { emoji: "🍳", label: "Món ăn healthy", value: "Gợi ý cho tôi vài công thức nấu ăn healthy" },
    ],
  },
  customer_story: {
    detail: [
      { emoji: "📊", label: "Tóm tắt kết quả", value: "Tóm tắt kết quả tập luyện của học viên tôi đang xem" },
      { emoji: "💪", label: "Phương pháp gì?", value: "Học viên này đã tập theo phương pháp gì để đạt kết quả?" },
    ],
  },
  trainer_profile: {
    detail: [
      { emoji: "👨‍🏫", label: "Giới thiệu HLV", value: "Cho tôi biết thêm về HLV tôi đang xem" },
      { emoji: "📅", label: "Đăng ký tập", value: "Tôi muốn đăng ký tập với HLV này" },
    ],
  },
  tdee_calculator: {
    list: [
      { emoji: "🔥", label: "Tính TDEE", value: "Tính TDEE cho tôi" },
      { emoji: "❓", label: "TDEE là gì?", value: "TDEE là gì và tại sao quan trọng?" },
    ],
  },
  exercises: {
    list: [
      { emoji: "💪", label: "Gợi ý bài tập", value: "Gợi ý bài tập cho người mới bắt đầu" },
      { emoji: "🎯", label: "Tập nhóm cơ nào?", value: "Hôm nay tôi nên tập nhóm cơ nào?" },
    ],
  },
};

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [chatTheme, setChatTheme] = useState(() => localStorage.getItem("ht_chat_theme") || "dark");
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const pillInputRef = useRef(null);
  const pillRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const attachMenuRef = useRef(null);
  
  const [pillInput, setPillInput] = useState("");
  const [pillExpanded, setPillExpanded] = useState(false);
  const noAuthPaths = ["/login", "/register", "/login-success"];
  const hidePillPaths = ["/admin", "/trainer"];

  const {
    messages, isLoading, activeTool, error, conversationId,
    conversations, sendMessage, loadHistory, loadConversations,
    clearHistory, switchConversation, removeConversation, cancelRequest,
    retryLastMessage, editMessage,
  } = useAiChat();

  useEffect(() => {
    localStorage.setItem("ht_chat_theme", chatTheme);
  }, [chatTheme]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (isOpen && user) {
      loadConversations();
      // Luôn tạo cuộc hội thoại mới khi mở chat → hiện suggestions context-aware
      if (messages.length === 0 && !conversationId) loadHistory();
    }
  }, [isOpen, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTool]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

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

  useEffect(() => {
    if (!showAttachMenu) return;
    const handleOutside = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showAttachMenu]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === "Escape") setIsOpen(false); };
    const handleClose = () => setIsOpen(false);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("close-ai-chat", handleClose);
    return () => {
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("close-ai-chat", handleClose);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isOpen]);

  const handleSend = useCallback(() => {
    if ((!input.trim() && !selectedImage) || isLoading) return;
    
    const context = {
      page: location.pathname,
      pageType: getPageType(location.pathname),
      pageTitle: document.title,
      image: selectedImage
    };
    
    sendMessage(input.trim(), context);
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
    if (isMobile) setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Helper: lấy suggestions theo trang hiện tại
  const getContextSuggestions = useCallback(() => {
    const pageType = getPageType(location.pathname);
    const slugParts = location.pathname.split('/').filter(Boolean);
    const isDetail = slugParts.length >= 2;
    const pageSuggestions = PAGE_SUGGESTIONS[pageType];
    const contextActions = pageSuggestions
      ? (isDetail ? pageSuggestions.detail : pageSuggestions.list) || []
      : [];
    return [
      ...contextActions,
      ...DEFAULT_QUICK_ACTIONS.filter(d => !contextActions.some(c => c.value === d.value)),
    ].slice(0, 4);
  }, [location.pathname]);

  const handleSwitchConversation = async (id) => {
    if (id === conversationId) return;
    await switchConversation(id);
    if (isMobile) setSidebarOpen(false);
  };

  const handleFeedback = useCallback(async (messageId, feedback) => {
    if (!conversationId || !messageId) return;
    try {
      await submitAiFeedback(conversationId, messageId, feedback);
    } catch (err) {
      // Silent fail — feedback là non-critical
    }
  }, [conversationId]);

  const handleEditMessage = useCallback((msgIndex, newText) => {
    if (!newText?.trim()) return;
    editMessage(msgIndex, newText);
  }, [editMessage]);

  if (!user || noAuthPaths.includes(location.pathname)) return null;
  const showPill = !hidePillPaths.some((p) => location.pathname.startsWith(p));

  const handlePillSend = () => {
    if (!pillInput.trim()) return;
    const text = pillInput.trim();
    setPillInput("");
    setPillExpanded(false);
    setIsOpen(true);
    setTimeout(() => {
      const context = {
        page: location.pathname,
        pageType: getPageType(location.pathname),
        pageTitle: document.title
      };
      sendMessage(text, context);
    }, 200);
  };

  const toggleTheme = () => {
    setChatTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const renderInputArea = () => (
    <div className="relative w-full max-w-3xl mx-auto flex flex-col gap-2">
      {selectedImage && (
        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-300 dark:border-white/20 group shadow-md ml-2">
          <img src={selectedImage} alt="Upload preview" className="w-full h-full object-cover" />
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 bg-gray-100 dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-white/10 px-4 py-3 focus-within:border-emerald-500/40 focus-within:bg-white dark:focus-within:bg-white/10 transition-all shadow-sm">
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
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
        >
          <Plus size={20} />
        </button>

        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hỏi bất kỳ điều gì..."
          rows={1}
          disabled={isLoading}
          className="flex-1 bg-transparent text-base text-gray-900 dark:text-white placeholder-gray-500 resize-none outline-none min-h-[24px] max-h-[200px] leading-relaxed py-1.5 disabled:opacity-50"
          style={{ fieldSizing: "content" }}
        />
        <button
          onClick={isLoading ? cancelRequest : handleSend}
          disabled={!isLoading && !input.trim() && !selectedImage}
          className={`shrink-0 p-2 flex items-center justify-center transition-colors bg-transparent ${
            isLoading
              ? "text-red-500 hover:text-red-600"
              : (input.trim() || selectedImage)
              ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              : "text-gray-400 dark:text-gray-600 cursor-not-allowed"
          }`}
        >
          {isLoading ? <Square size={14} /> : <Send size={16} className="ml-1" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className={chatTheme === 'dark' ? 'dark' : ''}>
      {/* Pill Bar */}
      {showPill && (
        <div
          ref={pillRef}
          onClick={() => {
            if (isMobile) {
              setIsOpen(true);
              return;
            }
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
            <span className={`pill-collapsed-text text-[13.5px] text-gray-400/70 select-none truncate font-medium tracking-wide ${pillExpanded ? "pill-hide" : ""}`}>
              Hỏi bất kỳ điều gì...
            </span>
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

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed inset-0 z-[60] flex transition-transform duration-300 ease-out w-full ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="HT Assistant"
      >
        {/* Main Background */}
        <div className="flex w-full h-full bg-white dark:bg-[#131314] text-gray-900 dark:text-white transition-colors duration-300 overflow-hidden">
          
          {/* Sidebar */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden shrink-0 absolute md:relative z-20 h-full border-r border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1e1f22] ${
              sidebarOpen ? "w-full md:w-[260px] opacity-100" : "w-0 opacity-0"
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
            {/* Header Actions */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
              <div>
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    title="Mở menu"
                    className="p-2 rounded-full text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-white/10 backdrop-blur-sm transition-colors pointer-events-auto shadow-sm"
                  >
                    <PanelLeftOpen size={18} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={toggleTheme}
                  title="Đổi giao diện"
                  className="p-2 rounded-full text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-white/10 backdrop-blur-sm transition-colors shadow-sm"
                >
                  {chatTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Đóng"
                  className="p-2 rounded-full text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-white/10 backdrop-blur-sm transition-colors shadow-sm"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 flex flex-col min-h-0 relative">
              {messages.length === 0 && !isLoading ? (
                /* Empty state - Center aligned */
                <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 via-emerald-400 to-cyan-400 flex items-center justify-center shadow-lg mb-6">
                    <Bot size={24} className="text-white" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-semibold mb-8 text-center text-gray-800 dark:text-gray-100">
                    Tôi có thể giúp gì cho bạn, {user?.name}?
                  </h1>
                  
                  {/* Centered Input Area */}
                  <div className="w-full mb-8">
                    {renderInputArea()}
                  </div>

                  {(() => {
                    const actions = getContextSuggestions();
                    return (
                      <div className={`grid grid-cols-2 ${actions.length > 2 ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-3 w-full max-w-3xl mx-auto`}>
                        {actions.map((a) => (
                          <button
                            key={a.value}
                            onClick={() => sendMessage(a.value, { page: location.pathname, pageType: getPageType(location.pathname), pageTitle: document.title })}
                            className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 transition-all text-left"
                          >
                            <span className="text-2xl">{a.emoji}</span>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{a.label}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Chat state */
                <>
                  <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 py-6 pt-20">
                    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
                      {messages.map((msg, i) => {
                        const isLastAssistant =
                          msg.role === "assistant" &&
                          i === messages.length - 1 &&
                          isLoading;
                        return (
                          <ChatBubble
                            key={i}
                            message={msg}
                            onRetry={retryLastMessage}
                            onEdit={(newText) => handleEditMessage(i, newText)}
                            isThinking={isLastAssistant}
                            onFeedback={handleFeedback}
                          />
                        );
                      })}

                      {activeTool && (
                        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                          <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </div>
                          {TOOL_LABELS[activeTool] || "Đang xử lý..."}
                        </div>
                      )}
                      {error && (
                        <div className="flex items-center justify-between text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
                          <span>{error}</span>
                          <button 
                            onClick={retryLastMessage}
                            className="px-3 py-1.5 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/40 rounded-lg transition-colors font-medium flex items-center gap-1.5"
                          >
                            🔄 Thử lại
                          </button>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                  
                  {/* Bottom Suggestions + Input Area */}
                  <div className="shrink-0 px-4 md:px-6 pb-6 pt-2 bg-gradient-to-t from-white via-white to-transparent dark:from-[#131314] dark:via-[#131314] z-10">
                    {/* Persistent suggestions */}
                    {!isLoading && (() => {
                      const actions = getContextSuggestions();
                      if (actions.length === 0) return null;
                      return (
                        <div className="w-full max-w-3xl mx-auto flex flex-wrap justify-center gap-2 mb-3">
                          {actions.map((a) => (
                            <button
                              key={a.value}
                              onClick={() => sendMessage(a.value, { page: location.pathname, pageType: getPageType(location.pathname), pageTitle: document.title })}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 transition-colors shadow-sm"
                            >
                              <span>{a.emoji}</span>
                              <span className="whitespace-nowrap">{a.label}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    {renderInputArea()}
                    <div className="text-center text-[11px] text-gray-500 dark:text-gray-500 mt-3">
                      HT Assistant là AI và có thể mắc sai sót.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bot, Send, X, Square, PanelLeftOpen, Plus, ArrowUp, Maximize2, Sun, Moon, ImageIcon, Wand2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useAiChat from "../../hooks/useAiChat";
import ChatBubble from "./ChatBubble";
import ChatPanelSidebar from "./ChatPanelSidebar";
import ConversationNavigator from "./ConversationNavigator";
import TdeeFormCard from "./cards/TdeeFormCard";
import { createChatHistoryLoadGate } from "./chatHistoryLoadGate";
import {
  buildConversationQuestionItems,
  getConversationMessageKey,
} from "./conversationNavigatorRuntime";
import {
  getChatVisualViewportBounds,
  getChatQuotaStatusLine,
  getChatScrollBehavior,
  isTdeeQuickAction,
  persistChatTheme,
  resolveInitialChatTheme,
} from "./chatPanelRuntime";
import { submitAiFeedback } from "../../services/ai.service";
import { compressChatImage } from "../../utils/compressChatImage";
import {
  getAiMessageContext,
  getAiPageContext,
  getAiPageSuggestions,
} from "../../config/aiPageContext";

// eslint-disable-next-line react-refresh/only-export-components
export function getPageType(pathname) {
  return getAiPageContext(pathname).pageType;
}

const TOOL_LABELS = {
  calculate_tdee: "Đang tính TDEE...",
  search_exercises: "Đang tìm bài tập...",
  suggest_meal: "Đang lên thực đơn...",
  get_trainer_info: "Đang tìm HLV...",
  search_knowledge: "Đang kiểm chứng thông tin...",
};

const QUOTA_STATUS_TONE_CLASSES = {
  normal: "text-gray-500 dark:text-gray-400",
  low: "font-medium text-amber-700 dark:text-amber-300",
  exhausted: "font-semibold text-rose-700 dark:text-rose-300",
};

const AiMemorySettings = lazy(() => import("./AiMemorySettings"));

export default function ChatPanel({ initiallyOpen = false }) {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(
    window.innerWidth >= 768 && Boolean(user),
  );
  const [chatTheme, setChatTheme] = useState(resolveInitialChatTheme);
  const [mobileViewport, setMobileViewport] = useState(null);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [memorySettingsOpen, setMemorySettingsOpen] = useState(false);
  const [showTdeeForm, setShowTdeeForm] = useState(false);

  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const pillInputRef = useRef(null);
  const pillRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const messagesContentRef = useRef(null);
  const questionTargetRefs = useRef(new Map());
  const attachMenuRef = useRef(null);
  const historyLoadGateRef = useRef(null);
  const wasOpenRef = useRef(initiallyOpen);

  if (historyLoadGateRef.current == null) {
    historyLoadGateRef.current = createChatHistoryLoadGate();
  }

  const [pillInput, setPillInput] = useState("");
  const [pillExpanded, setPillExpanded] = useState(false);
  const noAuthPaths = ["/login", "/register", "/login-success"];
  const hidePillPaths = ["/admin", "/trainer"];

  const {
    messages, isLoading, activeTool, error, quota, conversationId,
    conversations, pendingConversationIds, sendMessage, loadHistory, loadConversations,
    clearHistory, switchConversation, removeConversation, cancelRequest,
    retryLastMessage, editMessage,
  } = useAiChat({ persistenceEnabled: Boolean(user) });
  const authenticatedUserId = user?._id || user?.id || null;
  const conversationQuestionItems = useMemo(
    () => buildConversationQuestionItems(messages),
    [messages],
  );
  const getQuestionTarget = useCallback(
    (key) => questionTargetRefs.current.get(key) || null,
    [],
  );
  const handleNavigateToQuestion = useCallback((key) => {
    const scrollContainer = messagesScrollRef.current;
    const target = questionTargetRefs.current.get(key);
    if (!scrollContainer || !target) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    scrollContainer.scrollTo({
      top: Math.max(
        0,
        scrollContainer.scrollTop + targetRect.top - containerRect.top - 24,
      ),
      behavior: getChatScrollBehavior(window),
    });
  }, []);
  const buildCurrentContext = useCallback(
    () => getAiMessageContext(location.pathname, document.title),
    [location.pathname],
  );

  useEffect(() => {
    persistChatTheme(chatTheme);
  }, [chatTheme]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile && Boolean(authenticatedUserId));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [authenticatedUserId]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;

    const visualViewport = window.visualViewport;
    const syncViewport = () => {
      setMobileViewport(getChatVisualViewportBounds(window));
    };

    syncViewport();
    visualViewport?.addEventListener("resize", syncViewport);
    visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    return () => {
      visualViewport?.removeEventListener("resize", syncViewport);
      visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
    };
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (
      !isOpen ||
      !authenticatedUserId ||
      !historyLoadGateRef.current.shouldLoad(authenticatedUserId)
    ) {
      return;
    }
    if (isOpen && user) {
      loadConversations();
      // Luôn tạo cuộc hội thoại mới khi mở chat → hiện suggestions context-aware
      if (messages.length === 0 && !conversationId) loadHistory();
    }
  }, [
    authenticatedUserId,
    conversationId,
    isOpen,
    loadConversations,
    loadHistory,
    messages.length,
    user,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: getChatScrollBehavior(window),
    });
  }, [messages, activeTool]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;

    wasOpenRef.current = false;
    const frame = window.requestAnimationFrame(() => pillRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
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
    if (!isOpen) return;

    const body = document.body;
    const root = document.documentElement;
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
    };
    const previousRootStyles = {
      overflow: root.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";

    const handleKey = (e) => { if (e.key === "Escape") setIsOpen(false); };
    const handleClose = () => setIsOpen(false);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("close-ai-chat", handleClose);
    return () => {
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("close-ai-chat", handleClose);
      Object.assign(body.style, previousBodyStyles);
      Object.assign(root.style, previousRootStyles);
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const handleSend = useCallback(() => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const context = {
      ...buildCurrentContext(),
      ...(selectedImage && { image: selectedImage }),
    };

    sendMessage(input.trim(), context);
    setInput("");
    setSelectedImage(null);
  }, [buildCurrentContext, input, selectedImage, isLoading, sendMessage]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSelectedImage(await compressChatImage(file));
    } catch (imageError) {
      alert(imageError.message);
    }
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
    setShowTdeeForm(false);
    if (isMobile) setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const getContextSuggestions = useCallback(
    () => getAiPageSuggestions(location.pathname),
    [location.pathname],
  );

  const handleSuggestion = useCallback((action) => {
    if (isTdeeQuickAction(action)) {
      setShowTdeeForm(true);
      return;
    }
    sendMessage(action.value, buildCurrentContext());
  }, [buildCurrentContext, sendMessage]);

  const handleTdeeSubmit = useCallback((text) => {
    setShowTdeeForm(false);
    sendMessage(text, buildCurrentContext());
  }, [buildCurrentContext, sendMessage]);

  const handleSwitchConversation = async (id) => {
    if (id === conversationId) return;
    await switchConversation(id);
    if (isMobile) setSidebarOpen(false);
  };

  const handleFeedback = useCallback(async (messageId, feedback) => {
    if (!user || !conversationId || !messageId) return;
    try {
      await submitAiFeedback(conversationId, messageId, feedback);
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      // Silent fail — feedback là non-critical
    }
  }, [conversationId, user]);

  const handleEditMessage = useCallback((messageId, newText) => {
    if (!newText?.trim()) return;
    editMessage(messageId, newText);
  }, [editMessage]);

  if (noAuthPaths.includes(location.pathname)) return null;
  const showPill = !hidePillPaths.some((p) => location.pathname.startsWith(p));

  const handlePillSend = () => {
    if (!pillInput.trim()) return;
    const text = pillInput.trim();
    setPillInput("");
    setPillExpanded(false);
    setIsOpen(true);
    setTimeout(() => {
      sendMessage(text, buildCurrentContext());
    }, 200);
  };

  const toggleTheme = () => {
    setChatTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const quotaStatusLine = getChatQuotaStatusLine(quota);

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

      <div className="flex items-end gap-2 bg-gray-100 dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-white/10 px-4 py-3 focus-within:border-emerald-500/40 focus-within:bg-white dark:focus-within:bg-white/10 transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none shadow-sm">
        {user && (
          <>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              ref={fileInputRef}
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Đính kèm ảnh"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-emerald-500 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-emerald-400"
            >
              <Plus size={20} />
            </button>
          </>
        )}

        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hỏi về tập luyện, dinh dưỡng..."
          rows={1}
          disabled={isLoading}
          className="flex-1 bg-transparent text-base text-gray-900 dark:text-white placeholder-gray-500 resize-none outline-none min-h-[24px] max-h-[200px] leading-relaxed py-1.5 disabled:opacity-50"
          style={{ fieldSizing: "content" }}
        />
        <button
          onClick={isLoading ? cancelRequest : handleSend}
          disabled={!isLoading && !input.trim() && !selectedImage}
          aria-label={isLoading ? "Dừng phản hồi" : "Gửi tin nhắn"}
          title={isLoading ? "Dừng phản hồi" : "Gửi tin nhắn"}
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
      {quotaStatusLine && (
        <p
          className={`px-3 text-xs ${QUOTA_STATUS_TONE_CLASSES[quotaStatusLine.tone]}`}
          role="status"
          aria-live="polite"
        >
          {quotaStatusLine.label}
        </p>
      )}
    </div>
  );

  return (
    <div className={chatTheme === 'dark' ? 'dark' : ''}>
      {/* Pill Bar */}
      {showPill && (
        <div
          ref={pillRef}
          role={pillExpanded ? "group" : "button"}
          tabIndex={pillExpanded ? -1 : 0}
          aria-label={pillExpanded ? "Nhập câu hỏi cho HT Assistant" : "Mở ô hỏi HT Assistant"}
          onKeyDown={(event) => {
            if (!pillExpanded && ["Enter", " "].includes(event.key)) {
              event.preventDefault();
              if (isMobile) setIsOpen(true);
              else setPillExpanded(true);
            }
          }}
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
          className={`pill-bar-wrapper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
            isOpen ? "hidden-state" : "visible-state"
          } ${pillExpanded ? "pill-expanded" : "pill-collapsed"}`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-emerald-400 to-cyan-400 flex items-center justify-center shadow-md shadow-emerald-500/10 shrink-0">
              <Bot size={15} className="text-white relative z-10" />
              <span className="absolute inset-0 rounded-full bg-emerald-400/20 blur-[3px]" />
            </div>
            <span className={`pill-collapsed-text text-[13.5px] text-gray-400/70 select-none truncate font-medium tracking-wide ${pillExpanded ? "pill-hide" : ""}`}>
              Hỏi về tập luyện & dinh dưỡng...
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
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-[color,background-color,box-shadow] duration-150 motion-reduce:transition-none ${
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
        className={`fixed inset-0 z-[60] flex w-full transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={
          isMobile && mobileViewport
            ? {
                top: `${mobileViewport.top}px`,
                height: `${mobileViewport.height}px`,
                bottom: "auto",
              }
            : undefined
        }
        role="dialog"
        aria-label="HT Assistant"
        aria-modal={isOpen ? "true" : undefined}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        {/* Main Background */}
        <div className="flex w-full h-full bg-white dark:bg-[#131314] text-gray-900 dark:text-white transition-colors duration-200 motion-reduce:transition-none overflow-hidden">

          {/* Sidebar */}
          {user && (
            <div
              className={`transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none overflow-hidden shrink-0 absolute md:relative z-20 h-full border-r border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1e1f22] ${
                sidebarOpen ? "w-full md:w-[260px] opacity-100" : "w-0 opacity-0"
              }`}
            >
              <ChatPanelSidebar
                conversations={conversations}
                activeId={conversationId}
                pendingConversationIds={pendingConversationIds}
                onNew={handleNewConversation}
                onSwitch={handleSwitchConversation}
                onDelete={removeConversation}
                onToggle={() => setSidebarOpen(false)}
                onOpenMemory={() => setMemorySettingsOpen(true)}
              />
            </div>
          )}

          {/* Main content */}
          <div className="relative flex flex-col flex-1 min-w-0">
            {/* Header Actions */}
            <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 flex items-center justify-between gap-2">
              <div className="flex justify-start">
                {user && !sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    title="Mở menu"
                    aria-label="Mở menu"
                    className="inline-flex size-11 items-center justify-center rounded-full text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-white/10 backdrop-blur-sm transition-colors pointer-events-auto shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                  >
                    <PanelLeftOpen size={18} />
                  </button>
                )}
              </div>
              <div className="pointer-events-auto flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  title="Đổi giao diện"
                  aria-label="Đổi giao diện"
                  className="inline-flex size-11 items-center justify-center rounded-full text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-white/10 backdrop-blur-sm transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                >
                  {chatTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Đóng"
                  aria-label="Đóng"
                  className="inline-flex size-11 items-center justify-center rounded-full text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-white/10 backdrop-blur-sm transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 flex flex-col min-h-0 relative">
              {messages.length === 0 && !isLoading && !showTdeeForm ? (
                /* Empty state - Center aligned */
                <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 via-emerald-400 to-cyan-400 flex items-center justify-center shadow-lg mb-6">
                    <Bot size={24} className="text-white" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-semibold mb-8 text-center text-gray-800 dark:text-gray-100">
                    {user?.name
                      ? `Tôi có thể giúp gì cho bạn, ${user.name}?`
                      : "Tôi có thể giúp gì cho bạn?"}
                  </h1>

                  {!user && (
                    <div className="mb-6 flex max-w-xl flex-col items-center justify-center gap-1 text-center text-sm text-gray-600 dark:text-gray-300">
                      <span>Bạn đang dùng chế độ khách với số lượt hỏi giới hạn.</span>
                      <Link
                        to="/login"
                        onClick={() => setIsOpen(false)}
                        className="min-h-11 rounded-xl px-3 py-2 font-semibold text-emerald-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300"
                      >
                        Đăng nhập để lưu lịch sử
                      </Link>
                    </div>
                  )}

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
                            onClick={() => handleSuggestion(a)}
                            className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 transition-colors duration-150 motion-reduce:transition-none text-left"
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
                  <div
                    ref={messagesScrollRef}
                    className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 py-6 pt-20"
                  >
                    <div
                      ref={messagesContentRef}
                      className="flex flex-col gap-4 max-w-4xl mx-auto"
                    >
                      {messages.map((msg, i) => {
                        const messageKey = getConversationMessageKey(msg, i);
                        const isLastAssistant =
                          msg.role === "assistant" &&
                          i === messages.length - 1 &&
                          isLoading;
                        return (
                          <div
                            key={messageKey}
                            ref={msg.role === "user" ? (node) => {
                              if (node) questionTargetRefs.current.set(messageKey, node);
                              else questionTargetRefs.current.delete(messageKey);
                            } : undefined}
                          >
                            <ChatBubble
                              message={msg}
                              onRetry={user ? retryLastMessage : undefined}
                              onEdit={user ? handleEditMessage : undefined}
                              isThinking={isLastAssistant}
                              onFeedback={user ? handleFeedback : undefined}
                            />
                          </div>
                        );
                      })}

                      {showTdeeForm && (
                        <TdeeFormCard onSubmit={handleTdeeSubmit} />
                      )}

                      {activeTool && (
                        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                          <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="h-1.5 w-1.5 animate-pulse motion-reduce:animate-none rounded-full bg-emerald-500 dark:bg-emerald-400"
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
                          {user && (
                            <button
                              onClick={retryLastMessage}
                              className="px-3 py-1.5 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/40 rounded-lg transition-colors font-medium flex items-center gap-1.5"
                            >
                              🔄 Thử lại
                            </button>
                          )}
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                  <ConversationNavigator
                    items={conversationQuestionItems}
                    scrollContainerRef={messagesScrollRef}
                    contentRef={messagesContentRef}
                    getTarget={getQuestionTarget}
                    onNavigate={handleNavigateToQuestion}
                  />

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
                              onClick={() => handleSuggestion(a)}
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
                      {!user && (
                        <>
                          {" "}
                          <Link
                            to="/login"
                            onClick={() => setIsOpen(false)}
                            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                          >
                            Đăng nhập để hỏi thêm và lưu lịch sử.
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {user && memorySettingsOpen && (
        <Suspense fallback={null}>
          <AiMemorySettings onClose={() => setMemorySettingsOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

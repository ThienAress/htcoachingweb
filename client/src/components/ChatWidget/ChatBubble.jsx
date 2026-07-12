import React, { memo, useCallback, useState, useRef, useEffect } from "react";
import { Bot, User, ThumbsUp, ThumbsDown, Copy, Check, RotateCcw, Pencil } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import TdeeResultCard from "./cards/TdeeResultCard";
import ExerciseListCard from "./cards/ExerciseListCard";
import MealSuggestionCard from "./cards/MealSuggestionCard";
import TrainerInfoCard from "./cards/TrainerInfoCard";
import WalletSummaryCard from "./cards/WalletSummaryCard";
import WorkoutPlanCard from "./cards/WorkoutPlanCard";
import BlogListCard from "./cards/BlogListCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CARD_COMPONENTS = {
  tdee: TdeeResultCard,
  exercise: ExerciseListCard,
  meal: MealSuggestionCard,
  trainer: TrainerInfoCard,
  wallet: WalletSummaryCard,
  workoutPlan: WorkoutPlanCard,
  blogList: BlogListCard,
};

const ThinkingDots = () => (
  <div className="flex items-center gap-1.5 h-5" aria-label="HT Assistant đang suy nghĩ">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="thinking-dot"
        style={{ animationDelay: `${i * 160}ms` }}
      />
    ))}
  </div>
);

const ChatBubble = memo(function ChatBubble({ message, onRetry, onEdit, isThinking, onFeedback }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isUser = message.role === "user";
  const [feedbackState, setFeedbackState] = useState(message.feedback || null);
  const [copied, setCopied] = useState(false);
  const [hasRetried, setHasRetried] = useState(false);
  const [showRetryApology, setShowRetryApology] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content || "");
  const editRef = useRef(null);

  // Auto-focus và đặt cursor cuối khi mở edit
  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      const len = editRef.current.value.length;
      editRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleCopy = useCallback(() => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content]);

  const handleRetry = useCallback(() => {
    if (hasRetried) {
      setShowRetryApology(true);
      setTimeout(() => setShowRetryApology(false), 3500);
      return;
    }
    setHasRetried(true);
    onRetry?.();
  }, [hasRetried, onRetry]);

  const handleEditOpen = useCallback(() => {
    setEditText(message.content || "");
    setIsEditing(true);
  }, [message.content]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditText(message.content || "");
  }, [message.content]);

  const handleEditSubmit = useCallback(() => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message.content) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    onEdit?.(trimmed);
  }, [editText, message.content, onEdit]);

  const handleEditKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === "Escape") {
      handleEditCancel();
    }
  }, [handleEditSubmit, handleEditCancel]);

  const handleHashClick = useCallback((href) => {
    const [path, hash] = href.split("#");
    const targetPath = path || "/";

    // Đóng chat panel trước khi navigate
    window.dispatchEvent(new Event("close-ai-chat"));

    if (location.pathname === targetPath) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        el?.scrollIntoView({ behavior: "smooth" });
      }, 350);
    } else {
      setTimeout(() => {
        navigate(targetPath);
        setTimeout(() => {
          const el = document.getElementById(hash);
          el?.scrollIntoView({ behavior: "smooth" });
        }, 300);
      }, 350);
    }
  }, [navigate, location.pathname]);

  if (message.role === "tool") return null;
  if (!isUser && !message.content && !message.uiCards?.length) {
    if (!isThinking) return null;
    return (
      <div className="flex gap-2.5 thinking-bubble-enter">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-gradient-to-br from-emerald-500 to-cyan-600">
          <Bot size={14} className="text-white" />
        </div>
        <div className="flex items-center px-3 py-2.5 rounded-2xl rounded-tl-md bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/8">
          <ThinkingDots />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 group ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser ? "bg-gray-200 dark:bg-white/10" : "bg-gradient-to-br from-emerald-500 to-cyan-600"
      }`}>
        {isUser ? (
          <User size={14} className="text-gray-500 dark:text-gray-400" />
        ) : (
          <Bot size={14} className="text-white" />
        )}
      </div>

      <div className={`flex-1 min-w-0 space-y-2 ${isUser ? "flex flex-col items-end" : ""}`}>
        {/* Edit mode: inline textarea */}
        {isUser && isEditing ? (
          <div className="w-full max-w-[85%] animate-fade-in">
            <textarea
              ref={editRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={3}
              className="w-full bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-[15px] leading-relaxed px-4 py-3 rounded-2xl border-2 border-emerald-500/60 dark:border-emerald-400/50 outline-none resize-none placeholder-gray-400 transition-all shadow-sm focus:border-emerald-500 dark:focus:border-emerald-400"
              style={{ fieldSizing: "content", minHeight: "60px" }}
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={handleEditCancel}
                className="px-3 py-1.5 text-[13px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={!editText.trim()}
                className="px-4 py-1.5 text-[13px] font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shadow-sm"
              >
                Cập nhật
              </button>
            </div>
          </div>
        ) : (
          /* Normal display */
          (message.content || message.image) && (
          <div className={`text-[15px] leading-relaxed break-words ${
            isUser
              ? "bg-gradient-to-r from-emerald-600 to-cyan-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-md max-w-[85%] whitespace-pre-wrap shadow-md"
              : "text-gray-800 dark:text-gray-200"
          }`}>
            {isUser ? (
              <div className="flex flex-col gap-2">
                {message.image && (
                  <img src={message.image} alt="User upload" className="max-w-full max-h-[240px] w-auto object-contain rounded-lg border border-white/10" />
                )}
                {message.content && <span>{message.content}</span>}
              </div>
            ) : (
              <div className="markdown-body space-y-3 relative">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-gray-800 dark:text-gray-200">{children}</p>,
                  a: ({ href, children }) => {
                    if (href?.includes("#") && href?.startsWith("/")) {
                      return (
                        <button
                          onClick={() => handleHashClick(href)}
                          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 underline underline-offset-2 transition-colors cursor-pointer inline"
                        >
                          {children}
                        </button>
                      );
                    }
                    if (href?.startsWith("/")) {
                      return (
                        <a 
                          href={href}
                          onClick={(e) => {
                            e.preventDefault();
                            window.dispatchEvent(new Event("close-ai-chat"));
                            setTimeout(() => navigate(href), 350);
                          }}
                          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 underline underline-offset-2 transition-colors cursor-pointer"
                        >
                          {children}
                        </a>
                      );
                    }
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 underline underline-offset-2 transition-colors">
                        {children}
                      </a>
                    );
                  },
                  ul: ({ children }) => <ul className="list-disc list-outside ml-5 space-y-1 my-2 text-gray-800 dark:text-gray-200">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-outside ml-5 space-y-1 my-2 text-gray-800 dark:text-gray-200">{children}</ol>,
                  li: ({ children }) => <li className="pl-1 marker:text-emerald-500/70 text-gray-800 dark:text-gray-200">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-emerald-50/90">{children}</strong>,
                  h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-white">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 text-gray-900 dark:text-white">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1 text-gray-900 dark:text-white">{children}</h3>,
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                      <table className="w-full text-left text-sm whitespace-nowrap">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-gray-100 dark:bg-black/20 text-gray-900 dark:text-white">{children}</thead>,
                  tbody: ({ children }) => <tbody className="divide-y divide-gray-200 dark:divide-white/10">{children}</tbody>,
                  tr: ({ children }) => <tr className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">{children}</tr>,
                  th: ({ children }) => <th className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400 border-b border-gray-200 dark:border-white/10">{children}</th>,
                  td: ({ children }) => <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{children}</td>,
                }}
              >
                  {message.content}
                </ReactMarkdown>
                {message.isError && onRetry && (
                  <div className="mt-4 border-t border-gray-200 dark:border-white/10 pt-3">
                    <button 
                      onClick={onRetry} 
                      className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/30 hover:border-red-300 dark:hover:border-red-500/50 rounded-lg text-red-600 dark:text-red-300 transition-colors text-[13px] font-medium"
                    >
                      🔄 Gửi lại câu hỏi
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isUser && message.content && !isEditing && (
          <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={handleCopy}
              title={copied ? "Đã sao chép!" : "Sao chép câu hỏi"}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
            <button
              onClick={handleEditOpen}
              title="Chỉnh sửa câu hỏi"
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={handleRetry}
              title={hasRetried ? "Đã thử lại rồi" : "Gửi lại câu hỏi"}
              className={`p-1.5 rounded-md transition-colors ${
                hasRetried
                  ? "text-gray-300 dark:text-gray-600 cursor-default"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
              }`}
            >
              <RotateCcw size={13} />
            </button>
            {showRetryApology && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500 italic ml-1 animate-fade-in">
                Xin lỗi bạn nhé 😊 Hãy thử hỏi theo cách khác!
              </span>
            )}
          </div>
        )}

        {/* UI Cards */}
        {message.uiCards?.map((card, i) => {
          const CardComponent = CARD_COMPONENTS[card.cardType];
          if (!CardComponent) return null;
          return (
            <div key={i} className="chat-card-enter w-full" style={{ animationDelay: `${i * 100}ms` }}>
              <CardComponent data={card.data} />
            </div>
          );
        })}

        {/* Feedback buttons (chỉ cho assistant messages có nội dung) */}
        {!isUser && !isThinking && !message.isError && (message.content || message.uiCards?.length > 0) && (
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={() => {
                const val = feedbackState === "up" ? null : "up";
                setFeedbackState(val);
                onFeedback?.(message._id, val);
              }}
              className={`p-1 rounded-md transition-colors ${
                feedbackState === "up"
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-gray-400 hover:text-gray-300 hover:bg-white/5"
              }`}
              title="Phản hồi tốt"
            >
              <ThumbsUp size={12} />
            </button>
            <button
              onClick={() => {
                const val = feedbackState === "down" ? null : "down";
                setFeedbackState(val);
                onFeedback?.(message._id, val);
              }}
              className={`p-1 rounded-md transition-colors ${
                feedbackState === "down"
                  ? "text-red-400 bg-red-500/10"
                  : "text-gray-400 hover:text-gray-300 hover:bg-white/5"
              }`}
              title="Phản hồi chưa tốt"
            >
              <ThumbsDown size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatBubble;

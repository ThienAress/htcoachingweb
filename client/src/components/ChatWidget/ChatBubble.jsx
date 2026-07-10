import React, { memo, useCallback } from "react";
import { Bot, User } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import TdeeResultCard from "./cards/TdeeResultCard";
import ExerciseListCard from "./cards/ExerciseListCard";
import MealSuggestionCard from "./cards/MealSuggestionCard";
import TrainerInfoCard from "./cards/TrainerInfoCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CARD_COMPONENTS = {
  tdee: TdeeResultCard,
  exercise: ExerciseListCard,
  meal: MealSuggestionCard,
  trainer: TrainerInfoCard,
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

const ChatBubble = memo(function ChatBubble({ message, onRetry, isThinking }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isUser = message.role === "user";

  // Handle hash links: navigate to page then scroll to element
  const handleHashClick = useCallback((href) => {
    const [path, hash] = href.split("#");
    const targetPath = path || "/";

    if (location.pathname === targetPath) {
      // Already on the page → scroll directly
      const el = document.getElementById(hash);
      el?.scrollIntoView({ behavior: "smooth" });
    } else {
      // Navigate first, then scroll
      navigate(targetPath);
      setTimeout(() => {
        const el = document.getElementById(hash);
        el?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, [navigate, location.pathname]);

  if (message.role === "tool") return null;
  // Khi AI đang thinking (chưa có content, chưa có uiCards) → hiện thinking bubble
  if (!isUser && !message.content && !message.uiCards?.length) {
    if (!isThinking) return null;
    return (
      <div className="flex gap-2.5 thinking-bubble-enter">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-gradient-to-br from-emerald-500 to-cyan-600">
          <Bot size={14} className="text-white" />
        </div>
        <div className="flex items-center px-3 py-2.5 rounded-2xl rounded-tl-md bg-white/5 border border-white/8">
          <ThinkingDots />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser ? "bg-white/10" : "bg-gradient-to-br from-emerald-500 to-cyan-600"
      }`}>
        {isUser ? (
          <User size={14} className="text-gray-400" />
        ) : (
          <Bot size={14} className="text-white" />
        )}
      </div>

      <div className={`flex-1 min-w-0 space-y-2 ${isUser ? "flex flex-col items-end" : ""}`}>
        {/* Text / Image */}
        {(message.content || message.image) && (
          <div className={`text-[14px] leading-relaxed break-words ${
            isUser
              ? "bg-gradient-to-r from-emerald-600 to-cyan-600 text-white px-3.5 py-2.5 rounded-2xl rounded-tr-md max-w-[85%] whitespace-pre-wrap shadow-md"
              : "text-gray-200"
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
                  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                  a: ({ href, children }) => {
                    if (href?.includes("#") && href?.startsWith("/")) {
                      return (
                        <button
                          onClick={() => handleHashClick(href)}
                          className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors cursor-pointer inline"
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
                            // Đợi hẳn 350ms để CSS animation trượt đóng hoàn tất 100% rồi mới bắt đầu chuyển trang
                            setTimeout(() => navigate(href), 350);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors cursor-pointer"
                        >
                          {children}
                        </a>
                      );
                    }
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">
                        {children}
                      </a>
                    );
                  },
                  ul: ({ children }) => <ul className="list-disc list-outside ml-5 space-y-1 my-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-outside ml-5 space-y-1 my-2">{children}</ol>,
                  li: ({ children }) => <li className="pl-1 marker:text-emerald-500/70">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-emerald-50/90">{children}</strong>,
                  h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-white">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 text-white">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1 text-white">{children}</h3>,
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4 rounded-xl border border-white/10 bg-white/5">
                      <table className="w-full text-left text-sm whitespace-nowrap">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-black/20">{children}</thead>,
                  tbody: ({ children }) => <tbody className="divide-y divide-white/10">{children}</tbody>,
                  tr: ({ children }) => <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>,
                  th: ({ children }) => <th className="px-4 py-3 font-semibold text-emerald-400 border-b border-white/10">{children}</th>,
                  td: ({ children }) => <td className="px-4 py-3 text-gray-300">{children}</td>,
                }}
              >
                  {message.content}
                </ReactMarkdown>
                {message.isError && onRetry && (
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <button 
                      onClick={onRetry} 
                      className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-lg text-red-300 transition-colors text-[13px] font-medium"
                    >
                      🔄 Gửi lại câu hỏi
                    </button>
                  </div>
                )}
              </div>
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
      </div>
    </div>
  );
});

export default ChatBubble;

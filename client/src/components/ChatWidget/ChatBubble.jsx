import { useCallback } from "react";
import { Bot, User } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import TdeeResultCard from "./cards/TdeeResultCard";
import ExerciseListCard from "./cards/ExerciseListCard";
import MealSuggestionCard from "./cards/MealSuggestionCard";
import TrainerInfoCard from "./cards/TrainerInfoCard";

const CARD_COMPONENTS = {
  tdee: TdeeResultCard,
  exercise: ExerciseListCard,
  meal: MealSuggestionCard,
  trainer: TrainerInfoCard,
};

/**
 * Render markdown links [text](/path) thành React Router <Link>
 * Giữ nguyên text thường, chỉ convert links
 * Hash links (/#section) → navigate + scroll to element
 */
function renderContent(text, onHashClick) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);

  return parts.map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (match) {
      const [, label, href] = match;

      // Hash link (e.g. /#pricing, /#contact) → navigate to / then scroll
      if (href.includes("#") && href.startsWith("/")) {
        return (
          <button
            key={i}
            onClick={() => onHashClick?.(href)}
            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors cursor-pointer"
          >
            {label}
          </button>
        );
      }

      // Internal link → React Router
      if (href.startsWith("/")) {
        return (
          <Link key={i} to={href} className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">
            {label}
          </Link>
        );
      }
      // External link
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">
          {label}
        </a>
      );
    }
    return part;
  });
}

export default function ChatBubble({ message }) {
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
  if (!isUser && !message.content && !message.uiCards?.length) return null;

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
        {/* Text */}
        {message.content && (
          <div className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-gradient-to-r from-emerald-600 to-cyan-600 text-white px-3.5 py-2 rounded-2xl rounded-tr-md max-w-[85%]"
              : "text-gray-200"
          }`}>
            {isUser ? message.content : renderContent(message.content, handleHashClick)}
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
}

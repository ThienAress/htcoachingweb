import { useNavigate } from "react-router-dom";
import { Plus, Settings, Trash2, MessageSquare, Clock, PanelLeftClose } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const ROLE_LABEL = {
  admin: { text: "Quản trị viên", color: "text-purple-600 dark:text-purple-400" },
  trainer: { text: "Huấn luyện viên", color: "text-emerald-600 dark:text-emerald-400" },
  user: { text: "Khách hàng", color: "text-cyan-600 dark:text-cyan-400" },
};

function formatRelativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

export default function ChatPanelSidebar({
  conversations,
  activeId,
  onNew,
  onSwitch,
  onDelete,
  onToggle,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roleInfo = ROLE_LABEL[user?.role] ?? ROLE_LABEL.user;

  return (
    <div className="flex flex-col h-full w-full md:w-[260px] md:min-w-[260px] shrink-0 border-r border-gray-200 dark:border-white/8 bg-gray-50 dark:bg-[#0f1117] md:bg-transparent md:dark:bg-black/20">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-sm">
            <MessageSquare size={14} className="text-white" />
          </div>
          <span className="text-[15px] font-bold text-gray-900 dark:text-white tracking-wide">HT Assistant</span>
        </div>
        <button
          onClick={onToggle}
          title="Đóng sidebar"
          className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/8 transition-colors"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* New conversation */}
      <div className="px-4 pb-4 shrink-0">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/8 transition-colors border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 shadow-sm"
        >
          <Plus size={16} />
          Cuộc trò chuyện mới
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 min-h-0">
        {conversations.length > 0 && (
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
            <Clock size={12} /> Gần đây
          </p>
        )}
        <div className="flex flex-col gap-1">
          {conversations.map((conv) => (
            <div
              key={conv._id}
              className={`group relative flex items-center rounded-xl cursor-pointer transition-colors px-3 py-2.5 ${
                conv._id === activeId
                  ? "bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/6"
              }`}
              onClick={() => onSwitch(conv._id)}
            >
              <div className="flex-1 min-w-0 pr-6">
                <p className="text-[13px] font-medium truncate leading-tight">
                  {conv.title || "Cuộc trò chuyện"}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate mt-1">
                  {formatRelativeTime(conv.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv._id); }}
                className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all shrink-0"
                title="Xóa cuộc trò chuyện"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-[12px] text-gray-500 px-3 py-3 text-center">Chưa có cuộc trò chuyện nào</p>
          )}
        </div>
      </div>

      {/* User info */}
      <div className="shrink-0 border-t border-gray-200 dark:border-white/8 px-4 py-4">
        <div className="flex items-center gap-3">
          {user?.avatar ? (
            <img src={user.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover shrink-0 shadow-sm" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-cyan-700 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-xs font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
              {user?.name || "Người dùng"}
            </p>
            <p className={`text-[11px] font-medium truncate ${roleInfo.color}`}>{roleInfo.text}</p>
          </div>
          <button
            onClick={() => {
              window.dispatchEvent(new Event("close-ai-chat"));
              setTimeout(() => navigate("/account"), 300);
            }}
            title="Cài đặt tài khoản"
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/8 transition-colors shrink-0"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ChatPanelSidebar.jsx — Sidebar navigation của ChatPanel
import { useNavigate } from "react-router-dom";
import { Plus, Settings, Trash2, MessageSquare, Clock, PanelLeftClose } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const ROLE_LABEL = {
  admin: { text: "Quản trị viên", color: "text-purple-400" },
  trainer: { text: "Huấn luyện viên", color: "text-emerald-400" },
  user: { text: "Khách hàng", color: "text-cyan-400" },
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
    <div className="flex flex-col h-full w-full md:w-[210px] md:min-w-[210px] shrink-0 border-r border-white/8 bg-[#0f1117] md:bg-black/20">
      {/* Logo */}
      <div className="px-3 pt-4 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
            <MessageSquare size={12} className="text-white" />
          </div>
          <span className="text-sm font-bold text-white tracking-wide">HT Assistant</span>
        </div>
        <button
          onClick={onToggle}
          title="Đóng sidebar"
          className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/8 transition-colors"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* New conversation */}
      <div className="px-3 pb-3 shrink-0">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/8 transition-colors border border-white/10 hover:border-white/20"
        >
          <Plus size={14} />
          Cuộc trò chuyện mới
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 min-h-0">
        {conversations.length > 0 && (
          <p className="text-[10px] text-gray-500 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
            <Clock size={10} /> Gần đây
          </p>
        )}
        <div className="flex flex-col gap-0.5">
          {conversations.map((conv) => (
            <div
              key={conv._id}
              className={`group relative flex items-center rounded-lg cursor-pointer transition-colors px-2 py-1.5 ${
                conv._id === activeId
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/6"
              }`}
              onClick={() => onSwitch(conv._id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate leading-tight">
                  {conv.title || "Cuộc trò chuyện"}
                </p>
                <p className="text-[10px] text-gray-500 truncate mt-0.5">
                  {formatRelativeTime(conv.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv._id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-500 hover:text-red-400 transition-all shrink-0"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-[11px] text-gray-600 px-2 py-2">Chưa có cuộc trò chuyện nào</p>
          )}
        </div>
      </div>

      {/* User info */}
      <div className="shrink-0 border-t border-white/8 px-3 py-3">
        <div className="flex items-center gap-2">
          {user?.avatar ? (
            <img src={user.avatar} alt="avatar" className="w-7 h-7 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-600 to-cyan-700 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white truncate">
              {user?.name || "Người dùng"}
            </p>
            <p className={`text-[10px] truncate ${roleInfo.color}`}>{roleInfo.text}</p>
          </div>
          <button
            onClick={() => navigate("/account")}
            title="Cài đặt tài khoản"
            className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/8 transition-colors shrink-0"
          >
            <Settings size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

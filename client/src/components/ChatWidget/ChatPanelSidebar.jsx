import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Brain,
  LoaderCircle,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
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
  pendingConversationIds = [],
  onNew,
  onSwitch,
  onDelete,
  onToggle,
  onOpenMemory,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const roleInfo = ROLE_LABEL[user?.role] ?? ROLE_LABEL.user;
  const pendingIds = new Set(pendingConversationIds.map(String));

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
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {conversations.length > 0 && (
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
            <Clock size={12} /> Gần đây
          </p>
        )}
        <div className="flex flex-col gap-1">
          {conversations.map((conv) => {
            const title = conv.title || "Cuộc trò chuyện";
            const isPending = pendingIds.has(String(conv._id));
            return (
              <div
                key={conv._id}
                className={`group relative flex items-center rounded-xl cursor-pointer transition-colors px-3 py-2.5 ${
                  conv._id === activeId
                    ? "bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/6"
                }`}
                onClick={() => onSwitch(conv._id)}
              >
                <div className="flex-1 min-w-0 pr-12">
                  <p className="text-[13px] font-medium truncate leading-tight">
                    {title}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate mt-1">
                    {formatRelativeTime(conv.updatedAt)}
                  </p>
                </div>
                <div className="absolute right-2 top-1.5 flex items-center gap-0.5">
                  {isPending && (
                    <span
                      role="status"
                      aria-label={`${title} đang nhận phản hồi`}
                      title="Đang nhận phản hồi"
                      className="inline-flex size-7 items-center justify-center text-emerald-600 dark:text-cyan-300"
                    >
                      <LoaderCircle
                        size={15}
                        className="animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteConfirmId(conv._id);
                    }}
                    className="p-1.5 rounded-md text-gray-400 opacity-0 transition-[color,background-color,opacity] hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 group-focus-within:opacity-100 dark:hover:bg-red-500/10"
                    aria-label={`Xóa ${title}`}
                    title="Xóa cuộc trò chuyện"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
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
            type="button"
            onClick={onOpenMemory}
            title="Trí nhớ AI"
            aria-label="Mở cài đặt Trí nhớ AI"
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/8 transition-colors shrink-0"
          >
            <Brain size={16} />
          </button>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16181d] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl w-full max-w-[320px] p-5 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-2">
              Xóa cuộc trò chuyện?
            </h3>
            <p className="text-[13px] text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
              Bạn có chắc chắn muốn xóa cuộc trò chuyện này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  onDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-red-500 hover:bg-red-600 shadow-sm transition-colors"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

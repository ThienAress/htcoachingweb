import { Home, SidebarClose } from "lucide-react";
import { Link } from "react-router-dom";
import { FOCUS_RING, workspaceItemClass } from "./workspaceSidebarClasses";

// Logo HT cam + tên + dòng phụ theo khu ("Khu HLV", "Quản trị", "Khách hàng F1"); nút thu gọn nằm bên phải.
export const WorkspaceBrand = ({ subtitle, onToggle, toggleLabel, ToggleIcon = SidebarClose }) => (
  <div className="flex items-center justify-between gap-3 border-b border-[#34475f] p-4">
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-black text-[#ffffff]"
      >
        HT
      </span>
      <div className="min-w-0">
        <p className="text-base font-bold leading-tight tracking-tight text-[#ffffff]">HTCOACHING</p>
        <p className="truncate text-xs text-[#94a3b8]">{subtitle}</p>
      </div>
    </div>
    {onToggle && (
      <button
        type="button"
        onClick={onToggle}
        aria-label={toggleLabel}
        title={toggleLabel}
        className={`hidden size-11 shrink-0 items-center justify-center rounded-lg text-[#94a3b8] transition-colors hover:bg-[#ffffff1a] hover:text-[#ffffff] md:inline-flex ${FOCUS_RING}`}
      >
        <ToggleIcon className="size-5" aria-hidden="true" />
      </button>
    )}
  </div>
);

export const WorkspaceHomeLink = ({ onClick }) => (
  <div className="border-t border-[#34475f] p-4">
    <Link to="/" onClick={onClick} className={workspaceItemClass(false)}>
      <Home className="size-5" aria-hidden="true" />
      <span>Trang chủ</span>
    </Link>
  </div>
);

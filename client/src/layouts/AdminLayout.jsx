import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import {
  Package,
  FileText,
  Sparkles,
  Home,
  Users,
  Users2,
  Menu,
  MessageSquare,
  Apple,
  ClipboardList,
  Dumbbell,
  MessageSquareText,
  BookOpenText,
  BookOpen,
  X,
  Wallet,
  ChevronDown,
  BrainCircuit,
  Brain,
  LayoutTemplate,
  Utensils,
  ChartNoAxesCombined,
  ShieldCheck,
  SidebarClose,
  SidebarOpen,
  RadioTower,
} from "lucide-react";

const SidebarContent = ({
  onItemClick,
  onSidebarToggle,
  sidebarToggleLabel,
  SidebarToggleIcon = SidebarClose,
}) => {
  const location = useLocation();

  const navGroups = [
    {
      key: "manage",
      label: "Quản lý",
      items: [
        { path: "/admin/users", label: "Người dùng", icon: Users },
        { path: "/admin/trainer-subscribers", label: "Huấn luyện viên", icon: Sparkles },
        { path: "/admin/orders", label: "Đơn hàng", icon: Package },
        { path: "/admin/contracts", label: "Hợp đồng HLV", icon: FileText },
        { path: "/admin/bookings", label: "Đặt lịch", icon: ClipboardList },
        { path: "/admin/deposits", label: "Nạp tiền", icon: Wallet },
        { path: "/admin/f1-ai-rules", label: "Quy tắc AI", icon: BrainCircuit },
        { path: "/admin/knowledge-base", label: "Kiến thức AI", icon: Brain },
        { path: "/admin/contact-messages", label: "Liên hệ", icon: MessageSquare },
      ],
    },
    {
      key: "data",
      label: "Kho dữ liệu",
      items: [
        { path: "/admin/exercises", label: "Bài tập", icon: Dumbbell },
        { path: "/admin/foods", label: "Thực phẩm", icon: Apple },
        { path: "/admin/gyms", label: "Phòng tập (CLB)", icon: Home },
      ],
    },
    {
      key: "content",
      label: "Nội dung",
      items: [
        { path: "/admin/trainers", label: "Đội ngũ HLV", icon: Users2 },
        { path: "/admin/recipes", label: "Công thức nấu ăn", icon: Utensils },
        { path: "/admin/customer-stories", label: "Câu chuyện khách hàng", icon: BookOpenText },
        { path: "/admin/blog", label: "Blog", icon: BookOpen },
        { path: "/admin/exercise-suggestions", label: "Góp ý bài tập", icon: MessageSquareText },
      ],
    },
    {
      key: "interface",
      label: "Giao diện",
      items: [
        { path: "/admin/site-settings", label: "Trang chủ", icon: LayoutTemplate },
      ],
    },
    {
      key: "activity",
      label: "Hoạt động",
      items: [
        { path: "/admin/dashboard", label: "Lịch sử Check-in", icon: FileText },
        { path: "/admin/seo-analytics", label: "SEO & Chuyển đổi", icon: ChartNoAxesCombined },
        { path: "/admin/service-access-policies", label: "Quyền & hạn mức", icon: ShieldCheck },
        { path: "/admin/skill-radar", label: "Radar công nghệ", icon: RadioTower },
      ],
    },
  ];

  // Auto-expand group containing active page
  const getInitialOpen = () => {
    const open = {};
    navGroups.forEach((group) => {
      const hasActive = group.items.some((item) => location.pathname === item.path);
      open[group.key] = hasActive;
    });
    // If no group is active, open the first group
    if (!Object.values(open).some(Boolean)) open["manage"] = true;
    return open;
  };

  const [openGroups, setOpenGroups] = useState(getInitialOpen);

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Branding */}
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold tracking-tight leading-tight">
            HTCOACHING
          </h3>
          <p className="text-xs text-white/60">Admin Panel</p>
        </div>
        {onSidebarToggle && (
          <button
            type="button"
            onClick={onSidebarToggle}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label={sidebarToggleLabel}
            title={sidebarToggleLabel}
          >
            <SidebarToggleIcon className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {navGroups.map((group) => {
          const isOpen = !!openGroups[group.key];
          return (
            <div key={group.key}>
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isOpen}
                aria-controls={`admin-nav-${group.key}`}
                className="flex min-h-11 w-full cursor-pointer items-center justify-between px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white/50 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                id={`admin-nav-${group.key}`}
                className={`overflow-hidden transition-all duration-200 ${
                  isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <ul className="space-y-1 pb-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          onClick={onItemClick}
                          className={`flex min-h-11 items-center gap-3 rounded-lg px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 ${
                            isActive
                              ? "bg-white/20 text-white font-medium"
                              : "text-white/80 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nút về trang chủ */}
      <div className="mt-auto pt-4 border-t border-white/10">
        <Link
          to="/"
          onClick={onItemClick}
          className="flex min-h-11 items-center gap-3 rounded-lg px-4 py-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
        >
          <Home className="w-5 h-5" />
          <span>Trang chủ</span>
        </Link>
      </div>
    </div>
  );
};

const AdminLayout = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setIsSidebarOpen(false);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Desktop layout
  if (!isMobile) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        {/* Sidebar cố định với màu #1C2D42 */}
        <aside
          id="admin-desktop-sidebar"
          aria-hidden={isDesktopCollapsed}
          inert={isDesktopCollapsed}
          className={`shrink-0 overflow-hidden bg-[#1C2D42] shadow-lg transition-[width] duration-200 ease-out ${
            isDesktopCollapsed ? "w-0" : "w-64"
          }`}
        >
          <div className="flex h-full w-64 flex-col p-4">
            <SidebarContent
              onSidebarToggle={() => setIsDesktopCollapsed(true)}
              sidebarToggleLabel="Thu sidebar Admin"
            />
          </div>
        </aside>

        {isDesktopCollapsed && (
          <button
            type="button"
            onClick={() => setIsDesktopCollapsed(false)}
            className="fixed left-4 top-4 z-30 hidden size-11 items-center justify-center rounded-lg bg-[#1C2D42] text-white/80 shadow-md transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 md:inline-flex"
            aria-label="Mở sidebar Admin"
            aria-controls="admin-desktop-sidebar"
            aria-expanded="false"
            title="Mở sidebar Admin"
          >
            <SidebarOpen className="size-5" aria-hidden="true" />
          </button>
        )}

        {/* Nội dung chính */}
        <div className="flex min-w-0 flex-1 flex-col p-6">
          <div className="flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    );
  }

  // Mobile/Tablet layout
  return (
    <div className="min-h-screen bg-slate-100 relative">
      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className="fixed left-4 top-4 z-30 inline-flex size-11 items-center justify-center rounded-md bg-white text-slate-700 shadow-md transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 md:hidden"
        aria-label="Mở menu"
        aria-controls="admin-mobile-sidebar"
        aria-expanded={isSidebarOpen}
      >
        <Menu className="w-5 h-5" />
      </button>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        id="admin-mobile-sidebar"
        aria-hidden={!isSidebarOpen}
        inert={!isSidebarOpen}
        className={`fixed top-0 left-0 h-full w-64 bg-[#1C2D42] shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col p-4">
          <SidebarContent
            onItemClick={() => setIsSidebarOpen(false)}
            onSidebarToggle={() => setIsSidebarOpen(false)}
            sidebarToggleLabel="Đóng menu Admin"
            SidebarToggleIcon={X}
          />
        </div>
      </aside>

      {/* Nội dung chính */}
      <div className="flex flex-col p-6 pt-16 min-h-screen">
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default AdminLayout;

import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Package,
  FileText,
  Sparkles,
  Home,
  Users,
  Menu,
  MessageSquare,
  Apple,
  ClipboardList,
  Dumbbell,
  MessageSquareText,
  X,
} from "lucide-react";

const SidebarContent = ({ onItemClick }) => {
  const location = useLocation();

  const navItems = [
    { path: "/admin/users", label: "Quản lý người dùng", icon: Users },
    { path: "/admin/orders", label: "Quản lý đơn hàng", icon: Package },
    { path: "/admin/trainers", label: "Quản lý Trainer", icon: Users },
    { path: "/admin/bookings", label: "Quản lý đặt hàng", icon: ClipboardList },
    {
      path: "/admin/contact-messages",
      label: "Quản lý liên hệ",
      icon: MessageSquare,
    },
    { path: "/admin/foods", label: "Quản lý thực phẩm", icon: Apple },
    { path: "/admin/exercises", label: "Quản lý bài tập", icon: Dumbbell },
    {
      path: "/admin/exercise-suggestions",
      label: "Góp ý bài tập",
      icon: MessageSquareText,
    },
    { path: "/admin/dashboard", label: "Lịch sử Check-in", icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full text-white">
      {/* Branding - giống F1Customers */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight leading-tight">
            HTCOACHING
          </h3>
          <p className="text-xs text-white/60">Admin Panel</p>
        </div>
      </div>

      {/* Navigation */}
      <ul className="space-y-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={onItemClick}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
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

      {/* Nút về trang chủ */}
      <div className="mt-auto pt-4 border-t border-white/10">
        <Link
          to="/"
          onClick={onItemClick}
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Home className="w-5 h-5" />
          <span>Trang chủ</span>
        </Link>
      </div>
    </div>
  );
};

const AdminLayout = () => {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setIsSidebarOpen(false);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
  }, [location, isMobile]);

  // Desktop layout
  if (!isMobile) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        {/* Sidebar cố định với màu #1C2D42 */}
        <div className="w-64 bg-[#1C2D42] shadow-lg p-4 flex flex-col">
          <SidebarContent />
        </div>

        {/* Nội dung chính */}
        <div className="flex-1 flex flex-col p-6">
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
        onClick={() => setIsSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 p-2 rounded-md bg-white shadow-md text-slate-700 hover:bg-slate-50 transition-colors md:hidden"
        aria-label="Mở menu"
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
        className={`fixed top-0 left-0 h-full w-64 bg-[#1C2D42] shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative h-full p-4 flex flex-col">
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-4 right-4 p-1 rounded-md text-white/60 hover:bg-white/10 transition-colors"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
          <SidebarContent onItemClick={() => setIsSidebarOpen(false)} />
        </div>
      </aside>

      {/* Nội dung chính */}
      <div className="flex flex-col p-6 pt-16 min-h-screen">
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;

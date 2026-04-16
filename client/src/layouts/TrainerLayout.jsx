import { useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, History, Sparkles, Menu, X, Users } from "lucide-react";

const TrainerLayout = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        isSidebarOpen
      ) {
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSidebarOpen]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    if (isSidebarOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

  const navItems = [
    { path: "/trainer", label: "Khách của tôi", icon: Users },
    {
      path: "/trainer/checkin-history",
      label: "Lịch sử check-in",
      icon: History,
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-100">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`
          fixed md:sticky top-0 left-0 w-64 bg-[#1C2D42] shadow-lg z-40
          transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          min-h-screen overflow-y-auto
        `}
      >
        <div className="relative h-full flex flex-col text-white">
          {/* Nút đóng trên mobile */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-4 right-4 p-1 rounded-md text-white/60 hover:bg-white/10 transition-colors md:hidden"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Branding */}
          <div className="flex items-center gap-2 p-4 border-b border-white/10">
            <div>
              <h3 className="text-lg font-bold tracking-tight leading-tight">
                HTCOACHING
              </h3>
              <p className="text-xs text-white/60">Trainer Panel</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-2 rounded-lg transition-colors
                        ${
                          isActive
                            ? "bg-white/20 text-white font-medium"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Nút về trang chủ */}
          <div className="p-4 border-t border-white/10">
            <Link
              to="/"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Home className="w-5 h-5" />
              <span>Trang chủ</span>
            </Link>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {/* Sticky top bar trên mobile (giữ nguyên logic, chỉ đổi màu) */}
        <div className="md:hidden sticky top-0 z-20 bg-[#1C2D42] border-b border-white/10 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-white/10 rounded-lg text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center font-semibold text-white">
            HTCOACHING Trainer
          </div>
        </div>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default TrainerLayout;

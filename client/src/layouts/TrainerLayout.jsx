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
          fixed md:sticky top-0 left-0 w-64 bg-white shadow-lg border-r border-slate-200 z-40
          transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          min-h-screen overflow-y-auto
        `}
      >
        <div className="relative h-full flex flex-col">
          <div className="flex items-center gap-2 p-4 border-b border-slate-100">
            <div className="w-8 h-8 bg-linear-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">
                HTCOACHING
              </h2>
              <p className="text-xs text-slate-400">Trainer Panel</p>
            </div>
          </div>
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`
                        flex items-center gap-3 px-4 py-2 rounded-lg transition-colors
                        ${
                          isActive
                            ? "bg-indigo-50 text-indigo-700 font-medium"
                            : "text-slate-600 hover:bg-slate-100"
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
          <div className="p-4 border-t border-slate-100">
            <Link
              to="/"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Home className="w-5 h-5" />
              <span>Trang chủ</span>
            </Link>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="md:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1 text-center font-semibold text-slate-800">
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

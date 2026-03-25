import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, History, Sparkles } from "lucide-react";

const TrainerLayout = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <div className="relative w-64 bg-white shadow-lg p-4 border-r border-slate-200">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 leading-tight">
              HTCOACHING
            </h2>
            <p className="text-xs text-slate-400">Trainer Panel</p>
          </div>
        </div>

        <ul className="space-y-2">
          <li>
            <Link
              to="/trainer"
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                location.pathname === "/trainer"
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <History className="w-5 h-5" />
              <span>Khách của tôi</span>
            </Link>
          </li>
        </ul>

        {/* Nút về trang chủ */}
        <div className="absolute bottom-4 left-4 right-4">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>Trang chủ</span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
};

export default TrainerLayout;

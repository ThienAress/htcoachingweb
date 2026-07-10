import { Link, useLocation } from "react-router-dom";
import { Home, ArrowLeft, Search } from "lucide-react";
import SEO from "../components/SEO";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <SEO title="404 - Không tìm thấy trang" noindex />

      <div className="max-w-lg w-full text-center">
        {/* 404 Number */}
        <div className="relative mb-6">
          <p className="text-[120px] sm:text-[160px] font-black leading-none tracking-tight select-none"
            style={{
              background: "linear-gradient(135deg, #10b981, #06b6d4, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              opacity: 0.15,
            }}
          >
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
                <Search size={28} className="text-emerald-400" />
              </div>
              <p className="text-white text-lg font-bold">Không tìm thấy trang</p>
            </div>
          </div>
        </div>

        {/* Message */}
        <p className="text-gray-400 text-sm mb-2">
          Trang <code className="text-emerald-400/80 bg-white/5 px-1.5 py-0.5 rounded text-xs">{location.pathname}</code> không tồn tại.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Có thể trang đã bị xóa, đổi tên hoặc bạn nhập sai địa chỉ.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-sm font-semibold hover:from-emerald-500 hover:to-cyan-500 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
          >
            <Home size={16} />
            Về trang chủ
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
            Quay lại
          </button>
        </div>

        {/* Footer hint */}
        <p className="mt-10 text-gray-600 text-xs">
          HTCOACHING © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default NotFound;

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
              background: "linear-gradient(135deg, #ff5500, #ff7b2c)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              opacity: 0.15,
            }}
          >
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary-light/20 border border-white/10 flex items-center justify-center">
                <Search size={28} className="text-primary" />
              </div>
              <p className="font-display text-white text-xl font-bold uppercase tracking-wide">Không tìm thấy trang</p>
            </div>
          </div>
        </div>

        {/* Message */}
        <p className="text-gray-400 text-sm mb-2">
          Trang <code className="text-primary-light bg-white/5 px-1.5 py-0.5 rounded text-xs">{location.pathname}</code> không tồn tại.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Có thể trang đã bị xóa, đổi tên hoặc bạn nhập sai địa chỉ.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
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

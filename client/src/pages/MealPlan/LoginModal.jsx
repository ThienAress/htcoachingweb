import React from "react";
import { X } from "lucide-react";
import logo from "../../assets/images/logo/logo.svg";

const LoginModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleGoogleLogin = () => {
    // Lưu trang hiện tại để sau login quay lại
    localStorage.setItem("redirectAfterLogin", "/mealplan");
    const baseUrl = import.meta.env.DEV
      ? "http://localhost:5000"
      : "https://htcoachingweb.onrender.com";
    window.location.href = `${baseUrl}/api/auth/google`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md text-center z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* Logo */}
        <img src={logo} alt="HT Coaching" className="h-14 mx-auto mb-5" />

        {/* Tiêu đề */}
        <h2 className="text-3xl font-black mb-2 tracking-wider uppercase">
          <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent font-bebas-neue">
            ĐĂNG NHẬP
          </span>
        </h2>

        {/* Thông báo */}
        <p className="text-gray-300 text-sm font-medium mb-8 leading-relaxed">
          Vui lòng đăng nhập để xem gợi ý thực đơn và cá nhân hóa lộ trình dinh dưỡng của bạn.
        </p>

        {/* Nút đăng nhập Google */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 shadow-lg transform hover:scale-[1.02]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Đăng nhập bằng Google
        </button>
      </div>
    </div>
  );
};

export default LoginModal;

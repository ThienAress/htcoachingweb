import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Facebook, Instagram, Youtube, Send } from "lucide-react";
import logo from "../../assets/images/logo/logo.svg";
import { useAuth } from "../../context/AuthContext";
import LoginModal from "../../pages/MealPlan/LoginModal";

const Footer = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleMealPlanClick = (e) => {
    e.preventDefault();
    if (user) {
      navigate("/mealplan");
    } else {
      setShowLoginModal(true);
    }
  };

  return (
    <footer className="bg-[#1a1a1a] text-white pt-16 md:pt-20">
      <div className="container-custom">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 mb-12 md:mb-16">
          {/* About */}
          <div>
            <img
              src={logo}
              alt="Elite Fitness"
              className="h-20 md:h-24 mb-4 object-contain"
            />
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              HTCOACHING – Rèn luyện bản lĩnh, nâng tầm phong cách, nơi hình thể
              và tinh thần cùng toả sáng.
            </p>
            <div className="flex gap-3">
              <a
                href="https://www.facebook.com/thienvo123456"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={18} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={18} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                aria-label="Youtube"
              >
                <Youtube size={18} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                aria-label="TikTok"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 pb-2 relative after:absolute after:bottom-0 after:left-0 after:w-12 after:h-0.5 after:bg-primary">
              LIÊN KẾT NHANH
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li>
                <Link to="/" className="hover:text-primary hover:pl-1 transition-all">
                  Trang chủ
                </Link>
              </li>
              <li>
                <Link to="/ket-qua-khach-hang" className="hover:text-primary hover:pl-1 transition-all">
                  Kết quả khách hàng
                </Link>
              </li>
              <li>
                <Link to="/exercises" className="hover:text-primary hover:pl-1 transition-all">
                  Hệ thống bài tập
                </Link>
              </li>
              <li>
                <Link to="/tdee-calculator" className="hover:text-primary hover:pl-1 transition-all">
                  Tính TDEE
                </Link>
              </li>
              <li>
                <button onClick={handleMealPlanClick} className="hover:text-primary hover:pl-1 transition-all bg-transparent border-none text-gray-300 p-0 text-left font-inherit cursor-pointer inline-block">
                  Gợi ý thực đơn
                </button>
              </li>
              <li>
                <Link to="/club" className="hover:text-primary hover:pl-1 transition-all">
                  CLB
                </Link>
              </li>
            </ul>
          </div>

          {/* Training Programs */}
          <div>
            <h3 className="text-lg font-semibold mb-4 pb-2 relative after:absolute after:bottom-0 after:left-0 after:w-12 after:h-0.5 after:bg-primary">
              CHƯƠNG TRÌNH TẬP LUYỆN
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li>
                <a
                  href="#classes"
                  className="hover:text-primary hover:pl-1 transition-all"
                >
                  Personal Training
                </a>
              </li>
              <li>
                <a
                  href="#classes"
                  className="hover:text-primary hover:pl-1 transition-all"
                >
                  Cardio & HIIT
                </a>
              </li>
              <li>
                <a
                  href="#classes"
                  className="hover:text-primary hover:pl-1 transition-all"
                >
                  Boxing
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-lg font-semibold mb-4 pb-2 relative after:absolute after:bottom-0 after:left-0 after:w-12 after:h-0.5 after:bg-primary">
              ĐĂNG KÝ NHẬN TIN
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Nhận ưu đãi và thông tin mới nhất từ chúng tôi
            </p>
            <form className="flex">
              <input
                type="email"
                placeholder="Email của bạn"
                required
                className="flex-1 px-3 py-2 rounded-l-md bg-white/10 text-white border-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="px-4 bg-primary text-white rounded-r-md hover:bg-white hover:text-primary transition-colors"
                aria-label="Gửi"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-black/20 py-4 text-center">
        <p className="text-gray text-sm">&copy; 2026 HTCOACHING</p>
      </div>
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </footer>
  );
};

export default Footer;

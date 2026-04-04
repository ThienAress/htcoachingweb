import React from "react";
import { Facebook, Instagram, Youtube, Send } from "lucide-react";
import logo from "../../assets/images/logo/logo.svg";

const Footer = () => {
  return (
    <footer className="bg-[#1a1a1a] text-white pt-16 md:pt-20">
      <div className="container">
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
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-(--color-primary) transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={18} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-(--color-primary) transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={18} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-(--color-primary) transition-colors"
                aria-label="Youtube"
              >
                <Youtube size={18} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-(--color-primary) transition-colors"
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
            <h3 className="text-lg font-semibold mb-4 pb-2 relative after:absolute after:bottom-0 after:left-0 after:w-12 after:h-0.5 after:bg-(--color-primary)">
              Liên kết nhanh
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li>
                <a
                  href="#home"
                  className="hover:text-(--color-primary) hover:pl-1 transition-all"
                >
                  Trang chủ
                </a>
              </li>
              <li>
                <a
                  href="#about"
                  className="hover:text-(--color-primary) hover:pl-1 transition-all"
                >
                  Giới thiệu
                </a>
              </li>
              <li>
                <a
                  href="#trainers"
                  className="hover:text-(--color-primary) hover:pl-1 transition-all"
                >
                  Huấn luyện viên
                </a>
              </li>
              <li>
                <a
                  href="#customer"
                  className="hover:text-(--color-primary) hover:pl-1 transition-all"
                >
                  Feedback
                </a>
              </li>
              <li>
                <a
                  href="#classes"
                  className="hover:text-(--color-primary) hover:pl-1 transition-all"
                >
                  Chương trình đào tạo
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="hover:text-(--color-primary) hover:pl-1 transition-all"
                >
                  Gói tập
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  className="hover:text-(--color-primary) hover:pl-1 transition-all"
                >
                  Liên hệ
                </a>
              </li>
            </ul>
          </div>

          {/* Training Programs */}
          <div>
            <h3 className="text-lg font-semibold mb-4 pb-2 relative after:absolute after:bottom-0 after:left-0 after:w-12 after:h-0.5 after:bg-(--color-primary)">
              Chương trình đào tạo
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li>
                <a
                  href="#classes"
                  className="hover:text-(--color-primary) hover:pl-1 transition-all"
                >
                  Personal Training
                </a>
              </li>
              <li>
                <a
                  href="#classes"
                  className="hover:text-(--color-primary) hover:pl-1 transition-all"
                >
                  Cardio & HIIT
                </a>
              </li>
              <li>
                <a
                  href="#classes"
                  className="hover:text-(--color-primary) hover:pl-1 transition-all"
                >
                  Boxing
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-lg font-semibold mb-4 pb-2 relative after:absolute after:bottom-0 after:left-0 after:w-12 after:h-0.5 after:bg-(--color-primary)">
              Đăng ký nhận tin
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Nhận ưu đãi và thông tin mới nhất từ chúng tôi
            </p>
            <form className="flex">
              <input
                type="email"
                placeholder="Email của bạn"
                required
                className="flex-1 px-3 py-2 rounded-l-md bg-white/10 text-white border-none focus:outline-none focus:ring-1 focus:ring-(--color-primary)"
              />
              <button
                type="submit"
                className="px-4 bg-(--color-primary) text-white rounded-r-md hover:bg-white hover:text-(--color-primary) transition-colors"
                aria-label="Gửi"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-black/20 py-4 text-center">
        <div className="container">
          <p className="text-gray-400 text-sm">&copy; 2026 HTCOACHING</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Menu, X, LogOut, History, ChevronDown, UserCheck } from "lucide-react";
import logo from "../assets/images/logo/logo.svg";

import { getCurrentUser } from "../services/user.service.js";
import { jwtDecode } from "jwt-decode";

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef(null);

  const [user, setUser] = useState(null);

  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // click ngoài để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const decoded = jwtDecode(token);
        const data = await getCurrentUser();

        setUser({
          ...data,
          role: decoded.role,
        });
      } catch (err) {
        console.log("Chưa login");
      }
    };

    fetchUser();
  }, []);

  // Hiệu ứng đổi màu header khi scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Khóa scroll khi menu mở
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.reload();
  };

  // Dropdown items dựa trên role
  const dropdownItems =
    user?.role === "admin"
      ? [
          { label: "Checkin khách hàng", icon: UserCheck, path: "/checkin" },
          { label: "Đăng xuất", icon: LogOut, onClick: handleLogout },
        ]
      : [
          { label: "Lịch sử tập", icon: History, path: "/my-history" },
          { label: "Đăng xuất", icon: LogOut, onClick: handleLogout },
        ];

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 w-full z-50 h-[80px] md:h-[100px] transition-all duration-300 ${
        isScrolled
          ? "bg-gradient-to-r from-[#f39c12] to-[#1a1a1a]"
          : "bg-transparent"
      }`}
    >
      <div className="relative h-full flex items-center justify-between px-5 max-w-7xl mx-auto max-md:bg-gradient-to-r max-md:from-[#f39c12] max-md:to-[#1a1a1a]">
        {/* Logo bên trái */}
        <Link
          to="/"
          className="overflow-hidden z-20"
          onClick={() => setMenuOpen(false)}
        >
          <img
            src={logo}
            alt="HT Coaching"
            className="h-[50px] md:h-[60px] max-w-full object-contain block"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
          <ul className="flex gap-5 list-none m-0 p-0">
            <li>
              <a
                href="/"
                className="nav-link-hover text-white font-medium relative whitespace-nowrap"
              >
                Trang chủ
              </a>
            </li>
            <li>
              <a
                href="#about"
                className="nav-link-hover text-white font-medium relative whitespace-nowrap"
              >
                Giới thiệu
              </a>
            </li>
            <li>
              <a
                href="#trainers"
                className="nav-link-hover text-white font-medium relative whitespace-nowrap"
              >
                Huấn luyện viên
              </a>
            </li>
            <li>
              <a
                href="#customer"
                className="nav-link-hover text-white font-medium relative whitespace-nowrap"
              >
                Feedback
              </a>
            </li>
            <li>
              <a
                href="#classes"
                className="nav-link-hover text-white font-medium relative whitespace-nowrap"
              >
                Chương trình
              </a>
            </li>
            <li>
              <a
                href="#pricing"
                className="nav-link-hover text-white font-medium relative whitespace-nowrap"
              >
                Gói tập
              </a>
            </li>
            <li>
              <a
                href="#contact"
                className="nav-link-hover text-white font-medium relative whitespace-nowrap"
              >
                Liên hệ
              </a>
            </li>

            <li>
              <Link
                to="/club"
                className="nav-link-hover text-white font-medium relative whitespace-nowrap"
              >
                CLB
              </Link>
            </li>

            {user?.role === "admin" && (
              <li>
                <Link
                  to="/admin"
                  className="nav-link-hover text-white font-medium relative whitespace-nowrap"
                >
                  Quản trị
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* LOGIN / USER - Desktop Dropdown */}
        <div className="hidden md:block">
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpenDropdown(!openDropdown)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5 transition-colors"
              >
                <img
                  src={user.avatar || "https://i.pravatar.cc/32"}
                  className="w-8 h-8 rounded-full"
                  alt="avatar"
                />
                <span className="text-white text-sm font-medium">
                  {user.name}
                </span>
                <ChevronDown size={16} className="text-white" />
              </button>

              {openDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg overflow-hidden z-50 border border-gray-100">
                  {/* Header thông tin người dùng (không avatar) */}
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-800 truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {user.email || "user@example.com"}
                      </p>
                    </div>
                  </div>

                  {/* Danh sách mục */}
                  <div className="py-2">
                    {dropdownItems.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (item.onClick) {
                              item.onClick();
                            } else if (item.path) {
                              window.location.href = item.path;
                            }
                            setOpenDropdown(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Icon size={18} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-orange-500 text-white px-4 py-2 rounded"
            >
              Đăng nhập
            </Link>
          )}
        </div>

        {/* MOBILE BUTTON */}
        <div className="absolute right-5 md:hidden flex items-center gap-3 z-20">
          <button onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* MOBILE MENU */}
        <div
          className={`fixed inset-0 top-[80px] bg-gradient-to-b from-[#f39c12] to-[#1a1a1a] z-10 transform transition-transform duration-300 ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          } md:hidden overflow-y-auto`}
        >
          <div className="flex flex-col items-center justify-start min-h-full py-8 px-5">
            {/* Phần user trên mobile (có avatar) */}
            {user ? (
              <div className="w-full mb-8 bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
                <div className="p-5 flex flex-col items-center border-b border-white/20">
                  <img
                    src={user.avatar || "https://i.pravatar.cc/80"}
                    className="w-20 h-20 rounded-full border-2 border-white mb-3"
                    alt="avatar"
                  />
                  <span className="text-white text-lg font-semibold">
                    {user.name}
                  </span>
                  <span className="text-white/70 text-sm mt-1 text-center break-all">
                    {user.email || "user@example.com"}
                  </span>
                </div>
                <div className="py-2">
                  {dropdownItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (item.onClick) {
                            item.onClick();
                          } else if (item.path) {
                            window.location.href = item.path;
                          }
                          setMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-5 py-3 text-white hover:bg-white/10 transition-colors"
                      >
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="w-full mb-8">
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-3 rounded-full transition-colors"
                >
                  Đăng nhập
                </Link>
              </div>
            )}

            {/* Các link menu chính */}
            <ul className="w-full flex flex-col items-center gap-3">
              {[
                ["Trang chủ", "/"],
                ["Giới thiệu", "#about"],
                ["Huấn luyện viên", "#trainers"],
                ["Feedback", "#customer"],
                ["Chương trình đào tạo", "#classes"],
                ["Gói tập", "#pricing"],
                ["Liên hệ", "#contact"],
                ["CLB", "/club"],
                ...(user?.role === "admin" ? [["Quản trị", "/admin"]] : []),
              ].map(([label, href]) => (
                <li key={label} className="w-full">
                  {href.startsWith("#") ? (
                    <a
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className="block text-center text-white text-lg py-3 px-4 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      {label}
                    </a>
                  ) : (
                    <Link
                      to={href}
                      onClick={() => setMenuOpen(false)}
                      className={`block text-center text-lg py-3 px-4 rounded-lg hover:bg-white/10 transition-colors ${
                        label === "Quản trị"
                          ? "text-orange-300 font-semibold"
                          : "text-white"
                      }`}
                    >
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

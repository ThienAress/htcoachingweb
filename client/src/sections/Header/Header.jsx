import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  History,
  ChevronDown,
  UserCheck,
  Dumbbell,
} from "lucide-react";
import logo from "../../assets/images/logo/logo.svg";
import { useAuth } from "../../context/AuthContext";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef(null);
  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Hàm scroll đến section
  const handleScrollToSection = (sectionId) => {
    if (location.pathname !== "/") {
      // Chuyển về trang chủ và lưu lại section cần scroll
      navigate("/", { state: { scrollTo: sectionId } });
      return;
    }

    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // chiều cao header (có thể chỉnh lại nếu header cao hơn)
      const elementPosition =
        element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  // Khi quay về trang chủ với state scrollTo
  useEffect(() => {
    if (location.pathname === "/" && location.state?.scrollTo) {
      const sectionId = location.state.scrollTo;
      // Xóa state để không bị scroll lại khi refresh
      navigate("/", { replace: true, state: {} });
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          const offset = 80;
          const elementPosition =
            element.getBoundingClientRect().top + window.scrollY;
          const offsetPosition = elementPosition - offset;
          window.scrollTo({ top: offsetPosition, behavior: "smooth" });
        }
      }, 100);
    }
  }, [location, navigate]);

  // Click ngoài dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Đóng menu khi click ngoài
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
    return () => (document.body.style.overflow = "");
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const dropdownItems = ["admin", "trainer"].includes(user?.role)
    ? [
        { label: "Checkin khách hàng", icon: UserCheck, path: "/checkin" },
        { label: "Hệ thống bài tập", icon: Dumbbell, path: "/exercises" },
        { label: "Đăng xuất", icon: LogOut, onClick: handleLogout },
      ]
    : [
        { label: "Lịch sử tập", icon: History, path: "/my-history" },
        { label: "Hệ thống bài tập", icon: Dumbbell, path: "/exercises" },
        { label: "Đăng xuất", icon: LogOut, onClick: handleLogout },
      ];

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 w-full z-50 h-20 md:h-25 transition-all duration-300 ${
        isScrolled
          ? "bg-linear-to-r from-[#f39c12] to-[#1a1a1a]"
          : "bg-transparent"
      }`}
    >
      <div className="relative h-full flex items-center justify-between px-5 max-w-7xl mx-auto max-md:bg-linear-to-r max-md:from-[#f39c12] max-md:to-[#1a1a1a]">
        {/* Logo */}
        <Link
          to="/"
          onClick={() => setMenuOpen(false)}
          className="overflow-hidden z-20"
        >
          <img
            src={logo}
            alt="HT Coaching"
            className="h-12.5 md:h-15 max-w-full object-contain"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
          <ul className="flex gap-5 list-none m-0 p-0">
            <li>
              <Link
                to="/"
                className="nav-link-hover text-white font-medium relative whitespace-nowrap"
              >
                Trang chủ
              </Link>
            </li>
            <li>
              <button
                onClick={() => handleScrollToSection("about")}
                className="nav-link-hover text-white font-medium relative whitespace-nowrap bg-transparent border-none cursor-pointer"
              >
                Giới thiệu
              </button>
            </li>
            <li>
              <button
                onClick={() => handleScrollToSection("trainers")}
                className="nav-link-hover text-white font-medium relative whitespace-nowrap bg-transparent border-none cursor-pointer"
              >
                Huấn luyện viên
              </button>
            </li>
            <li>
              <button
                onClick={() => handleScrollToSection("customer")}
                className="nav-link-hover text-white font-medium relative whitespace-nowrap bg-transparent border-none cursor-pointer"
              >
                Feedback
              </button>
            </li>
            <li>
              <button
                onClick={() => handleScrollToSection("classes")}
                className="nav-link-hover text-white font-medium relative whitespace-nowrap bg-transparent border-none cursor-pointer"
              >
                Chương trình
              </button>
            </li>
            <li>
              <button
                onClick={() => handleScrollToSection("pricing")}
                className="nav-link-hover text-white font-medium relative whitespace-nowrap bg-transparent border-none cursor-pointer"
              >
                Gói tập
              </button>
            </li>
            <li>
              <button
                onClick={() => handleScrollToSection("contact")}
                className="nav-link-hover text-white font-medium relative whitespace-nowrap bg-transparent border-none cursor-pointer"
              >
                Liên hệ
              </button>
            </li>
            <li>
              <Link
                to="/club"
                className="nav-link-hover text-white font-medium relative whitespace-nowrap"
              >
                CLB
              </Link>
            </li>
            {["admin", "trainer"].includes(user?.role) && (
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
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5"
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
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="font-semibold text-gray-800 truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user.email || "user@example.com"}
                    </p>
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
                              navigate(item.path);
                            }
                            setOpenDropdown(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
          className={`fixed inset-0 top-20 bg-linear-to-b from-[#f39c12] to-[#1a1a1a] z-10 transform transition-transform duration-300 ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          } md:hidden overflow-y-auto`}
        >
          <div className="flex flex-col items-center justify-start min-h-full py-8 px-5">
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
                            navigate(item.path);
                          }
                          setMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-5 py-3 text-white hover:bg-white/10"
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
                  className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-3 rounded-full"
                >
                  Đăng nhập
                </Link>
              </div>
            )}
            <ul className="w-full flex flex-col items-center gap-3">
              <li className="w-full">
                <Link
                  to="/"
                  onClick={() => setMenuOpen(false)}
                  className="block text-center text-white text-lg py-3 px-4 rounded-lg hover:bg-white/10"
                >
                  Trang chủ
                </Link>
              </li>
              <li className="w-full">
                <button
                  onClick={() => {
                    handleScrollToSection("about");
                    setMenuOpen(false);
                  }}
                  className="block text-center text-white text-lg py-3 px-4 rounded-lg hover:bg-white/10 w-full"
                >
                  Giới thiệu
                </button>
              </li>
              <li className="w-full">
                <button
                  onClick={() => {
                    handleScrollToSection("trainers");
                    setMenuOpen(false);
                  }}
                  className="block text-center text-white text-lg py-3 px-4 rounded-lg hover:bg-white/10 w-full"
                >
                  Huấn luyện viên
                </button>
              </li>
              <li className="w-full">
                <button
                  onClick={() => {
                    handleScrollToSection("customer");
                    setMenuOpen(false);
                  }}
                  className="block text-center text-white text-lg py-3 px-4 rounded-lg hover:bg-white/10 w-full"
                >
                  Feedback
                </button>
              </li>
              <li className="w-full">
                <button
                  onClick={() => {
                    handleScrollToSection("classes");
                    setMenuOpen(false);
                  }}
                  className="block text-center text-white text-lg py-3 px-4 rounded-lg hover:bg-white/10 w-full"
                >
                  Chương trình đào tạo
                </button>
              </li>
              <li className="w-full">
                <button
                  onClick={() => {
                    handleScrollToSection("pricing");
                    setMenuOpen(false);
                  }}
                  className="block text-center text-white text-lg py-3 px-4 rounded-lg hover:bg-white/10 w-full"
                >
                  Gói tập
                </button>
              </li>
              <li className="w-full">
                <button
                  onClick={() => {
                    handleScrollToSection("contact");
                    setMenuOpen(false);
                  }}
                  className="block text-center text-white text-lg py-3 px-4 rounded-lg hover:bg-white/10 w-full"
                >
                  Liên hệ
                </button>
              </li>
              <li className="w-full">
                <Link
                  to="/club"
                  onClick={() => setMenuOpen(false)}
                  className="block text-center text-white text-lg py-3 px-4 rounded-lg hover:bg-white/10"
                >
                  CLB
                </Link>
              </li>
              {user?.role === "admin" && (
                <li className="w-full">
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="block text-center text-orange-300 font-semibold text-lg py-3 px-4 rounded-lg hover:bg-white/10"
                  >
                    Quản trị
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

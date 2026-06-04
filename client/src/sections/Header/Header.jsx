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
  Users,
  Wallet,
  CalendarDays,
  Sparkles,
  User,
  Utensils,
} from "lucide-react";
import logo from "../../assets/images/logo/logo.svg";
import { useAuth } from "../../context/AuthContext";
import { getMyWallet } from "../../services/wallet.service";
import { getMySubscription } from "../../services/trainerSubscription.service";
import { getMyCheckins } from "../../services/checkin.service";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const getAvatarUrl = (avatar) => {
    if (!avatar) return "https://i.pravatar.cc/32";
    if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
      return avatar;
    }
    const serverUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace("/api", "")
      : "http://localhost:5000";
    return `${serverUrl}${avatar}`;
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef(null);
  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [hasOrders, setHasOrders] = useState(false);
  const [hasOnlinePackage, setHasOnlinePackage] = useState(false);

  // Map tên gói -> icon
  const planIconMap = {
    "Tiêu chuẩn": "\uD83D\uDD25",
    "Chuyên nghiệp": "\uD83D\uDC8E",
    "Doanh nghiệp": "\uD83D\uDC51",
  };

  // Fetch số dư ví + gói dịch vụ + đơn hàng
  useEffect(() => {
    if (user) {
      getMyWallet()
        .then((res) => setWalletBalance(res.data.data.balance))
        .catch(() => setWalletBalance(null));
      getMySubscription()
        .then((res) => setActiveSubscription(res.data.data))
        .catch(() => setActiveSubscription(null));
      getMyCheckins()
        .then((res) => {
          const orders = res.data.data?.orders || [];
          setHasOrders(orders.length > 0);
          const isOnline = orders.some(
            (o) => o.package && o.package.toLowerCase().includes("online")
          );
          setHasOnlinePackage(isOnline);
        })
        .catch(() => {
          setHasOrders(false);
          setHasOnlinePackage(false);
        });
    } else {
      setWalletBalance(null);
      setActiveSubscription(null);
      setHasOrders(false);
      setHasOnlinePackage(false);
    }
  }, [user]);

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

  // Kiểm tra quyền: admin/trainer role HOẶC user có subscription
  const isAdmin = user?.role === "admin";
  const hasTrainerAccess = user?.role === "trainer" || activeSubscription;

  const dropdownItems = isAdmin
    ? [
      { label: "Ví của tôi", icon: Wallet, path: "/wallet" },
      { label: "Checkin khách hàng", icon: UserCheck, path: "/checkin" },
      { label: "Hệ thống khách F1", icon: Users, path: "/f1-customers" },
      { label: "Hệ thống bài tập", icon: Dumbbell, path: "/exercises" },
      { label: "Hệ thống Coach Online", icon: Sparkles, path: "/trainer/coaching" },
      { label: "Lịch tập khách hàng", icon: CalendarDays, path: "/training-schedule" },
      { label: "Tài khoản", icon: User, path: "/account" },
      { label: "Đăng xuất", icon: LogOut, onClick: handleLogout },
    ]
    : hasTrainerAccess
      ? [
        { label: "Ví của tôi", icon: Wallet, path: "/wallet" },
        { label: "Checkin khách hàng", icon: UserCheck, path: "/checkin" },
        { label: "Hệ thống khách F1", icon: Users, path: "/f1-customers" },
        { label: "Hệ thống bài tập", icon: Dumbbell, path: "/exercises" },
        { label: "Hệ thống Coach Online", icon: Sparkles, path: "/trainer/coaching" },
        { label: "Lịch tập khách hàng", icon: CalendarDays, path: "/training-schedule" },
        { label: "Tài khoản", icon: User, path: "/account" },
        { label: "Đăng xuất", icon: LogOut, onClick: handleLogout },
      ]
      : [
        { label: "Ví của tôi", icon: Wallet, path: "/wallet" },
        ...(hasOrders ? [
          { label: "Hệ thống bài tập", icon: Dumbbell, path: "/exercises" },
          { label: "Gợi ý meal plan", icon: Utensils, path: "/tdee-calculator" },
          { label: "Lịch sử checkin", icon: History, path: "/my-history" },
        ] : []),
        ...(hasOnlinePackage ? [
          { label: "Giáo án online", icon: Sparkles, path: "/online-coaching" }
        ] : []),
        { label: "Tài khoản", icon: User, path: "/account" },
        { label: "Đăng xuất", icon: LogOut, onClick: handleLogout },
      ];

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 w-full z-50 h-20 md:h-25 transition-all duration-300 ${isScrolled
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
        <nav className="hidden md:flex flex-1 justify-center ml-4" aria-label="Menu chính">
          <ul className="flex gap-3 list-none m-0 p-0">
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
                {["admin", "trainer"].includes(user?.role) ? "Gói dịch vụ" : "Gói tập"}
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
            {isAdmin && (
              <li>
                <Link
                  to="/admin"
                  className="nav-link-hover text-white font-medium relative whitespace-nowrap"
                >
                  Quản trị
                </Link>
              </li>
            )}
            {!isAdmin && hasTrainerAccess && (
              <li>
                <Link
                  to="/trainer"
                  className="nav-link-hover text-white font-medium relative whitespace-nowrap"
                >
                  Quản lý
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
                <div className="relative">
                  <img
                    src={getAvatarUrl(user.avatar)}
                    className="w-8 h-8 rounded-full"
                    alt="avatar"
                  />
                  {activeSubscription && (
                    <span className="absolute -top-1 -right-1 text-xs" title={activeSubscription.planTitle}>
                      {planIconMap[activeSubscription.planTitle] || ""}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-white text-sm font-medium leading-tight">
                    {user.name}
                  </span>
                  {walletBalance !== null && (
                    <span className="text-[11px] text-yellow-400 font-semibold leading-tight">
                      Số dư ví: {new Intl.NumberFormat("vi-VN").format(walletBalance)}đ
                    </span>
                  )}
                </div>
                <ChevronDown size={16} className="text-white" />
              </button>
              {openDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg overflow-hidden z-50 border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="font-semibold text-gray-800 truncate">
                      {user.name}{activeSubscription ? ` - ${activeSubscription.planTitle}` : ""}
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

        {/* MOBILE BUTTON - Thêm màu trắng cho icon */}
        <div className="absolute right-5 md:hidden flex items-center gap-3 z-20">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white"
            aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* MOBILE MENU */}
        <div
          className={`fixed inset-0 top-20 bg-linear-to-b from-[#f39c12] to-[#1a1a1a] z-10 transform transition-transform duration-300 ${menuOpen ? "translate-x-0" : "translate-x-full"
            } md:hidden overflow-y-auto`}
        >
          <div className="flex flex-col items-center justify-start min-h-full py-8 px-5">
            {user ? (
              <div className="w-full mb-8 bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
                <div className="p-5 flex flex-col items-center border-b border-white/20">
                  <img
                    src={getAvatarUrl(user.avatar)}
                    className="w-20 h-20 rounded-full border-2 border-white mb-3"
                    alt="avatar"
                  />
                  <span className="text-white text-lg font-semibold">
                    {user.name}{activeSubscription ? ` - ${activeSubscription.planTitle}` : ""}
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
                  {["admin", "trainer"].includes(user?.role) ? "Gói dịch vụ" : "Gói tập"}
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
              {isAdmin && (
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
              {!isAdmin && hasTrainerAccess && (
                <li className="w-full">
                  <Link
                    to="/trainer"
                    onClick={() => setMenuOpen(false)}
                    className="block text-center text-orange-300 font-semibold text-lg py-3 px-4 rounded-lg hover:bg-white/10"
                  >
                    Quản lý
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

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  FileText,
  Star,
  LayoutDashboard,
} from "lucide-react";
import logo from "../../assets/images/logo/logo.svg";
import { useAuth } from "../../context/AuthContext";
import { getMyWallet } from "../../services/wallet.service";
import { getMySubscription } from "../../services/trainerSubscription.service";
import { getMyCheckins } from "../../services/checkin.service";
import LanguageSwitcher from "../../components/LanguageSwitcher";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

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
  const [openGroups, setOpenGroups] = useState({});
  const [walletBalance, setWalletBalance] = useState(null);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [hasOrders, setHasOrders] = useState(false);
  const [hasOnlinePackage, setHasOnlinePackage] = useState(false);

  // Map tên gói -> icon
  const planIconMap = {
    "Tiêu chuẩn": "🔥",
    "Chuyên nghiệp": "💎",
    "Cao cấp": "👑",
  };

  const toggleGroup = (groupName) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
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

  const isHomePage = location.pathname === "/";
  const isSolidHeader = isScrolled || !isHomePage;

  const dropdownItems = isAdmin
    ? [
      {
        group: t("nav_user.system_management"),
        children: [
          { label: t("nav_user.admin_panel"), icon: LayoutDashboard, path: "/admin" },
          { label: t("nav_user.f1_system"), icon: Users, path: "/f1-customers" },
          { label: t("nav_user.exercise_system"), icon: Dumbbell, path: "/exercises" },
        ]
      },
      { isDivider: true },
      {
        group: t("nav_user.training_ops"),
        children: [
          { label: t("nav_user.customer_checkin"), icon: UserCheck, path: "/checkin" },
          { label: t("nav_user.online_coaching"), icon: Sparkles, path: "/trainer/coaching" },
          { label: t("nav_user.training_schedule"), icon: CalendarDays, path: "/training-schedule" },
          { label: t("nav_user.workout_plan"), icon: FileText, path: "/workout-plans" },
        ]
      },
      { isDivider: true },
      { label: t("nav_user.my_wallet"), icon: Wallet, path: "/wallet" },
      { label: t("nav_user.account"), icon: User, path: "/account" },
      { label: t("nav.logout"), icon: LogOut, onClick: handleLogout },
    ]
    : hasTrainerAccess
      ? [
        {
          group: t("nav_user.training_ops"),
          children: [
            { label: t("nav_user.overview"), icon: LayoutDashboard, path: "/trainer" },
            { label: t("nav_user.customer_checkin"), icon: UserCheck, path: "/checkin" },
            { label: t("nav_user.online_coaching"), icon: Sparkles, path: "/trainer/coaching" },
            { label: t("nav_user.training_schedule"), icon: CalendarDays, path: "/training-schedule" },
            { label: t("nav_user.workout_plan"), icon: FileText, path: "/workout-plans" },
            { label: t("nav_user.f1_system"), icon: Users, path: "/f1-customers" },
            { label: t("nav_user.exercise_system"), icon: Dumbbell, path: "/exercises" },
          ]
        },
        { isDivider: true },
        { label: t("nav_user.my_wallet"), icon: Wallet, path: "/wallet" },
        { label: t("nav_user.account"), icon: User, path: "/account" },
        { label: t("nav.logout"), icon: LogOut, onClick: handleLogout },
      ]
      : [
        {
          group: t("nav_user.training_tools"),
          children: [
            ...(hasOrders ? [{ label: t("nav_user.checkin_history"), icon: History, path: "/my-history" }] : []),
            ...(hasOrders ? [{ label: t("nav_user.book_training"), icon: CalendarDays, path: "/book-training" }] : []),
            ...(hasOrders ? [{ label: t("nav_user.workout_plan"), icon: FileText, path: "/workout-plans" }] : []),
            ...(hasOnlinePackage ? [{ label: t("nav_user.online_plan"), icon: Sparkles, path: "/online-coaching" }] : []),
            { label: t("nav_user.meal_suggestion"), icon: Utensils, path: "/tdee-calculator" },
            { label: t("nav_user.exercise_system"), icon: Dumbbell, path: "/exercises" },
          ]
        },
        { isDivider: true },
        ...(user?.customerStorySlug ? [{ label: t("nav_user.my_profile"), icon: Star, path: `/ket-qua-khach-hang/${user.customerStorySlug}` }] : []),
        { label: t("nav_user.my_wallet"), icon: Wallet, path: "/wallet" },
        { label: t("nav_user.account"), icon: User, path: "/account" },
        { label: t("nav.logout"), icon: LogOut, onClick: handleLogout },
      ];

  const textColorClass = isSolidHeader ? "text-white" : "text-dark";
  const textMutedClass = isSolidHeader ? "text-white/80 hover:text-white" : "text-dark/70 hover:text-dark";

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 w-full z-50 h-[73px] 2xl:h-20 transition-all duration-300 ${isSolidHeader
        ? "bg-gradient-to-r from-[#f39c12] to-[#1a1a1a] shadow-md border-transparent"
        : "bg-transparent border-b border-black/10"
        }`}
    >
      <div className="relative h-full flex items-center justify-between px-5 max-w-[1536px] mx-auto bg-transparent">
        {/* Logo */}
        <Link
          to="/"
          onClick={() => setMenuOpen(false)}
          className="overflow-hidden z-20"
        >
          <img
            src={logo}
            alt="HT Coaching"
            className={`h-12 lg:h-14 2xl:h-16 max-w-full object-contain transition-all duration-300`}
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex flex-1 justify-center ml-2" aria-label="Menu chính">
          <ul className="flex items-center gap-5 xl:gap-6 2xl:gap-8 list-none m-0 p-0">
            <li>
              <Link
                to="/"
                className={`nav-link-hover ${textColorClass} font-semibold relative whitespace-nowrap text-[15px] transition-colors`}
              >
                {t("nav.home")}
              </Link>
            </li>
            <li>
              <button
                onClick={() => handleScrollToSection("about")}
                className={`nav-link-hover ${textMutedClass} font-semibold relative whitespace-nowrap bg-transparent border-none cursor-pointer text-[15px] transition-colors`}
              >
                {t("nav.about")}
              </button>
            </li>
            <li className="relative group">
              <button
                className={`nav-link-hover ${textMutedClass} font-semibold relative flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-[15px] transition-colors`}
              >
                {t("nav.services")} <ChevronDown size={14} className="transition-transform duration-200 group-hover:rotate-180" />
              </button>
              {/* Dropdown */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-52 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="bg-white rounded-xl shadow-2xl py-2 border border-gray-100">
                  <button onClick={() => handleScrollToSection("pricing")} className="w-full text-left px-5 py-3 text-sm text-gray-800 hover:bg-orange-50 hover:text-primary font-semibold transition-colors">
                    {["admin", "trainer"].includes(user?.role) ? t("nav_dropdown.packages_admin") : t("nav_dropdown.packages")}
                  </button>
                  <button onClick={() => handleScrollToSection("classes")} className="w-full text-left px-5 py-3 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary transition-colors">{t("nav_dropdown.programs")}</button>
                  <button onClick={() => handleScrollToSection("trainers")} className="w-full text-left px-5 py-3 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary transition-colors">{t("nav_dropdown.trainers")}</button>
                </div>
              </div>
            </li>

            <li>
              <button
                onClick={() => handleScrollToSection("customer")}
                className={`nav-link-hover ${textMutedClass} font-semibold relative whitespace-nowrap bg-transparent border-none cursor-pointer text-[15px] transition-colors`}
              >
                {t("nav.feedback")}
              </button>
            </li>
            <li>
              <Link
                to="/blog"
                className={`nav-link-hover ${textMutedClass} font-semibold relative whitespace-nowrap text-[15px] transition-colors`}
              >
                Blog
              </Link>
            </li>
            <li className="relative group">
              <button
                className={`nav-link-hover ${textMutedClass} font-semibold relative flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-[15px] transition-colors`}
              >
                {t("nav.tools")} <ChevronDown size={14} className="transition-transform duration-200 group-hover:rotate-180" />
              </button>
              {/* Dropdown */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-[220px] pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="bg-white rounded-xl shadow-2xl py-2 border border-gray-100">
                  <Link to="/tdee-calculator" className="block w-full text-left px-5 py-3 text-sm text-gray-800 hover:bg-orange-50 hover:text-primary transition-colors">{t("nav_dropdown.tdee")}</Link>
                  <Link to="/cong-thuc-nau-an" className="block w-full text-left px-5 py-3 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary transition-colors">{t("nav_dropdown.recipes")}</Link>
                  <Link to="/mealplan" className="block w-full text-left px-5 py-3 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary transition-colors">{t("nav_dropdown.mealplan")}</Link>
                </div>
              </div>
            </li>
            <li>
              <Link
                to="/club"
                className={`nav-link-hover ${textMutedClass} font-semibold relative whitespace-nowrap text-[15px] transition-colors`}
              >
                {t("nav.club")}
              </Link>
            </li>
          </ul>
        </nav>

        {/* Language Switcher + LOGIN / USER - Desktop */}
        <div className="hidden lg:flex items-center gap-2">
          <LanguageSwitcher isSolidHeader={isSolidHeader} />
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpenDropdown(!openDropdown)}
                className={`flex items-center gap-1.5 2xl:gap-2.5 rounded-full px-2.5 2xl:px-4 py-1.5 transition-colors border ${
                  isSolidHeader ? "bg-white/10 hover:bg-white/20 border-transparent" : "bg-gray-100 hover:bg-gray-200 border-gray-200"
                }`}
              >
                <div className="relative">
                  <img
                    src={getAvatarUrl(user.avatar)}
                    className="w-8 h-8 2xl:w-9 2xl:h-9 rounded-full"
                    alt="avatar"
                  />
                  {activeSubscription && (
                    <span className="absolute -top-1 -right-1 text-xs" title={activeSubscription.planTitle}>
                      {planIconMap[activeSubscription.planTitle] || ""}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-start">
                  <span className={`${textColorClass} text-xs font-bold leading-tight max-w-[100px] 2xl:max-w-[140px] truncate`}>
                    {user.name}
                  </span>
                  {walletBalance !== null && (
                    <span className={`text-[10px] font-semibold leading-tight mt-0.5 ${isSolidHeader ? "text-yellow-400" : "text-gray-500"}`}>
                      {new Intl.NumberFormat("vi-VN").format(walletBalance)}đ
                    </span>
                  )}
                </div>
                <ChevronDown size={16} className={`${textColorClass} ml-1`} />
              </button>
              {openDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden z-50 border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                    <p className="font-semibold text-gray-800 truncate">
                      {user.name}{activeSubscription ? ` - ${activeSubscription.planTitle}` : ""}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {user.email || "user@example.com"}
                    </p>
                  </div>
                  <div className="py-2">
                    {dropdownItems.map((item, idx) => {
                      if (item.isDivider) {
                        return <div key={idx} className="h-px bg-gray-100 my-1"></div>;
                      }
                      if (item.children) {
                        const isOpen = openGroups[item.group];
                        return (
                          <div key={idx} className="w-full">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGroup(item.group);
                              }}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition"
                            >
                              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{item.group}</span>
                              <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[500px]' : 'max-h-0'}`}>
                              <div className="bg-gray-50/30 py-1">
                                {item.children.map((child, cIdx) => {
                                  const ChildIcon = child.icon;
                                  return (
                                    <button
                                      key={cIdx}
                                      onClick={() => {
                                        if (child.onClick) child.onClick();
                                        else if (child.path) navigate(child.path);
                                        setOpenDropdown(false);
                                      }}
                                      className="w-full flex items-center gap-3 pl-6 pr-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors"
                                    >
                                      <ChildIcon size={16} className="text-gray-400" />
                                      <span className="font-medium">{child.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      const Icon = item.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (item.onClick) item.onClick();
                            else if (item.path) navigate(item.path);
                            setOpenDropdown(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors"
                        >
                          <Icon size={18} className="text-gray-400" />
                          <span className="font-medium">{item.label}</span>
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
              className={`px-5 py-2.5 rounded-sm font-semibold transition-colors text-sm shadow-md ${
                isSolidHeader ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-dark hover:bg-black text-white"
              }`}
            >
              {t("nav.login")}
            </Link>
          )}
        </div>

        {/* MOBILE BUTTON */}
        <div className="absolute right-5 lg:hidden flex items-center gap-3 z-20">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`${isSolidHeader ? "text-white" : "text-dark bg-white shadow-sm p-1.5 rounded-md border border-gray-200"}`}
            aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={isSolidHeader ? 28 : 22} /> : <Menu size={isSolidHeader ? 28 : 22} />}
          </button>
        </div>

        {/* MOBILE MENU */}
        <div
          className={`fixed inset-0 top-[73px] bg-gradient-to-b from-[#e8810c] via-[#75440c] to-[#1a1a1a] z-10 transform transition-transform duration-300 ${menuOpen ? "translate-x-0" : "translate-x-full"
            } lg:hidden overflow-y-auto`}
        >
          <div className="flex flex-col items-center justify-start min-h-full py-8 px-5">
            {user ? (
              <div className="w-full mb-8 bg-black/20 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10">
                <div className="p-5 flex flex-col items-center border-b border-white/10 bg-black/20">
                  <img
                    src={getAvatarUrl(user.avatar)}
                    className="w-20 h-20 rounded-full shadow-sm mb-3 border border-white/20"
                    alt="avatar"
                  />
                  <span className="text-white text-lg font-bold">
                    {user.name}{activeSubscription ? ` - ${activeSubscription.planTitle}` : ""}
                  </span>
                  <span className="text-white/70 text-sm mt-1 text-center break-all">
                    {user.email || "user@example.com"}
                  </span>
                </div>
                <div className="py-2">
                  {dropdownItems.map((item, idx) => {
                    if (item.isDivider) {
                      return <div key={idx} className="h-px bg-white/10 my-2 mx-5"></div>;
                    }
                    if (item.children) {
                      const isOpen = openGroups[item.group];
                      return (
                        <div key={idx} className="w-full">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroup(item.group);
                            }}
                            className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition"
                          >
                            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">{item.group}</span>
                            <ChevronDown size={14} className={`text-white/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[500px]' : 'max-h-0'}`}>
                            <div className="bg-black/20 py-1 border-y border-white/5">
                              {item.children.map((child, cIdx) => {
                                const ChildIcon = child.icon;
                                return (
                                  <button
                                    key={cIdx}
                                    onClick={() => {
                                      if (child.onClick) child.onClick();
                                      else if (child.path) navigate(child.path);
                                      setMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 pl-8 pr-5 py-3 text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                                  >
                                    <ChildIcon size={18} className="text-white/60" />
                                    <span className="font-medium">{child.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (item.onClick) item.onClick();
                          else if (item.path) navigate(item.path);
                          setMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-5 py-3 text-white/90 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <Icon size={20} className="text-white/60" />
                        <span className="font-medium">{item.label}</span>
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
                  className="block w-full text-center bg-[#FF5A1F] hover:bg-[#C4400F] text-white font-bold text-[16px] px-4 py-3.5 rounded-full shadow-md transition-colors"
                >
                  {t("nav.login")}
                </Link>
              </div>
            )}
            
            <ul className="w-full flex flex-col items-center gap-2">
              {[
                { label: t("nav.home"), action: () => navigate("/") },
                { label: t("nav.about"), action: () => handleScrollToSection("about") },
                { label: t("nav.services"), action: () => handleScrollToSection("pricing") },
                { label: t("nav.feedback"), action: () => handleScrollToSection("customer") },
                { label: t("nav.blog"), action: () => navigate("/blog") },
                { label: t("nav.tools"), action: () => handleScrollToSection("tools") },
                { label: t("nav.club"), action: () => navigate("/club") }
              ].map((link, index) => (
                <li key={index} className="w-full">
                  <button
                    onClick={() => {
                      link.action();
                      setMenuOpen(false);
                    }}
                    className="block text-center text-white/90 font-medium text-[17px] py-3.5 px-4 rounded-lg hover:bg-white/10 w-full transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
              
              {isAdmin && (
                <li className="w-full mt-2">
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="block text-center text-[#FF5A1F] font-bold text-[17px] py-3.5 px-4 rounded-lg hover:bg-white/10 transition-colors bg-white/5"
                  >
                    {t("nav_user.admin_system")}
                  </Link>
                </li>
              )}
              {!isAdmin && hasTrainerAccess && (
                <li className="w-full mt-2">
                  <Link
                    to="/trainer"
                    onClick={() => setMenuOpen(false)}
                    className="block text-center text-[#FF5A1F] font-bold text-[17px] py-3.5 px-4 rounded-lg hover:bg-white/10 transition-colors bg-white/5"
                  >
                    {t("nav_user.trainer_management")}
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

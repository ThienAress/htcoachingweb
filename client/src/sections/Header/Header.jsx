import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LogOut,
  ChevronDown,
  Dumbbell,
  Users,
  Wallet,
  CalendarDays,
  Sparkles,
  User,
  FileText,
  Star,
  LayoutDashboard,
  Bell,
  Home,
  Lightbulb,
  MessageSquare,
  Package,
  Activity,
  Calculator,
  Utensils,
} from "lucide-react";
import logo from "../../assets/images/logo/logo.svg";
import { useAuth } from "../../context/AuthContext";
import { getMyWallet } from "../../services/wallet.service";
import { getMySubscription } from "../../services/trainerSubscription.service";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { useQuery } from "@tanstack/react-query";
import { NotificationCenter } from "../../components/NotificationCenter";
import { getAccountWorkspaceItems } from "../../navigation/workspaceNavigation";

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
  const mobileMenuButtonRef = useRef(null);
  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const { data: accountSummary } = useQuery({
    queryKey: ["header-account-summary", user?._id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [walletResult, subscriptionResult] =
        await Promise.allSettled([
          getMyWallet(),
          getMySubscription(),
        ]);

      return {
        walletBalance:
          walletResult.status === "fulfilled"
            ? walletResult.value.data.data.balance
            : null,
        activeSubscription:
          subscriptionResult.status === "fulfilled"
            ? subscriptionResult.value.data.data
            : null,
      };
    },
    staleTime: 60_000,
  });
  const walletBalance = user ? (accountSummary?.walletBalance ?? null) : null;
  const activeSubscription = user ? (accountSummary?.activeSubscription ?? null) : null;

  // Map tên gói -> icon
  const planIconMap = {
    "Tiêu chuẩn": "🔥",
    "Chuyên nghiệp": "💎",
    "Cao cấp": "👑",
  };

  // Fetch số dư ví + gói dịch vụ
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

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
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

  const workspaceIconMap = {
    admin: LayoutDashboard,
    customerManagement: Users,
    customerDashboard: LayoutDashboard,
  };
  const workspaceItems = getAccountWorkspaceItems({
    isAdmin,
    hasTrainerAccess,
  }).map((item) => ({
    ...item,
    label: t(item.labelKey),
    icon: workspaceIconMap[item.key],
  }));
  const personalItems = [
    ...(user?.customerStorySlug
      ? [
          {
            label: t("nav_user.my_profile"),
            icon: Star,
            path: `/ket-qua-khach-hang/${user.customerStorySlug}`,
          },
        ]
      : []),
    { label: t("nav_user.my_wallet"), icon: Wallet, path: "/wallet" },
    { label: t("nav_user.notifications"), icon: Bell, path: "/notifications" },
    { label: t("nav_user.account"), icon: User, path: "/account" },
  ];
  const dropdownItems = [
    { isSectionLabel: true, label: t("nav_user.workspaces") },
    ...workspaceItems,
    { isDivider: true },
    { isSectionLabel: true, label: t("nav_user.account") },
    ...personalItems,
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
                  <button onClick={() => handleScrollToSection("pricing")} className="w-full text-left px-5 py-3 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary transition-colors">
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
                  <Link to="/exercises" className="block w-full text-left px-5 py-3 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary transition-colors">{t("nav_user.exercise_system")}</Link>
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
          {user && (
            <NotificationCenter userId={user._id} solid={isSolidHeader} />
          )}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpenDropdown(!openDropdown)}
                aria-label={`${t("nav_user.open_account_menu")}: ${user.name}`}
                aria-expanded={openDropdown}
                aria-controls="account-dropdown-menu"
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
                <div
                  id="account-dropdown-menu"
                  data-testid="account-dropdown-menu"
                  className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden z-50 border border-gray-100"
                >
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
                      if (item.isSectionLabel) {
                        return (
                          <p
                            key={idx}
                            className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-gray-500"
                          >
                            {item.label}
                          </p>
                        );
                      }
                      if (item.isDivider) {
                        return <div key={idx} className="h-px bg-gray-100 my-1"></div>;
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
                          className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500"
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
        <div className="absolute right-4 lg:hidden flex items-center gap-2 z-20">
          {user && (
            <NotificationCenter userId={user._id} solid={isSolidHeader} />
          )}
          <button
            ref={mobileMenuButtonRef}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu-drawer"
            className={`relative flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-xl transition-all duration-300 ${
              isSolidHeader
                ? "bg-white/10 hover:bg-white/20 border border-white/20"
                : "bg-white shadow-md border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span className={`block h-[2px] w-5 rounded-full transition-all duration-300 origin-center ${
              isSolidHeader ? "bg-white" : "bg-gray-800"
            } ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`block h-[2px] rounded-full transition-all duration-300 ${
              isSolidHeader ? "bg-white" : "bg-gray-800"
            } ${menuOpen ? "w-0 opacity-0" : "w-3.5"}`} />
            <span className={`block h-[2px] w-5 rounded-full transition-all duration-300 origin-center ${
              isSolidHeader ? "bg-white" : "bg-gray-800"
            } ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </button>
        </div>

        {/* MOBILE MENU DRAWER */}
        <div
          id="mobile-menu-drawer"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
          className={`fixed inset-0 top-[73px] z-10 transform transition-transform duration-300 ease-in-out lg:hidden overflow-y-auto bg-gradient-to-b from-[#e8810c] via-[#75440c] to-[#1a1a1a] ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col min-h-full px-5 py-6 gap-5">

            {/* ── User card ── */}
            {user ? (
              <div className="rounded-2xl bg-black/25 border border-white/10 overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <div className="relative shrink-0">
                    <img
                      src={getAvatarUrl(user.avatar)}
                      className="h-12 w-12 rounded-full border-2 border-white/30 object-cover shadow-md"
                      alt="avatar"
                    />
                    {activeSubscription && (
                      <span className="absolute -right-1 -top-1 text-base" title={activeSubscription.planTitle}>
                        {planIconMap[activeSubscription.planTitle] || ""}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white">{user.name}</p>
                    <p className="truncate text-xs text-white/60">{user.email}</p>
                    {walletBalance !== null && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-yellow-300">
                        <Wallet size={12} /> {new Intl.NumberFormat("vi-VN").format(walletBalance)}đ
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block w-full text-center bg-white text-orange-600 font-bold text-[16px] px-4 py-3.5 rounded-2xl shadow-md hover:bg-orange-50 transition-colors"
              >
                {t("nav.login")}
              </Link>
            )}

            {/* ── MENU grid ── */}
            <div>
              <p className="mb-3 inline-flex rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-white">Menu</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t("nav.home"), icon: Home, action: () => navigate("/") },
                  { label: t("nav.about"), icon: Lightbulb, action: () => handleScrollToSection("about") },
                  { label: t("nav.feedback"), icon: MessageSquare, action: () => handleScrollToSection("customer") },
                  { label: t("nav.blog"), icon: FileText, action: () => navigate("/blog") },
                  { label: t("nav.club"), icon: Dumbbell, action: () => navigate("/club") },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => { item.action(); setMenuOpen(false); }}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/75 px-2 py-3 text-center transition-all hover:bg-slate-950/90 active:scale-95"
                    >
                      <Icon size={24} className="text-white/90" strokeWidth={1.5} />
                      <span className="text-[11px] font-semibold leading-tight text-white">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Dịch vụ ── */}
            <div>
              <p className="mb-3 inline-flex rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-white">{t("nav.services")}</p>
              <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: ["admin", "trainer"].includes(user?.role) ? t("nav_dropdown.packages_admin") : t("nav_dropdown.packages"), icon: Package, action: () => handleScrollToSection("pricing") },
                    { label: t("nav_dropdown.programs"), icon: Activity, action: () => handleScrollToSection("classes") },
                    { label: t("nav_dropdown.trainers"), icon: Users, action: () => handleScrollToSection("trainers") },
                  ].map((sub, i) => {
                    const SubIcon = sub.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => { sub.action(); setMenuOpen(false); }}
                        className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-950/75 px-2 py-3 text-center transition-all hover:bg-slate-950/90 active:scale-95"
                      >
                        <SubIcon size={24} className="text-white/90" strokeWidth={1.5} />
                        <span className="text-[11px] font-semibold leading-tight text-white">{sub.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* ── Công cụ ── */}
            <div>
              <p className="mb-3 inline-flex rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-white">{t("nav.tools")}</p>
              <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: t("nav_user.exercise_system"), icon: Activity, path: "/exercises" },
                    { label: t("nav_dropdown.tdee"), icon: Calculator, path: "/tdee-calculator" },
                    { label: t("nav_dropdown.recipes"), icon: Utensils, path: "/cong-thuc-nau-an" },
                    { label: t("nav_dropdown.mealplan"), icon: CalendarDays, path: "/mealplan" },
                  ].map((sub, i) => {
                    const SubIcon = sub.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => { navigate(sub.path); setMenuOpen(false); }}
                        className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-950/75 px-2 py-3 text-center transition-all hover:bg-slate-950/90 active:scale-95"
                      >
                        <SubIcon size={24} className="text-white/90" strokeWidth={1.5} />
                        <span className="text-[11px] font-semibold leading-tight text-white">{sub.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* ── Workspace + account actions ── */}
            {user && (
              <div className="space-y-5">
                <div>
                  <p className="mb-3 inline-flex rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-white">
                    {t("nav_user.workspaces")}
                  </p>
                  <div className="space-y-1.5">
                    {workspaceItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            navigate(item.path);
                            setMenuOpen(false);
                          }}
                          className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-orange-400/30 bg-orange-500/20 px-4 py-3 text-sm font-semibold text-orange-100 transition-colors hover:bg-orange-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                        >
                          <Icon size={18} className="text-orange-300" strokeWidth={1.5} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-3 inline-flex rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-white">
                    {t("nav_user.account")}
                  </p>
                  <div className="space-y-1.5">
                    {personalItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        onClick={() => { navigate(item.path); setMenuOpen(false); }}
                        className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                      >
                        <Icon size={18} className="text-white/50" strokeWidth={1.5} />
                        {item.label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => { handleLogout(); setMenuOpen(false); }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-red-400/20 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                  >
                    <LogOut size={18} strokeWidth={1.5} />
                    {t("nav.logout")}
                  </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Language ── */}
            <div className="mt-auto pt-2 border-t border-white/10">
              <LanguageSwitcher isSolidHeader={true} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

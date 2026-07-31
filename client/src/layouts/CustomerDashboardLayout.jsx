import {
  CalendarCheck2,
  Dumbbell,
  Home,
  NotebookPen,
  TrendingUp,
  UserRound,
  Utensils,
  SidebarOpen,
  SidebarClose,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { NotificationCenter } from "../components/NotificationCenter";
import { useAuth } from "../context/AuthContext";
import {
  dashboardDateFromPath,
  dashboardPathFor,
  dashboardSectionFromPath,
} from "../utils/customerDashboardNavigation";
import { getVietnamDateKey } from "../utils/vietnamDate";

const NAV_ITEMS = [
  { key: "today", label: "Hôm nay", icon: CalendarCheck2 },
  { key: "training", label: "Tập luyện", icon: Dumbbell },
  { key: "nutrition", label: "Dinh dưỡng", icon: Utensils },
  { key: "journal", label: "Nhật ký", icon: NotebookPen },
  { key: "progress", label: "Tổng quan", icon: TrendingUp },
];

const initialsFor = (name = "Học viên") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "HV";

/* ── Sidebar nav ── */
const CustomerNav = ({ activeSection, dateKey, mobile = false }) => (
  <nav
    aria-label="Điều hướng bảng theo dõi"
    className={
      mobile
        ? "grid grid-cols-5"
        : "space-y-0.5"
    }
  >
    {NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      const active = activeSection === item.key;
      return (
        <Link
          key={item.key}
          to={dashboardPathFor(item.key, dateKey)}
          aria-current={active ? "page" : undefined}
          className={
            mobile
              ? "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400 " +
                (active ? "text-orange-300" : "text-slate-400 hover:text-white")
              : "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 " +
                (active
                  ? "bg-orange-500 text-white shadow-[0_0_16px_-4px_rgba(249,115,22,0.5)]"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white")
          }
        >
          <span
            className={
              mobile
                ? ""
                : "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg " +
                  (active
                    ? "bg-white/20"
                    : "bg-slate-800 group-hover:bg-slate-700")
            }
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
          </span>
          <span>{item.label}</span>
        </Link>
      );
    })}
  </nav>
);

const CustomerDashboardLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => setIsDesktopViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  const today = getVietnamDateKey();
  const dateKey = dashboardDateFromPath(location.pathname, today);
  const activeSection = dashboardSectionFromPath(location.pathname);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <div className="min-h-screen bg-zinc-950 p-3 text-slate-100 lg:p-4">
      <a
        href="#customer-dashboard-content"
        className="sr-only z-50 rounded-md bg-orange-500 px-4 py-2 font-bold text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Bỏ qua điều hướng
      </a>

      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-3 lg:gap-4">
        {/* ── Sidebar ── */}
        <aside
          className={[
            "sticky top-0 hidden h-[calc(100vh-2rem)] shrink-0 flex-col rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/[0.06] lg:flex",
            "overflow-hidden transition-all duration-300 ease-in-out",
            isCollapsed ? "w-0 p-0 opacity-0" : "w-64 p-5 opacity-100",
          ].join(" ")}
          aria-hidden={!isDesktopViewport || isCollapsed}
          inert={!isDesktopViewport || isCollapsed}
        >
          {/* Logo */}
          <Link
            to="/"
            className="group flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 shadow-[0_0_16px_-2px_rgba(249,115,22,0.6)]">
              <span className="text-sm font-black text-white">HT</span>
            </span>
            <span>
              <span className="block text-sm font-black tracking-tight text-white">
                HTCOACHING
              </span>
              <span className="block text-[10px] font-medium text-slate-500">
                Bảng theo dõi học viên
              </span>
            </span>
          </Link>

          {/* Divider */}
          <div className="my-5 h-px bg-white/[0.07]" />

          {/* Section label */}
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            Menu chính
          </p>
          <CustomerNav activeSection={activeSection} dateKey={dateKey} />

          {/* Bottom — user + home */}
          <div className="mt-auto space-y-1 border-t border-white/[0.07] pt-4">
            <Link
              to="/account"
              className="flex min-h-12 items-center gap-3 rounded-xl px-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-orange-300">
                {initialsFor(user?.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">
                  {user?.name || "Học viên"}
                </span>
                <span className="block text-xs text-slate-500">Tài khoản</span>
              </span>
            </Link>
            <Link
              to="/"
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800">
                <Home aria-hidden="true" className="h-4 w-4" />
              </span>
              Trang chủ
            </Link>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="min-w-0 flex-1 rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/[0.06]">
          {/* Topbar */}
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between rounded-t-2xl border-b border-white/[0.07] bg-slate-900/95 px-4 backdrop-blur-md lg:px-6">
            <div className="flex items-center gap-3">
              {/* Desktop sidebar toggle */}
              <button
                onClick={() => setIsCollapsed((v) => !v)}
                aria-label={isCollapsed ? "Mở sidebar" : "Thu sidebar"}
                title={isCollapsed ? "Mở sidebar" : "Thu sidebar"}
                className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                {isCollapsed ? (
                  <SidebarOpen aria-hidden="true" className="h-5 w-5" />
                ) : (
                  <SidebarClose aria-hidden="true" className="h-5 w-5" />
                )}
              </button>

              {/* Mobile: logo */}
              <Link
                to="/"
                className="font-black tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 lg:hidden"
              >
                HTCOACHING
              </Link>

              {/* Desktop: greeting */}
              <p className="hidden text-sm text-slate-400 lg:block">
                <span className="font-semibold text-white">
                  {greeting}, {user?.name?.split(" ").at(-1) || "bạn"}
                </span>{" "}
                — chúc bạn một ngày hiệu quả 💪
              </p>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <NotificationCenter userId={user?._id} solid />
              <Link
                to="/account"
                aria-label="Mở tài khoản"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-orange-300 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 lg:hidden"
              >
                {initialsFor(user?.name)}
              </Link>
              {/* Desktop avatar */}
              <Link
                to="/account"
                aria-label="Mở tài khoản"
                className="hidden items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 lg:flex"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-orange-300">
                  {initialsFor(user?.name)}
                </span>
                <span className="max-w-[120px] truncate">
                  {user?.name || "Tài khoản"}
                </span>
                <UserRound aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" />
              </Link>
            </div>
          </header>

          <main
            id="customer-dashboard-content"
            className="product-surface mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8"
          >
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed inset-x-3 bottom-4 z-20 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="overflow-hidden rounded-2xl border border-white/[0.15] bg-slate-950/95 shadow-2xl backdrop-blur-xl">
          <CustomerNav activeSection={activeSection} dateKey={dateKey} mobile />
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboardLayout;

import { useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Menu,
  X,
  Users,
  HeartPulse,
  CalendarDays,
  UserCheck,
  Sparkles,
  FileText,
  Dumbbell,
  TrendingUp,
  FlaskConical,
  ChevronDown,
  SidebarClose,
  SidebarOpen,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { mySubscriptionQueryOptions } from "../queries/subscription.queries";
import { canAccessF1 } from "../utils/trainerEntitlements";
import {
  getTrainerNavigationGroups,
  isTrainerNavigationItemActive,
} from "../navigation/workspaceNavigation";
import { TODAY_PLATFORM_ENABLED } from "../config/featureFlags";
import {
  persistTrainerWorkspaceTheme,
  resolveInitialTrainerWorkspaceTheme,
} from "../utils/trainerWorkspaceTheme";

const TrainerLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const needsSubscription = Boolean(user && user.role !== "admin");
  const { data: subscription } = useQuery(
    mySubscriptionQueryOptions({
      userId: user?._id,
      enabled: needsSubscription,
      retry: false,
    }),
  );
  const f1Allowed = canAccessF1(user, subscription);
  const isNavItemActive = (itemKey) =>
    isTrainerNavigationItemActive(itemKey, location.pathname);

  // Mobile overlay state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Desktop collapse state
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [trainerTheme, setTrainerTheme] = useState(
    resolveInitialTrainerWorkspaceTheme,
  );
  const isSidebarHidden = isDesktopViewport
    ? isDesktopCollapsed
    : !isSidebarOpen;

  const sidebarRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);

  useEffect(() => {
    persistTrainerWorkspaceTheme(trainerTheme);
  }, [trainerTheme]);

  useEffect(() => {
    document.documentElement.dataset.trainerTheme = trainerTheme;
    return () => {
      if (document.documentElement.dataset.trainerTheme === trainerTheme) {
        delete document.documentElement.dataset.trainerTheme;
      }
    };
  }, [trainerTheme]);

  const closeMobileSidebar = () => {
    setIsSidebarOpen(false);
    requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateViewport = () => setIsDesktopViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isSidebarOpen]);

  // Click outside → đóng sidebar mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        isSidebarOpen
      ) {
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSidebarOpen]);

  // Khoá scroll body khi sidebar mobile đang mở
  useEffect(() => {
    if (isSidebarOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

  const navigationIconMap = {
    clients: Users,
    health: HeartPulse,
    checkin: UserCheck,
    coaching: Sparkles,
    schedule: CalendarDays,
    workoutPlans: FileText,
    exercises: Dumbbell,
    practiceCenter: FlaskConical,
    f1Customers: TrendingUp,
  };
  const navGroups = getTrainerNavigationGroups({
    f1Allowed,
    todayPlatformEnabled: TODAY_PLATFORM_ENABLED,
  }).map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      icon: navigationIconMap[item.key],
    })),
  }));

  const visibleGroups = navGroups.filter((g) => g.items.length > 0);

  const getInitialOpen = () => {
    const open = {};
    visibleGroups.forEach((group) => {
      const hasActive = group.items.some((item) =>
        isNavItemActive(item.key),
      );
      open[group.key] = hasActive;
    });
    if (!Object.values(open).some(Boolean) && visibleGroups.length > 0) {
      open[visibleGroups[0].key] = true;
    }
    return open;
  };

  const [openGroups, setOpenGroups] = useState(getInitialOpen);

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTrainerTheme = () => {
    setTrainerTheme((theme) => (theme === "dark" ? "light" : "dark"));
  };

  return (
    <div
      className="trainer-workspace flex min-h-screen bg-slate-100 text-slate-950 transition-colors duration-200 motion-reduce:transition-none"
      data-theme={trainerTheme}
    >
      {/* ── Mobile overlay ── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        id="trainer-sidebar"
        ref={sidebarRef}
        aria-hidden={isSidebarHidden}
        inert={isSidebarHidden}
        className={[
          // Mobile: fixed overlay
          "fixed top-0 left-0 z-40 min-h-screen",
          // Desktop: sticky, trong flow, animate width
          "md:sticky md:shrink-0 md:overflow-hidden",
          // Mobile transform
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Desktop width animate
          isDesktopCollapsed ? "md:w-0" : "md:w-64",
          // Shared
          "w-64 bg-slate-900 shadow-lg transition-all duration-200 ease-out",
        ].join(" ")}
      >
        <div className="relative h-full flex flex-col text-white w-64 min-h-screen overflow-y-auto">
          {/* Nút đóng — mobile only */}
          <button
            type="button"
            onClick={closeMobileSidebar}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:hidden"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Branding */}
          <div className="flex items-center justify-between border-b border-white/10 p-5">
            <div>
              <p className="text-lg font-bold leading-tight tracking-tight">
                HTCOACHING
              </p>
              <p className="text-xs text-slate-400">Quản lý khách hàng</p>
            </div>
            <button
              type="button"
              onClick={() => setIsDesktopCollapsed(true)}
              className="hidden size-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:flex"
              aria-label="Thu sidebar HLV"
              title="Thu sidebar HLV"
            >
              <SidebarClose className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Groups */}
          <nav className="flex-1 p-4 space-y-2">
            {visibleGroups.map((group) => {
              const isOpen = !!openGroups[group.key];
              return (
                <div key={group.key}>
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg px-4 py-2 text-left text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    aria-expanded={isOpen}
                  >
                    <span className="flex-1 pr-2 leading-relaxed">{group.label}</span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-200 ${
                      isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <ul className="space-y-1 pb-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = isNavItemActive(item.key);
                        return (
                          <li key={item.path}>
                            <Link
                              to={item.path}
                              onClick={() => setIsSidebarOpen(false)}
                              aria-current={isActive ? "page" : undefined}
                              className={`
                                flex min-h-11 items-center gap-3 rounded-lg px-4 py-2 transition-colors
                                ${
                                  isActive
                                    ? "bg-slate-700 text-white font-semibold"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                }
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400
                              `}
                            >
                              <Icon className="w-5 h-5" />
                              <span>{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Trang chủ */}
          <div className="p-4 border-t border-white/10">
            <Link
              to="/"
              onClick={() => setIsSidebarOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-lg px-4 py-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Home className="w-5 h-5" />
              <span>Trang chủ</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar mobile */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-slate-900 px-4 py-3 shadow-sm md:hidden">
          <button
            type="button"
            ref={mobileMenuButtonRef}
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Mở menu huấn luyện viên"
            aria-expanded={isSidebarOpen}
            aria-controls="trainer-sidebar"
          >
            <Menu aria-hidden="true" className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center font-semibold text-white">
            Quản lý khách hàng
          </div>
        </div>

        {/* Floating desktop toggle button when collapsed */}
        {isDesktopCollapsed && (
          <button
            type="button"
            onClick={() => setIsDesktopCollapsed(false)}
            className="fixed left-4 top-4 z-40 hidden size-11 items-center justify-center rounded-lg bg-slate-900 text-slate-300 shadow-md transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:flex"
            aria-label="Mở sidebar HLV"
            aria-controls="trainer-sidebar"
            aria-expanded="false"
            title="Mở sidebar HLV"
          >
            <SidebarOpen className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        <main className={`flex-1 flex flex-col ${
          location.pathname === '/trainer' ||
          location.pathname.startsWith('/trainer/health') ||
          location.pathname.startsWith('/trainer/clients') ||
          location.pathname === '/trainer/checkin' ||
          location.pathname === '/trainer/coaching' ||
          location.pathname.startsWith('/trainer/schedule') ||
          location.pathname.startsWith('/trainer/workout-plans')
            ? ''
            : 'p-4 md:p-6 xl:p-8'
        }`}>
          <Outlet context={{ trainerTheme, toggleTrainerTheme }} />
        </main>
      </div>
    </div>
  );
};

export default TrainerLayout;

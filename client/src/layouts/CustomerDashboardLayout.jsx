import {
  CalendarCheck2,
  Dumbbell,
  Home,
  NotebookPen,
  TrendingUp,
  UserRound,
  Utensils,
} from "lucide-react";
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
  { key: "progress", label: "Tiến trình", icon: TrendingUp },
];

const initialsFor = (name = "Học viên") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "HV";

const CustomerNav = ({ activeSection, dateKey, mobile = false }) => (
  <nav
    aria-label="Điều hướng Dashboard"
    className={
      mobile
        ? "grid grid-cols-5 border-t border-slate-800 bg-slate-950"
        : "space-y-1"
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
              : "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 " +
                (active
                  ? "bg-orange-500 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white")
          }
        >
          <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span>{item.label}</span>
        </Link>
      );
    })}
  </nav>
);

const CustomerDashboardLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const today = getVietnamDateKey();
  const dateKey = dashboardDateFromPath(location.pathname, today);
  const activeSection = dashboardSectionFromPath(location.pathname);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <a
        href="#customer-dashboard-content"
        className="sr-only z-50 rounded-md bg-orange-500 px-4 py-2 font-bold text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Bỏ qua điều hướng
      </a>

      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950 p-5 lg:flex">
          <Link
            to="/"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <span className="text-lg font-black tracking-tight text-white">HTCOACHING</span>
            <span className="mt-1 block text-xs font-medium text-slate-500">Dashboard học viên</span>
          </Link>

          <div className="my-6 h-px bg-slate-800" />
          <CustomerNav activeSection={activeSection} dateKey={dateKey} />

          <div className="mt-auto border-t border-slate-800 pt-4">
            <Link
              to="/account"
              className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-orange-300">
                {initialsFor(user?.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user?.name || "Học viên"}</span>
                <span className="block text-xs text-slate-500">Tài khoản</span>
              </span>
            </Link>
            <Link
              to="/"
              className="mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              <Home aria-hidden="true" className="h-5 w-5" /> Trang chủ
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950 px-4 lg:px-8">
            <Link
              to="/"
              className="font-black tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 lg:hidden"
            >
              HTCOACHING
            </Link>
            <p className="hidden text-sm font-semibold text-slate-400 lg:block">
              Đồng hành từng ngày
            </p>
            <div className="flex items-center gap-2">
              <NotificationCenter userId={user?._id} solid />
              <Link
                to="/account"
                aria-label="Mở tài khoản"
                className="flex h-11 w-11 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 lg:hidden"
              >
                <UserRound aria-hidden="true" className="h-5 w-5" />
              </Link>
            </div>
          </header>

          <main
            id="customer-dashboard-content"
            className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8"
          >
            <Outlet />
          </main>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-slate-950 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <CustomerNav activeSection={activeSection} dateKey={dateKey} mobile />
      </div>
    </div>
  );
};

export default CustomerDashboardLayout;

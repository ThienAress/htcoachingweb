import {
  ArrowRight,
  CalendarClock,
  Dumbbell,
  NotebookPen,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { dashboardPathFor } from "../../utils/customerDashboardNavigation";

const dayStatusLabel = (status) =>
  ({
    not_started: "Chưa bắt đầu",
    in_progress: "Đang thực hiện",
    completed: "Đã hoàn thành",
    submitted: "Đã gửi HLV",
    rest_day: "Ngày nghỉ",
  })[status] || "Đang cập nhật";

const TodayDashboard = () => {
  const { data, dateKey } = useOutletContext();
  const journal = data.sections.journal.day;
  const scheduleItems = data.sections.schedule.items || [];
  const nextSchedule = scheduleItems[0] || null;
  const nutrition = journal?.nutrition || {};
  const journalPercent = journal?.completion?.percent || 0;

  const modules = [
    {
      key: "training",
      title: "Lịch & bài tập",
      description: "Xem lịch, coaching, giáo án và điểm danh.",
      status: nextSchedule
        ? nextSchedule.startTime + " · " + nextSchedule.exerciseType
        : "Không có lịch tập hôm nay",
      icon: Dumbbell,
    },
    {
      key: "nutrition",
      title: "Dinh dưỡng",
      description: "Theo dõi thực đơn và ghi lại bữa ăn.",
      status: nutrition.assignment
        ? "Đã có thực đơn áp dụng"
        : (nutrition.entries || []).length > 0
          ? nutrition.entries.length + " bữa đã ghi"
          : "Chưa ghi bữa ăn",
      icon: Utensils,
    },
    {
      key: "journal",
      title: "Nhật ký & thói quen",
      description: "Cập nhật wellness, habit và trao đổi với HLV.",
      status: journal ? "Nhật ký đã hoàn thành " + journalPercent + "%" : "Chưa bắt đầu nhật ký",
      icon: NotebookPen,
    },
    {
      key: "progress",
      title: "Tiến trình",
      description: "Xem xu hướng, Weekly Check-in và hoạt động coaching.",
      status: "Mở báo cáo tiến trình",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.55fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-orange-300">
            <CalendarClock aria-hidden="true" className="h-5 w-5" /> Việc tiếp theo
          </div>
          {nextSchedule ? (
            <>
              <h2 className="mt-4 text-xl font-bold text-white">{nextSchedule.exerciseType}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {nextSchedule.startTime}–{nextSchedule.endTime}
                {nextSchedule.notes ? " · " + nextSchedule.notes : ""}
              </p>
              <Link
                to={dashboardPathFor("training", dateKey)}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                Mở lịch & bài tập <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <>
              <h2 className="mt-4 text-xl font-bold text-white">Hoàn thiện nhật ký trong ngày</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Hôm nay chưa có lịch tập. Bạn vẫn có thể cập nhật wellness, bữa ăn và habit.
              </p>
              <Link
                to={dashboardPathFor("journal", dateKey)}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                Mở nhật ký <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
          <p className="text-sm font-semibold text-slate-400">Trạng thái hôm nay</p>
          <p className="mt-3 text-2xl font-bold text-white">
            {dayStatusLabel(data.summary.dayStatus)}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {data.summary.completionPercent}% kế hoạch đã hoàn thành
          </p>
          <progress
            value={data.summary.completionPercent}
            max="100"
            className="mt-5 h-2 w-full accent-orange-500"
            aria-label="Mức hoàn thành tổng quan"
          />
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-white">Chọn một mục để tiếp tục</h2>
          <p className="mt-1 text-sm text-slate-400">Mỗi khu vực chỉ hiển thị nội dung liên quan.</p>
        </div>
        <div className="divide-y divide-slate-800">
          {modules.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={dashboardPathFor(item.key, dateKey)}
                className="group flex min-h-20 items-center gap-4 px-5 py-4 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400 sm:px-6"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-orange-300 group-hover:bg-slate-800">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-white">{item.title}</span>
                  <span className="mt-1 block text-sm text-slate-400">{item.description}</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-orange-300">{item.status}</span>
                </span>
                <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-600 group-hover:text-orange-300" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default TodayDashboard;

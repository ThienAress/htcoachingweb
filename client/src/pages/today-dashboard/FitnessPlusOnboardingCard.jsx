import { ClipboardCheck, Dumbbell } from "lucide-react";
import { Link } from "react-router-dom";

const FITNESS_PLUS_BENEFITS = [
  "Đánh giá bản thân: tự khảo sát và tự kiểm tra thể lực an toàn",
  "Dinh dưỡng: thực đơn, Meal Scan và ghi nhanh bữa ăn",
  "Nhật ký: sức khỏe, thói quen và báo cáo tuần của riêng bạn",
  "Tiến trình: theo dõi số đo, cân nặng và biểu đồ thay đổi",
];

const FITNESS_PLUS_CTA_TO = "/?plan=fitness-plus#pricing";

const FitnessPlusOnboardingCard = () => (
  <section
    aria-labelledby="fitness-plus-onboarding-title"
    className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 sm:p-8"
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full opacity-25"
      style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }}
    />
    <div className="relative">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <Dumbbell aria-hidden="true" className="h-6 w-6" />
        </span>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          Tự tập luyện
        </span>
      </div>

      <h2
        id="fitness-plus-onboarding-title"
        className="mt-5 text-2xl font-bold text-white sm:text-3xl"
      >
        Bắt đầu hành trình tập luyện của bạn
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
        Bạn đã biết tập và muốn tự chủ lịch tập? Gói HT Fitness+ mở sẵn các công cụ để bạn tự theo dõi, không cần huấn luyện viên.
      </p>

      <ul className="mt-6 space-y-3" aria-label="Quyền lợi gói HT Fitness+">
        {FITNESS_PLUS_BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-start gap-3 text-sm font-medium text-slate-300">
            <ClipboardCheck
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
            />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        <Link
          to={FITNESS_PLUS_CTA_TO}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          Xem gói HT Fitness+
        </Link>
      </div>
    </div>
  </section>
);

export default FitnessPlusOnboardingCard;

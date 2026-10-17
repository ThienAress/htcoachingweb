import { Link } from "react-router-dom";

const ProgressEntitlementRequired = () => (
  <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
    <h2 className="text-lg font-bold text-white">Chưa có gói huấn luyện</h2>
    <p className="mt-2 text-sm text-slate-400">
      Bạn cần có gói coaching hoặc HT Fitness+ còn hiệu lực để xem tiến trình.
    </p>
    <Link
      to="/#pricing"
      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
    >
      Xem gói huấn luyện
    </Link>
  </section>
);

export default ProgressEntitlementRequired;

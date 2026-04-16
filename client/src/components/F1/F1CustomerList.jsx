import { Search, UserPlus } from "lucide-react";

const StatusBadge = ({ value }) => {
  const map = {
    new: "Mới tạo",
    intake_in_progress: "Đang khai thác thông tin",
    intake_completed: "Đã hoàn tất intake",
    assessment_completed: "Đã hoàn tất assessment",
    ai_report_generated: "Đã tạo AI Report",
    program_started: "Đã bắt đầu lộ trình",
    archived: "Đã lưu trữ",
  };

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {map[value] || value}
    </span>
  );
};

const ReadinessBadge = ({ value }) => {
  const styles = {
    pending: "bg-amber-100 text-amber-700",
    ready: "bg-emerald-100 text-emerald-700",
    caution: "bg-orange-100 text-orange-700",
    hold: "bg-red-100 text-red-700",
  };

  const labels = {
    pending: "Chờ đánh giá",
    ready: "Phù hợp tập luyện",
    caution: "Cần điều chỉnh",
    hold: "Chưa nên tập",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[value] || "bg-slate-100 text-slate-700"
      }`}
    >
      {labels[value] || value}
    </span>
  );
};

const F1CustomerList = ({
  loading,
  search,
  setSearch,
  customers,
  onOpenCreate,
  onSelectCustomer,
}) => {
  return (
    <section className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Hệ thống khách hàng F1
          </h1>
          <p className="text-slate-500 mt-1">
            Quản lý khách hàng mới trước khi thực hiện Assessment NASM
          </p>
        </div>

        <button
          onClick={onOpenCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1C2D42] px-4 py-3 text-white font-semibold hover:opacity-90"
        >
          <UserPlus size={18} />
          Thêm khách hàng
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, mã F1, số điện thoại, email..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 outline-none focus:border-slate-400"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 text-xs font-bold uppercase text-slate-500 border-b border-slate-200">
          <div className="col-span-3">Khách hàng</div>
          <div className="col-span-2">Mã F1</div>
          <div className="col-span-2">SĐT</div>
          <div className="col-span-2">Trạng thái</div>
          <div className="col-span-2">Mức độ phù hợp tập luyện</div>
          <div className="col-span-1 text-right">Mở</div>
        </div>

        {loading ? (
          <div className="p-6 text-slate-500">Đang tải dữ liệu...</div>
        ) : customers.length === 0 ? (
          <div className="p-6 text-slate-500">Chưa có khách hàng F1.</div>
        ) : (
          customers.map((customer) => (
            <div
              key={customer._id}
              className="grid grid-cols-12 gap-4 px-4 py-4 border-b border-slate-100 items-center"
            >
              <div className="col-span-3">
                <p className="font-semibold text-slate-900">
                  {customer.fullName}
                </p>
                <p className="text-sm text-slate-500">
                  {customer.email || "Chưa có email"}
                </p>
              </div>

              <div className="col-span-2 text-sm text-slate-700">
                {customer.code || "--"}
              </div>

              <div className="col-span-2 text-sm text-slate-700">
                {customer.phone || "--"}
              </div>

              <div className="col-span-2">
                <StatusBadge value={customer.status || "new"} />
              </div>

              <div className="col-span-2">
                <ReadinessBadge value={customer.readinessStatus || "pending"} />
              </div>

              <div className="col-span-1 text-right">
                <button
                  onClick={() => onSelectCustomer(customer)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Mở
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default F1CustomerList;

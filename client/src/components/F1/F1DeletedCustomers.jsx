import { Loader2, RotateCcw } from "lucide-react";
import {
  F1_SOFT_DELETE_DAYS,
  getRemainingDeleteDays,
} from "../../constants/f1CustomerStatus";

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "--";

const F1DeletedCustomers = ({
  loading,
  error,
  customers,
  restoringId,
  onRestore,
  onRetry,
}) => (
  <section className="space-y-5">
    <div>
      <h1 className="text-2xl font-bold uppercase text-slate-900">Xóa khách hàng</h1>
      <p className="mt-1 text-slate-500">
        Khách hàng đã xóa được giữ {F1_SOFT_DELETE_DAYS} ngày để khôi phục, sau đó bị xóa vĩnh viễn tự động.
      </p>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="hidden grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-500 md:grid">
        <div className="col-span-4">Khách hàng</div>
        <div className="col-span-2">Mã F1</div>
        <div className="col-span-2">Ngày xóa</div>
        <div className="col-span-2">Còn lại</div>
        <div className="col-span-2 text-right">Khôi phục</div>
      </div>

      {loading ? (
        <div className="p-6 text-slate-500" role="status">Đang tải dữ liệu...</div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 p-6 text-slate-600" role="alert">
          <span>Không tải được danh sách khách hàng đã xóa.</span>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Thử lại
          </button>
        </div>
      ) : customers.length === 0 ? (
        <div className="p-6 text-slate-500">Không có khách hàng nào đang chờ xóa vĩnh viễn.</div>
      ) : (
        customers.map((customer) => {
          const days = getRemainingDeleteDays(customer.purgeAt);
          const busy = restoringId === customer._id;
          return (
            <div
              key={customer._id}
              className="grid grid-cols-2 items-center gap-4 border-b border-slate-100 px-4 py-4 md:grid-cols-12"
            >
              <p className="col-span-2 font-semibold text-slate-900 md:col-span-4">{customer.fullName}</p>
              <p className="col-span-1 text-sm text-slate-700 md:col-span-2">{customer.code || "--"}</p>
              <p className="col-span-1 text-sm text-slate-700 md:col-span-2">{formatDate(customer.softDeletedAt)}</p>
              <p className={`col-span-1 text-sm font-semibold md:col-span-2 ${days <= 1 ? "text-red-600" : "text-slate-700"}`}>
                {days > 0 ? `Còn ${days} ngày` : "Sắp bị xóa"}
              </p>
              <div className="col-span-1 text-right md:col-span-2">
                <button
                  type="button"
                  data-testid="f1-restore-customer"
                  disabled={busy}
                  onClick={() => onRestore(customer)}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}
                  Khôi phục
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  </section>
);

export default F1DeletedCustomers;
